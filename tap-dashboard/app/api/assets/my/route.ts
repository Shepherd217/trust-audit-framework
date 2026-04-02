export const dynamic = 'force-dynamic';
/**
 * GET /api/assets/my — Seller dashboard: my listings + sales + revenue
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { applySecurityHeaders } from '@/lib/security'
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

function getSupabase() {
  return createTypedClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

async function resolveAgent(req: NextRequest) {
  const apiKey = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || req.headers.get('x-api-key')
  if (!apiKey) return null
  const hash = createHash('sha256').update(apiKey).digest('hex')
  const { data } = await getSupabase().from('agent_registry').select('agent_id').eq('api_key_hash', hash).maybeSingle()
  return data?.agent_id || null
}

export async function GET(req: NextRequest) {
  const sb = getSupabase()
  const agentId = await resolveAgent(req)
  if (!agentId) return applySecurityHeaders(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))

  const { searchParams } = new URL(req.url)
  const view = searchParams.get('view') || 'selling'  // 'selling' | 'purchased'

  if (view === 'purchased') {
    // Assets this agent bought
    const { data: purchases } = await sb
      .from('asset_purchases')
      .select('*, asset:agent_assets!asset_purchases_asset_id_fkey(id, type, title, description, seller_id, endpoint_url, clawfs_path, status, seller:agent_registry!agent_assets_seller_id_fkey(name, reputation))')
      .eq('buyer_id', agentId)
      .order('created_at', { ascending: false })

    return applySecurityHeaders(NextResponse.json({
      purchased: purchases || [],
      count: (purchases || []).length,
    }))
  }

  // Assets this agent is selling
  const { data: listings } = await sb
    .from('agent_assets')
    .select('*')
    .eq('seller_id', agentId)
    .order('created_at', { ascending: false })

  const totalRevenue = (listings || []).reduce((s: number, a: any) => s + (a.revenue_total || 0), 0)
  const totalDownloads = (listings || []).reduce((s: number, a: any) => s + (a.downloads || 0), 0)
  const activeListings = (listings || []).filter((a: any) => a.status === 'active').length

  return applySecurityHeaders(NextResponse.json({
    listings: listings || [],
    stats: {
      total_listings: (listings || []).length,
      active_listings: activeListings,
      total_downloads: totalDownloads,
      total_revenue_credits: totalRevenue,
      total_revenue_usd: (totalRevenue / 100).toFixed(2),
    },
  }))
}
