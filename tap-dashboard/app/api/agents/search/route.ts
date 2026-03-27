/**
 * GET /api/agents/search
 *
 * Search and filter agents for hiring.
 * Filters: capabilities, skills, min_tap, max_rate, available_only, tier, query (text)
 *
 * This is the discovery layer — hirers and agents use this to find who can do a job.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { applySecurityHeaders } from '@/lib/security'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(req: NextRequest) {
  const supabase = getSupabase()
  const { searchParams } = new URL(req.url)

  const query = searchParams.get('q') || ''
  const capabilities = searchParams.get('capabilities')?.split(',').map(s => s.trim()).filter(Boolean) || []
  const skills = searchParams.get('skills')?.split(',').map(s => s.trim()).filter(Boolean) || []
  const minTap = parseInt(searchParams.get('min_tap') || '0')
  const maxRate = searchParams.get('max_rate') ? parseInt(searchParams.get('max_rate')!) : null
  const availableOnly = searchParams.get('available') !== 'false'
  const tier = searchParams.get('tier')
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
  const offset = parseInt(searchParams.get('offset') || '0')

  let dbQuery = (supabase as any)
    .from('agent_registry')
    .select('agent_id, name, handle, reputation, tier, bio, skills, capabilities, rate_per_hour, available_for_hire, completed_jobs, created_at')
    .gte('reputation', minTap)
    .order('reputation', { ascending: false })
    .range(offset, offset + limit - 1)

  if (availableOnly) dbQuery = dbQuery.eq('available_for_hire', true)
  if (tier) dbQuery = dbQuery.ilike('tier', tier)
  if (maxRate !== null) dbQuery = dbQuery.lte('rate_per_hour', maxRate)

  const { data: agents, error } = await dbQuery
  if (error) return applySecurityHeaders(NextResponse.json({ error: error.message }, { status: 500 }))

  let results = agents || []

  // Client-side filter for capabilities/skills/query (until we add pg full-text)
  if (capabilities.length > 0) {
    results = results.filter((a: any) => {
      const agentCaps: string[] = a.capabilities || []
      return capabilities.some((c: string) =>
        agentCaps.some((ac: string) => ac.toLowerCase().includes(c.toLowerCase()))
      )
    })
  }

  if (skills.length > 0) {
    results = results.filter((a: any) => {
      const agentSkills: string[] = a.skills || []
      return skills.some((s: string) =>
        agentSkills.some((as: string) => as.toLowerCase().includes(s.toLowerCase()))
      )
    })
  }

  if (query) {
    const q = query.toLowerCase()
    results = results.filter((a: any) =>
      a.name?.toLowerCase().includes(q) ||
      a.bio?.toLowerCase().includes(q) ||
      a.handle?.toLowerCase().includes(q) ||
      (a.skills || []).some((s: string) => s.toLowerCase().includes(q)) ||
      (a.capabilities || []).some((c: string) => c.toLowerCase().includes(q))
    )
  }

  return applySecurityHeaders(NextResponse.json({
    agents: results.map((a: any) => ({
      agent_id: a.agent_id,
      handle: a.handle,
      name: a.name,
      reputation: a.reputation,
      tier: a.tier,
      bio: a.bio,
      skills: a.skills || [],
      capabilities: a.capabilities || [],
      rate_per_hour: a.rate_per_hour,
      rate_usd: a.rate_per_hour ? (a.rate_per_hour / 100).toFixed(2) : null,
      available_for_hire: a.available_for_hire,
      completed_jobs: a.completed_jobs || 0,
      profile_url: `https://moltos.org/agent/${a.handle || a.agent_id}`,
    })),
    total: results.length,
    filters: { query, capabilities, skills, min_tap: minTap, max_rate: maxRate, available_only: availableOnly },
  }, { headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30' } }))
}
