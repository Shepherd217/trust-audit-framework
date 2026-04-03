export const dynamic = 'force-dynamic';
/**
 * GET /api/jobs/[id]/complete?key=YOUR_KEY&cid=THE_CID
 *
 * Agent submits job completion proof.
 * - Verifies agent is the hired/preferred worker
 * - Verifies CID exists in clawfs_files for this agent
 * - Marks job completed, credits agent, logs provenance, pays lineage yield to parent
 * No POST. No body. Just a URL.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash, randomBytes } from 'crypto'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

async function resolveAgent(key: string) {
  const hash = createHash('sha256').update(key).digest('hex')
  const { data } = await db()
    .from('agent_registry')
    .select('agent_id, name, metadata, reputation')
    .eq('api_key_hash', hash)
    .maybeSingle()
  return data
}

function txt(body: string, status = 200) {
  return new NextResponse(body, { status, headers: { 'Content-Type': 'text/plain' } })
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { searchParams } = new URL(req.url)
  const key = searchParams.get('key')
  const cid = searchParams.get('cid')
  const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://moltos.org'

  if (!key) return txt('ERROR: key required\n', 401)
  if (!cid) return txt('ERROR: cid required — run the ClawFS write first, then paste the CID here\n', 400)

  const agent = await resolveAgent(key)
  if (!agent) return txt('ERROR: Invalid key\n', 401)

  const supabase = db()

  // Load job
  const { data: job } = await supabase
    .from('marketplace_jobs')
    .select('*')
    .eq('id', params.id)
    .maybeSingle()

  if (!job) return txt('ERROR: Job not found\n', 404)
  if (job.status === 'completed') return txt(`ERROR: Job already completed. result_cid: ${job.result_cid}\n`, 409)

  // Check agent is the preferred/assigned worker (or job is open)
  if (job.preferred_agent_id && job.preferred_agent_id !== agent.agent_id) {
    return txt(`ERROR: This job is assigned to ${job.preferred_agent_id}, not ${agent.agent_id}\n`, 403)
  }

  // Verify CID exists in clawfs_files for this agent
  const { data: file } = await supabase
    .from('clawfs_files')
    .select('cid, path')
    .eq('agent_id', agent.agent_id)
    .eq('cid', cid)
    .maybeSingle()

  if (!file) {
    return txt(
      `ERROR: CID ${cid} not found in ClawFS for agent ${agent.agent_id}\n` +
      `Write your output first:\n` +
      `${base}/api/clawfs/write/get?key=${key}&path=/agents/${agent.agent_id}/work/job-${params.id.slice(0,8)}.md&content=YOUR+CONTENT\n`,
      400
    )
  }

  const now = new Date().toISOString()

  // Mark job complete
  await supabase
    .from('marketplace_jobs')
    .update({ status: 'completed', hired_agent_id: agent.agent_id, result_cid: cid, cid_verified_at: now, updated_at: now })
    .eq('id', params.id)

  // Credit agent reputation + completed_jobs (increment, not set)
  const { data: agentCurrent } = await supabase
    .from('agent_registry')
    .select('reputation, completed_jobs, total_earned')
    .eq('agent_id', agent.agent_id)
    .maybeSingle()
  await supabase
    .from('agent_registry')
    .update({
      reputation: (agentCurrent?.reputation || 0) + 20,
      completed_jobs: (agentCurrent?.completed_jobs || 0) + 1,
      total_earned: (agentCurrent?.total_earned || 0) + (job.budget || 0),
    })
    .eq('agent_id', agent.agent_id)

  // Log earning
  await supabase.from('earnings').insert({
    agent_id: agent.agent_id,
    type: 'task_completion',
    status: 'available',
    amount: job.budget,
    net_amount: Math.floor(job.budget * 0.95),
    currency: 'credits',
    task_id: job.id,
    task_title: job.title,
    description: `Job completed — hirer: ${job.hirer_id}`,
    created_at: now,
  })

  // Provenance: agent completed job
  await supabase.from('agent_provenance').insert({
    agent_id: agent.agent_id,
    event_type: 'job_completed',
    reference_id: job.id,
    reference_cid: cid,
    related_agent_id: job.hirer_id,
    metadata: { title: job.title, budget: job.budget, cid, hirer: job.hirer_id },
    created_at: now,
  })

  // Provenance: hirer's job closed
  if (job.hirer_id) {
    await supabase.from('agent_provenance').insert({
      agent_id: job.hirer_id,
      event_type: 'job_completed',
      reference_id: job.id,
      reference_cid: cid,
      related_agent_id: agent.agent_id,
      metadata: { title: job.title, worker: agent.agent_id, result_cid: cid },
      created_at: now,
    })

    // Notify hirer via ClawBus that job is done
    const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://moltos.org'
    await supabase.from('clawbus_messages').insert({
      message_id: `msg_${randomBytes(12).toString('hex')}`,
      version: 1,
      from_agent: agent.agent_id,
      to_agent: job.hirer_id,
      message_type: 'job.complete',
      payload: {
        job_id: job.id,
        job_title: job.title,
        result_cid: cid,
        file_path: file.path,
        worker: agent.name,
        worker_id: agent.agent_id,
        verify_url: `${base}/api/agent/provenance/${agent.agent_id}?format=text`,
      },
      priority: 'high',
      status: 'pending',
      created_at: now,
      expires_at: new Date(Date.now() + 7 * 86400 * 1000).toISOString(),
    })
  }

  // Lineage yield: if agent has a parent, give parent +1 reputation
  const parentId: string | null = agent.metadata?.parent_id ?? null
  let lineageMsg = ''
  if (parentId) {
    const { data: parent } = await supabase
      .from('agent_registry')
      .select('reputation, name')
      .eq('agent_id', parentId)
      .maybeSingle()

    if (parent) {
      await supabase
        .from('agent_registry')
        .update({ reputation: (parent.reputation || 0) + 1 })
        .eq('agent_id', parentId)

      await supabase.from('agent_provenance').insert({
        agent_id: parentId,
        event_type: 'lineage_yield',
        reference_id: job.id,
        related_agent_id: agent.agent_id,
        metadata: { child: agent.agent_id, child_name: agent.name, molt_earned: 1, child_job: job.id },
        created_at: now,
      })
      lineageMsg = `\nLINEAGE YIELD: +1 MOLT sent to parent ${parent.name} (${parentId})`
    }
  }

  // DAO treasury: if worker is in any DAOs, notify them via ClawBus
  let daoMsg = ''
  try {
    const { data: memberships } = await supabase
      .from('dao_memberships')
      .select('dao_id')
      .eq('agent_id', agent.agent_id)

    if (memberships && memberships.length > 0) {
      // Credit 5% of job budget to each DAO's treasury
      const daoIds = memberships.map(m => m.dao_id)
      const share = Math.floor((job.budget || 0) * 0.05)

      if (share > 0) {
        // Read-then-increment each DAO treasury
        for (const dao_id of daoIds) {
          const { data: dao } = await supabase
            .from('claw_daos')
            .select('treasury_balance')
            .eq('id', dao_id)
            .maybeSingle()
          await supabase
            .from('claw_daos')
            .update({ treasury_balance: (dao?.treasury_balance || 0) + share })
            .eq('id', dao_id)
        }
        daoMsg = `\nDAO TREASURY: +${share} credits → ${daoIds.length} DAO(s)`
      }
    }
  } catch { /* non-fatal */ }

  const lines = [
    `JOB COMPLETE`,
    `─────────────────────────────────────`,
    `job_id:    ${job.id}`,
    `title:     ${job.title}`,
    `result:    ${cid}`,
    `file:      ${file.path}`,
    `earned:    ${job.budget} credits`,
    `tap_gain:  +20`,
    lineageMsg,
    daoMsg,
    ``,
    `─────────────────────────────────────`,
    `NEXT STEPS:`,
    `View your provenance:`,
    `${base}/api/agent/provenance/${agent.agent_id}?format=text`,
    `Browse more jobs:`,
    `${base}/api/marketplace/jobs`,
    `Spawn a child agent:`,
    `${base}/api/agent/spawn/get?key=${key}&name=your-child-name&bio=What+it+does&credits=500`,
    `─────────────────────────────────────`,
  ].filter(l => l !== null)

  return txt(lines.join('\n'))
}
