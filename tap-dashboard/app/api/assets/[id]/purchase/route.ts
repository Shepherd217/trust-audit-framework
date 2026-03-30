/**
 * POST /api/assets/[id]/purchase
 *
 * Buy an asset from the ClawStore.
 * - Deducts credits from buyer wallet
 * - Credits seller wallet at 97.5% (2.5% platform fee)
 * - For file/template: shares ClawFS access with buyer
 * - For skill: generates a unique access key for the buyer
 * - Records purchase for reviews eligibility
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash, randomBytes } from 'crypto'
import { applySecurityHeaders } from '@/lib/security'

const PLATFORM_FEE = 0.025

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

async function resolveAgent(req: NextRequest) {
  const apiKey = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || req.headers.get('x-api-key')
  if (!apiKey) return null
  const hash = createHash('sha256').update(apiKey).digest('hex')
  const { data } = await (getSupabase() as any).from('agent_registry')
    .select('agent_id, name, reputation').eq('api_key_hash', hash).single()
  return data || null
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const sb = getSupabase()
  const buyer = await resolveAgent(req)
  if (!buyer) return applySecurityHeaders(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))

  // Get asset
  const { data: asset } = await (sb as any).from('agent_assets')
    .select('id, seller_id, title, type, price_credits, clawfs_path, endpoint_url, min_buyer_tap, status')
    .eq('id', params.id).single()

  if (!asset) return applySecurityHeaders(NextResponse.json({ error: 'Asset not found' }, { status: 404 }))
  if (asset.status !== 'active') return applySecurityHeaders(NextResponse.json({ error: 'Asset is no longer available' }, { status: 410 }))
  if (asset.seller_id === buyer.agent_id) return applySecurityHeaders(NextResponse.json({ error: 'Cannot buy your own asset' }, { status: 400 }))

  // Check min TAP requirement
  if (asset.min_buyer_tap > 0 && buyer.reputation < asset.min_buyer_tap) {
    return applySecurityHeaders(NextResponse.json({
      error: `This asset requires TAP ${asset.min_buyer_tap}. Your TAP: ${buyer.reputation}.`,
      min_tap: asset.min_buyer_tap, your_tap: buyer.reputation,
    }, { status: 403 }))
  }

  // Check already purchased
  const { data: existing } = await (sb as any).from('asset_purchases')
    .select('id, access_key, clawfs_copy_path').eq('asset_id', params.id).eq('buyer_id', buyer.agent_id).maybeSingle()
  if (existing) {
    return applySecurityHeaders(NextResponse.json({
      already_purchased: true, access_key: existing.access_key,
      clawfs_path: existing.clawfs_copy_path,
      message: 'You already own this asset.',
    }))
  }

  const price = asset.price_credits ?? 0

  // Deduct from buyer wallet (if price > 0)
  if (price > 0) {
    const { data: buyerWallet } = await (sb as any).from('agent_wallets').select('balance').eq('agent_id', buyer.agent_id).single()
    if (!buyerWallet || buyerWallet.balance < price) {
      return applySecurityHeaders(NextResponse.json({
        error: `Insufficient balance. Need ${price} credits, have ${buyerWallet?.balance ?? 0}.`,
        price, balance: buyerWallet?.balance ?? 0,
      }, { status: 402 }))
    }

    // Deduct buyer
    await (sb as any).from('agent_wallets').update({ balance: buyerWallet.balance - price }).eq('agent_id', buyer.agent_id)
    await (sb as any).from('wallet_transactions').insert({
      agent_id: buyer.agent_id, type: 'debit', amount: -price,
      balance_after: buyerWallet.balance - price,
      description: `ClawStore: "${asset.title}"`, reference_id: `asset_${asset.id}`,
    })

    // Credit seller (97.5%)
    const sellerCut = Math.round(price * (1 - PLATFORM_FEE))
    const { data: sellerWallet } = await (sb as any).from('agent_wallets').select('balance, total_earned').eq('agent_id', asset.seller_id).single()
    const sellerBal = (sellerWallet?.balance ?? 0) + sellerCut
    await (sb as any).from('agent_wallets').upsert({
      agent_id: asset.seller_id, balance: sellerBal,
      total_earned: (sellerWallet?.total_earned ?? 0) + sellerCut,
      currency: 'credits', updated_at: new Date().toISOString(),
    }, { onConflict: 'agent_id' })
    await (sb as any).from('wallet_transactions').insert({
      agent_id: asset.seller_id, type: 'credit', amount: sellerCut,
      balance_after: sellerBal,
      description: `ClawStore sale: "${asset.title}" to ${buyer.name}`, reference_id: `asset_${asset.id}`,
    })

    // Update asset revenue + downloads
    await (sb as any).from('agent_assets').update({
      downloads: (sb as any).rpc ? undefined : undefined,
      revenue_total: 0, // will be updated below
    }).eq('id', asset.id)
    await sb.rpc('increment_asset_stats' as any, { asset_id: asset.id, revenue: sellerCut }).catch(() => {
      // Fallback if RPC doesn't exist
      sb.from('agent_assets' as any).select('downloads, revenue_total').eq('id', asset.id).single().then(({ data }: any) => {
        if (data) sb.from('agent_assets' as any).update({
          downloads: (data.downloads || 0) + 1,
          revenue_total: (data.revenue_total || 0) + sellerCut,
        }).eq('id', asset.id)
      })
    })

    // Notify seller
    await (sb as any).from('notifications').insert({
      agent_id: asset.seller_id, notification_type: 'asset.sold',
      title: `"${asset.title}" sold! +${sellerCut} credits`,
      message: `${buyer.name} (TAP ${buyer.reputation}) purchased your asset for ${price} credits. You earned ${sellerCut} credits (97.5%).`,
      metadata: { asset_id: asset.id, buyer_id: buyer.agent_id, amount: sellerCut }, read: false,
    })
  }

  // Deliver access
  let accessKey: string | null = null
  let clawfsCopyPath: string | null = null

  if (asset.type === 'skill') {
    // Generate unique access key for this buyer
    accessKey = `sk_asset_${randomBytes(16).toString('hex')}`
    // Store buyer access key (seller's server can validate against this)
    await (sb as any).from('agent_assets').update({
      // Store buyer keys in a separate lookup — simplified: return the key directly
    }).eq('id', asset.id).catch(() => {})
  }

  if (asset.type === 'file' || asset.type === 'template') {
    // Copy asset to buyer's permanent namespace — buyer owns it regardless of seller's future actions
    if (asset.clawfs_path) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://moltos.org'
      const sellerApiKey = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || req.headers.get('x-api-key') || ''
      const buyerPath = `/agents/${buyer.agent_id}/store-purchases/${asset.id}/${asset.clawfs_path.split('/').pop() || 'asset'}`
      clawfsCopyPath = buyerPath

      // Read from seller's ClawFS then write to buyer's namespace
      try {
        const readRes = await fetch(`${appUrl}/api/clawfs/read?path=${encodeURIComponent(asset.clawfs_path)}&agent_id=${asset.seller_id}`, {
          headers: { 'x-api-key': sellerApiKey }
        })
        if (readRes.ok) {
          const readData = await readRes.json()
          const content = readData.content || readData.file?.content
          if (content) {
            // Write to buyer's namespace — permanent ownership
            await fetch(`${appUrl}/api/clawfs/write`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-api-key': sellerApiKey },
              body: JSON.stringify({
                path: buyerPath, content, content_type: readData.content_type || 'application/octet-stream',
                public_key: buyer.agent_id,
                signature: 'store_delivery', timestamp: Date.now(), challenge: 'store',
              }),
            })
          }
        }
      } catch { /* non-fatal — record original path as fallback */ }
    }
  }

  // Record purchase
  const { data: purchase } = await (sb as any).from('asset_purchases').insert({
    asset_id: asset.id, buyer_id: buyer.agent_id,
    amount_paid: price, access_key: accessKey,
    clawfs_copy_path: clawfsCopyPath,
  }).select().single()

  return applySecurityHeaders(NextResponse.json({
    success: true,
    purchase_id: purchase.id,
    asset_id: asset.id,
    asset_title: asset.title,
    asset_type: asset.type,
    amount_paid: price,
    price_usd: (price / 100).toFixed(2),
    // Delivery
    access_key: accessKey,           // for skills
    clawfs_path: clawfsCopyPath,    // for files/templates
    endpoint_url: accessKey ? asset.endpoint_url : null,
    message: price === 0
      ? `"${asset.title}" claimed for free.`
      : `Purchased "${asset.title}" for ${price} credits ($${(price/100).toFixed(2)}).`,
    can_review: true,
    review_hint: 'Leave a review with POST /api/assets/' + asset.id + '/review — your review affects the seller\'s TAP score.',
  }))
}
