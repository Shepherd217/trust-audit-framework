/**
 * POST /api/memory/purchase
 *
 * Purchase a ClawMemory package.
 * Credits transferred: buyer → platform fee (5%) + seller (95%)
 * Purchase logged for provenance.
 * Seller MOLT score staked as quality guarantee.
 *
 * Auth: Bearer API key (buyer)
 *
 * Body:
 *   package_id  - UUID of the memory_packages record
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { applySecurityHeaders, applyRateLimit } from '@/lib/security'
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const PLATFORM_FEE_PCT = 0.05 // 5%

function sb() { return createTypedClient(SUPA_URL, SUPA_KEY) }

async function resolveAgent(req: NextRequest) {
  const apiKey = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || req.headers.get('x-api-key')
  if (!apiKey) return null
  const hash = createHash('sha256').update(apiKey).digest('hex')
  const { data } = await sb().from('agent_registry')
    .select('agent_id, name, reputation, is_suspended').eq('api_key_hash', hash).single()
  return data || null
}

export async function POST(req: NextRequest) {
  const { response: rl, headers: rlh } = await applyRateLimit(req, '/api/memory/purchase')
  if (rl) return rl

  const fail = (msg: string, status = 400) => {
    const r = NextResponse.json({ error: msg }, { status })
    Object.entries(rlh).forEach(([k, v]) => r.headers.set(k, v))
    return applySecurityHeaders(r)
  }

  const agent = await resolveAgent(req)
  if (!agent) return fail('Unauthorized', 401)
  if (agent.is_suspended) return fail('Account suspended', 403)

  let body: any
  try { body = await req.json() } catch { return fail('Invalid JSON') }

  const { package_id } = body
  if (!package_id) return fail('package_id required')

  const supabase = sb()

  // Get package
  const { data: pkg, error: pkgErr } = await supabase
    .from('memory_packages')
    .select('*')
    .eq('id', package_id)
    .eq('active', true)
    .single()

  if (pkgErr || !pkg) {
    if (pkgErr?.code === 'PGRST205') return fail('ClawMemory tables not initialized. Run migrate-034 first.', 503)
    return fail('Memory package not found or no longer available', 404)
  }

  // Can't buy your own memory
  if (pkg.seller_agent_id === agent.agent_id) {
    return fail("You can't purchase your own memory package.")
  }

  // Check already purchased
  const { data: existingPurchase } = await supabase
    .from('memory_purchases')
    .select('id')
    .eq('package_id', package_id)
    .eq('buyer_agent_id', agent.agent_id)
    .single()

  if (existingPurchase) {
    return fail('You already own this memory package.')
  }

  // Check buyer credits
  const { data: buyerWallet } = await supabase
    .from('agent_wallets').select('balance').eq('agent_id', agent.agent_id).single()

  if (!buyerWallet || buyerWallet.balance < pkg.price) {
    return fail(`Insufficient credits. Need ${pkg.price}, have ${buyerWallet?.balance || 0}.`)
  }

  // Calculate splits
  const platformFee = Math.floor(pkg.price * PLATFORM_FEE_PCT)
  const sellerAmount = pkg.price - platformFee

  // Deduct from buyer
  const buyerNewBal = buyerWallet.balance - pkg.price
  await supabase.from('agent_wallets').update({
    balance: buyerNewBal, updated_at: new Date().toISOString(),
  }).eq('agent_id', agent.agent_id)

  await supabase.from('wallet_transactions').insert({
    agent_id: agent.agent_id, type: 'memory_purchase',
    amount: -pkg.price, balance_after: buyerNewBal,
    reference_id: package_id, source_type: 'memory',
    description: `Memory purchase: "${pkg.title}" from ${pkg.seller_agent_id}`,
  })

  // Credit seller
  const { data: sellerWallet } = await supabase
    .from('agent_wallets').select('balance').eq('agent_id', pkg.seller_agent_id).single()

  if (sellerWallet) {
    const sellerNewBal = sellerWallet.balance + sellerAmount
    await supabase.from('agent_wallets').update({
      balance: sellerNewBal, updated_at: new Date().toISOString(),
    }).eq('agent_id', pkg.seller_agent_id)

    await supabase.from('wallet_transactions').insert({
      agent_id: pkg.seller_agent_id, type: 'memory_sale',
      amount: sellerAmount, balance_after: sellerNewBal,
      reference_id: package_id, source_type: 'memory',
      description: `Memory sale: "${pkg.title}" to ${agent.agent_id}`,
    })
  }

  // Record purchase
  await supabase.from('memory_purchases').insert({
    package_id,
    buyer_agent_id: agent.agent_id,
    seller_agent_id: pkg.seller_agent_id,
    price_paid: pkg.price,
    created_at: new Date().toISOString(),
  })

  // Increment download count
  await supabase.from('memory_packages').update({
    downloads: (pkg.downloads || 0) + 1,
    updated_at: new Date().toISOString(),
  }).eq('id', package_id)

  // Log provenance for buyer
  await supabase.from('agent_provenance').insert({
    agent_id: agent.agent_id,
    event_type: 'memory_purchased',
    reference_id: package_id,
    related_agent_id: pkg.seller_agent_id,
    skill: pkg.skill,
    metadata: { title: pkg.title, price: pkg.price },
  })

  // Notify seller
  await supabase.from('notifications').insert({
    agent_id: pkg.seller_agent_id,
    notification_type: 'memory.sold',
    title: `Memory sold: "${pkg.title}"`,
    message: `${agent.name} purchased your memory package. You earned ${sellerAmount} credits ($${(sellerAmount / 100).toFixed(2)}).`,
    metadata: { package_id, buyer_id: agent.agent_id, amount: sellerAmount },
    read: false,
  })

  const r = NextResponse.json({
    success: true,
    purchase: {
      package_id,
      title: pkg.title,
      skill: pkg.skill,
      price: pkg.price,
      price_usd: `$${(pkg.price / 100).toFixed(2)}`,
      proof_cids: pkg.proof_cids || [],
      proof_cid_urls: (pkg.proof_cids || []).map((cid: string) => `https://ipfs.io/ipfs/${cid}`),
      seller: {
        agent_id: pkg.seller_agent_id,
        molt_score: pkg.seller_molt_score,
      },
    },
    buyer_balance_after: buyerNewBal,
    platform_fee: platformFee,
    seller_received: sellerAmount,
    message: `Purchased! The proof CIDs above are your access to the seller's actual job deliverables.`,
  })

  Object.entries(rlh).forEach(([k, v]) => r.headers.set(k, v))
  return applySecurityHeaders(r)
}
