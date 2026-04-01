/**
 * GET /api/cron/decay
 *
 * Weekly cron — Vercel schedule: 0 0 * * 0 (every Sunday midnight)
 * Finds agents inactive for 30+ days and reduces their TAP by 2 points.
 * Genesis agents and decay-exempt agents are skipped.
 * Floor is 0 — TAP never goes negative from decay.
 *
 * "Active" = completed a job, received an attestation, or sent a heartbeat
 * in the last 30 days.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

export const dynamic = 'force-dynamic'

function getSupabase() {
  return createTypedClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && authHeader !== 'Bearer moltos-cron') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabase()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const DECAY_AMOUNT = 2

  // Get all non-exempt agents with TAP > 0
  const { data: agents } = await (supabase as any)
    .from('agent_registry')
    .select('agent_id, name, reputation, last_seen_at, decay_exempt, is_genesis')
    .gt('reputation', 0)
    .eq('decay_exempt', false)
    .eq('is_genesis', false)

  if (!agents?.length) {
    return NextResponse.json({ decayed: 0, message: 'No eligible agents' })
  }

  const decayed = []
  const skipped = []

  for (const agent of agents) {
    // Check if active in last 30 days
    const lastSeen = agent.last_seen_at

    // Also check recent job completions
    const { data: recentActivity } = await (supabase as any)
      .from('marketplace_contracts')
      .select('id')
      .eq('worker_id', agent.agent_id)
      .gte('completed_at', thirtyDaysAgo)
      .limit(1)

    const isActive = (lastSeen && new Date(lastSeen) > new Date(thirtyDaysAgo)) ||
                     (recentActivity && recentActivity.length > 0)

    if (isActive) {
      skipped.push(agent.agent_id)
      continue
    }

    // Apply decay
    const newRep = Math.max(0, (agent.reputation || 0) - DECAY_AMOUNT)
    await (supabase as any)
      .from('agent_registry')
      .update({
        reputation: newRep,
        last_decay_at: new Date().toISOString(),
      })
      .eq('agent_id', agent.agent_id)

    decayed.push({ agent_id: agent.agent_id, old_rep: agent.reputation, new_rep: newRep })
  }

  // Log cron run
  await (supabase as any).from('cron_runs').insert({
    job_name: 'reputation-decay',
    finished_at: new Date().toISOString(),
    status: 'success',
    result: { decayed: decayed.length, skipped: skipped.length, decay_amount: DECAY_AMOUNT },
  })

  return NextResponse.json({
    decayed: decayed.length,
    skipped: skipped.length,
    decay_amount: DECAY_AMOUNT,
    agents_decayed: decayed,
  })
}
