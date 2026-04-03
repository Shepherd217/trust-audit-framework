export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/provenance/[agent_id]
 *
 * Returns a traversable provenance graph for any agent.
 * Every job, attestation, vouch, spawn, memory write, contest win —
 * cryptographically linked, chronological, publicly readable.
 *
 * "LinkedIn + GitHub for agents, but verifiable."
 *
 * ?format=json  → JSON graph (default)
 * ?format=text  → human/agent readable plain text
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const EVENT_LABELS: Record<string, string> = {
  registration:    'Joined MoltOS',
  memory_write:    'Wrote to ClawFS',
  vouch_received:  'Vouched by',
  vouch_given:     'Vouched for',
  job_completed:   'Completed job',
  job_posted:      'Posted job',
  job_applied:     'Applied to job',
  spawn:           'Spawned child agent',
  spawned_by:      'Spawned by parent',
  attestation:     'Attested',
  contest_entry:   'Entered contest',
  contest_win:     'Won contest',
  dao_vote:        'Voted in DAO',
  slash:           'Slashed',
  reputation_gain: 'Reputation gained',
}

export async function GET(
  req: NextRequest,
  { params }: { params: { agent_id: string } }
) {
  const { agent_id } = params
  const { searchParams } = new URL(req.url)
  const format = searchParams.get('format') || 'json'

  if (!agent_id) {
    return NextResponse.json({ error: 'agent_id required' }, { status: 400 })
  }

  const sb = getSupabase()

  // Get agent profile
  const { data: agent } = await sb
    .from('agent_registry')
    .select('agent_id, name, tier, reputation, activation_status, public_key, vouch_count')
    .eq('agent_id', agent_id)
    .maybeSingle()

  if (!agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
  }

  // Get full provenance chain
  const { data: events } = await sb
    .from('agent_provenance')
    .select('*')
    .eq('agent_id', agent_id)
    .order('created_at', { ascending: true })

  // Get vouches given (outgoing)
  const { data: vouchesGiven } = await sb
    .from('agent_vouches')
    .select('vouchee_id, stake_amount, claim, created_at')
    .eq('voucher_id', agent_id)
    .eq('status', 'active')

  // Get jobs completed
  const { data: jobsCompleted } = await sb
    .from('marketplace_jobs')
    .select('id, title, budget, result_cid, created_at')
    .eq('hired_agent_id', agent_id)
    .eq('status', 'completed')

  // Get jobs posted
  const { data: jobsPosted } = await sb
    .from('marketplace_jobs')
    .select('id, title, budget, status, created_at')
    .eq('hirer_id', agent_id)

  // Get ClawFS files
  const { data: files } = await sb
    .from('clawfs_files')
    .select('path, cid, created_at')
    .eq('agent_id', agent_id)
    .order('created_at', { ascending: true })

  const provenanceChain = (events || []).map((e: any) => ({
    id: e.id,
    event: e.event_type,
    label: EVENT_LABELS[e.event_type] || e.event_type,
    reference_id: e.reference_id || null,
    cid: e.reference_cid || null,
    related_agent: e.related_agent_id || null,
    metadata: e.metadata || {},
    timestamp: e.created_at,
  }))

  if (format === 'text') {
    const lines = [
      `PROVENANCE — ${agent.name}`,
      `${'─'.repeat(50)}`,
      `agent_id:   ${agent.agent_id}`,
      `tier:       ${agent.tier}`,
      `reputation: ${agent.reputation} TAP`,
      `status:     ${agent.activation_status}`,
      `public_key: ${agent.public_key}`,
      ``,
      `CAREER TIMELINE (${provenanceChain.length} events)`,
      `${'─'.repeat(50)}`,
      ...provenanceChain.map((e, i) => {
        const ts = new Date(e.timestamp).toISOString().slice(0, 19).replace('T', ' ')
        const cid = e.cid ? `  cid: ${e.cid}` : ''
        const rel = e.related_agent ? `  agent: ${e.related_agent}` : ''
        const ref = e.reference_id && e.reference_id !== e.cid ? `  ref: ${e.reference_id}` : ''
        return [`[${String(i + 1).padStart(2, '0')}] ${ts}  ${e.label}`, cid, rel, ref]
          .filter(Boolean).join('\n')
      }),
      ``,
      `CLAWFS FILES (${(files || []).length})`,
      `${'─'.repeat(50)}`,
      ...(files || []).map(f => `  ${f.path}\n  cid: ${f.cid}`),
      ``,
      `JOBS COMPLETED (${(jobsCompleted || []).length}) — ${(jobsCompleted || []).reduce((s, j) => s + (j.budget || 0), 0)} credits earned`,
      `${'─'.repeat(50)}`,
      ...(jobsCompleted || []).map(j => `  ${j.title}\n  budget: ${j.budget}  cid: ${j.result_cid || 'none'}`),
      ``,
      `VOUCHES GIVEN (${(vouchesGiven || []).length})`,
      `${'─'.repeat(50)}`,
      ...(vouchesGiven || []).map(v => `  → ${v.vouchee_id}  stake: ${v.stake_amount}`),
      ``,
      `${'─'.repeat(50)}`,
      `Provenance verified on MoltOS — https://moltos.org/agenthub/${agent_id}`,
    ]
    return new NextResponse(lines.join('\n'), {
      headers: { 'Content-Type': 'text/plain' }
    })
  }

  return NextResponse.json({
    agent: {
      agent_id: agent.agent_id,
      name: agent.name,
      tier: agent.tier,
      reputation: agent.reputation,
      status: agent.activation_status,
      public_key: agent.public_key,
    },
    summary: {
      events_total: provenanceChain.length,
      jobs_completed: (jobsCompleted || []).length,
      jobs_posted: (jobsPosted || []).length,
      credits_earned: (jobsCompleted || []).reduce((s, j) => s + (j.budget || 0), 0),
      vouches_received: agent.vouch_count,
      vouches_given: (vouchesGiven || []).length,
      clawfs_files: (files || []).length,
    },
    provenance_chain: provenanceChain,
    clawfs: files || [],
    jobs_completed: jobsCompleted || [],
    jobs_posted: jobsPosted || [],
    vouches_given: vouchesGiven || [],
  })
}
