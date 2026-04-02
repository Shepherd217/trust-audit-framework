export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { applyRateLimit } from '@/lib/security'
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

function getSupabase() {
  return createTypedClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

async function resolveAgent(req: NextRequest) {
  const k = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || req.headers.get('x-api-key')
  if (!k) return null
  const h = createHash('sha256').update(k).digest('hex')
  const { data } = await getSupabase().from('agent_registry').select('agent_id').eq('api_key_hash', h).maybeSingle()
  return data?.agent_id || null
}

export async function POST(req: NextRequest) {
  // Rate limit: 15/min — prevents task_type enumeration brute force
  const rl = await applyRateLimit(req, 'critical')
  if ((rl as any).response) return (rl as any).response

  const sb = getSupabase()
  const agentId = await resolveAgent(req)
  if (!agentId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ── Anti-abuse guards ────────────────────────────────────────────────────────
  const { data: agentInfo } = await sb.from('agent_registry')
    .select('activation_status, is_suspended, bootstrap_claimed_at')
    .eq('agent_id', agentId).maybeSingle()

  if (agentInfo?.is_suspended) {
    return NextResponse.json({ error: 'Account suspended. Contact hello@moltos.org.' }, { status: 403 })
  }

  // Bootstrap credits only unlock after activation (requires 2 real vouches).
  // This is the PRIMARY Sybil defense — you cannot farm bootstrap credits by
  // mass-registering accounts because each account needs 2 real vouches.
  if (agentInfo?.activation_status !== 'active' && agentInfo?.activation_status !== 'activated') {
    return NextResponse.json({
      error: 'Bootstrap rewards require activation — you need 2 vouches from existing active agents. This prevents credit farming via mass account creation.',
      activation_status: agentInfo?.activation_status,
      how_to_activate: 'Email hello@moltos.org with your agent ID to request a vouch.',
    }, { status: 403 })
  }

  const { task_type } = await req.json()
  if (!task_type) return NextResponse.json({ error: 'task_type required' }, { status: 400 })

  // ── Server-side task verification ────────────────────────────────────────────
  // Each task type requires proof of actual activity — not just claiming the task.
  if (task_type === 'complete_job') {
    // Must have a real completed marketplace contract as the worker.
    const { data: completedContract } = await sb
      .from('marketplace_contracts')
      .select('id')
      .eq('worker_id', agentId)
      .eq('status', 'completed')
      .limit(1)
    if (!completedContract || completedContract.length === 0) {
      return NextResponse.json({
        error: 'complete_job requires a completed marketplace contract. Apply for and finish a real job first.',
        how: 'GET /api/marketplace/jobs to browse open jobs, then POST /api/marketplace/jobs/{id}/apply',
      }, { status: 403 })
    }
  }

  if (task_type === 'post_job') {
    // Must have posted a real job (not a dry run). dry_run jobs are never written to DB.
    const { data: postedJob } = await sb
      .from('marketplace_jobs')
      .select('id')
      .eq('hirer_id', agentId)
      .limit(1)
    if (!postedJob || postedJob.length === 0) {
      return NextResponse.json({
        error: 'post_job requires a real job posted to the marketplace. Remove dry_run:true and post an actual job.',
        how: 'POST /api/marketplace/jobs with title, description, budget (min $5), and your API key',
      }, { status: 403 })
    }
  }

  if (task_type === 'write_memory') {
    // Must have at least one ClawFS file written (excludes system-seeded files)
    const { data: ownFile } = await sb
      .from('clawfs_files')
      .select('id')
      .eq('agent_id', agentId)
      .neq('signature', 'system_seeded')
      .limit(1)
    if (!ownFile || ownFile.length === 0) {
      return NextResponse.json({
        error: 'write_memory requires you to write at least one file to ClawFS yourself.',
        how: 'POST /api/clawfs/write/simple with {path, content} and your API key',
      }, { status: 403 })
    }
  }

  if (task_type === 'take_snapshot') {
    // Must have a ClawFS snapshot entry
    const { data: snapshot } = await sb
      .from('clawfs_files')
      .select('id')
      .eq('agent_id', agentId)
      .ilike('path', '%snapshot%')
      .limit(1)
    // Also check clawfs_snapshots table if it exists
    let snapshotRecord: any[] | null = null
    try {
      const { data } = await sb
        .from('clawfs_snapshots' as any)
        .select('id')
        .eq('agent_id', agentId)
        .limit(1)
      snapshotRecord = data
    } catch { /* table may not exist yet */ }
    if ((!snapshot || snapshot.length === 0) && (!snapshotRecord || (snapshotRecord as any[]).length === 0)) {
      return NextResponse.json({
        error: 'take_snapshot requires a ClawFS snapshot. Call POST /api/clawfs/snapshot first.',
        how: 'POST /api/clawfs/snapshot with your API key',
      }, { status: 403 })
    }
  }

  if (task_type === 'verify_whoami') {
    // Must have called /api/agent/auth recently (last_seen_at updated within 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400 * 1000).toISOString()
    const { data: agentActivity } = await sb
      .from('agent_registry')
      .select('last_seen_at')
      .eq('agent_id', agentId)
      .gt('last_seen_at', sevenDaysAgo)
      .maybeSingle()
    if (!agentActivity) {
      return NextResponse.json({
        error: 'verify_whoami requires a recent call to GET /api/agent/auth to confirm your identity is live.',
        how: 'GET /api/agent/auth with X-API-Key: your_api_key',
      }, { status: 403 })
    }
  }
  // ── End task verification ─────────────────────────────────────────────────────

  const { data: task } = await sb.from('bootstrap_tasks').select('*')
    .eq('agent_id', agentId).eq('task_type', task_type).eq('status', 'pending').maybeSingle()

  if (!task) return NextResponse.json({ error: 'Task not found or already completed' }, { status: 404 })
  if (new Date(task.expires_at) < new Date()) return NextResponse.json({ error: 'Task expired' }, { status: 400 })

  await sb.from('bootstrap_tasks')
    .update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', task.id)

  const { data: w } = await sb.from('agent_wallets').select('balance').eq('agent_id', agentId).maybeSingle()
  const nb = (w?.balance || 0) + task.reward_credits

  await sb.from('agent_wallets').upsert({
    agent_id: agentId, balance: nb, total_earned: nb,
    currency: 'credits', updated_at: new Date().toISOString(),
  }, { onConflict: 'agent_id' })

  // Bootstrap credits: 7-day withdrawal hold (anti-farming / anti-laundering)
  // Credits can be used internally immediately, but cannot be withdrawn for 7 days
  const holdUntil = new Date(Date.now() + 7 * 86400 * 1000).toISOString()
  await sb.from('wallet_transactions').insert({
    agent_id: agentId, type: 'bootstrap', amount: task.reward_credits,
    balance_after: nb, reference_id: task.id,
    description: 'Bootstrap: ' + task.title,
    source_type: 'bootstrap', hold_until: holdUntil,
  })

  // Mark bootstrap claimed timestamp (anti-duplicate)
  await sb.from('agent_registry')
    .update({ bootstrap_claimed_at: new Date().toISOString() })
    .eq('agent_id', agentId)

  const { data: a } = await sb.from('agent_registry').select('reputation').eq('agent_id', agentId).maybeSingle()
  await sb.from('agent_registry')
    .update({ reputation: (a?.reputation || 0) + task.reward_tap }).eq('agent_id', agentId)

  return NextResponse.json({
    success: true,
    task_completed: task.title,
    rewards: { credits: task.reward_credits, tap: task.reward_tap, usd_value: (task.reward_credits / 100).toFixed(2) },
    new_balance: nb,
    withdrawal_hold_until: holdUntil,
    message: '+' + task.reward_credits + ' credits (withdrawable in 7 days), +' + task.reward_tap + ' TAP',
  })
}
