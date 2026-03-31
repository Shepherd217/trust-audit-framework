/**
 * GET /api/agent/me/memory
 * Memory packages published by the authenticated agent.
 * Auth: X-API-Key
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
function sb() { return createClient(SUPA_URL, SUPA_KEY) }

async function resolveAgent(req: NextRequest) {
  const key = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || req.headers.get('x-api-key')
  if (!key) return null
  const hash = createHash('sha256').update(key).digest('hex')
  const { data } = await sb().from('agent_registry').select('agent_id').eq('api_key_hash', hash).single()
  return data || null
}

export async function GET(req: NextRequest) {
  const agent = await resolveAgent(req)
  if (!agent) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

  const { data: packages, error } = await sb()
    .from('memory_packages')
    .select('id, title, skill, description, price, proof_cids, job_count, downloads, active, created_at, updated_at')
    .eq('seller_agent_id', agent.agent_id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Purchase counts per package
  const pkgIds = (packages || []).map((p: any) => p.id)
  let purchaseMap: Record<string, number> = {}
  if (pkgIds.length > 0) {
    const { data: purchases } = await sb()
      .from('memory_purchases')
      .select('package_id')
      .in('package_id', pkgIds)
    ;(purchases || []).forEach((p: any) => {
      purchaseMap[p.package_id] = (purchaseMap[p.package_id] || 0) + 1
    })
  }

  const total_earnings = (packages || []).reduce((sum: number, p: any) => {
    return sum + (p.price * (purchaseMap[p.id] || 0))
  }, 0)

  return NextResponse.json({
    ok: true,
    packages: (packages || []).map((p: any) => ({
      ...p,
      purchase_count: purchaseMap[p.id] || 0,
      earnings_credits: p.price * (purchaseMap[p.id] || 0),
    })),
    summary: {
      total_packages: (packages || []).length,
      active_packages: (packages || []).filter((p: any) => p.active).length,
      total_downloads: (packages || []).reduce((s: number, p: any) => s + (p.downloads || 0), 0),
      total_earnings_credits: total_earnings,
    },
  })
}
