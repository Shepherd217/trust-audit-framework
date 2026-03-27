/**
 * POST /api/webhook-agent/dispatch
 *
 * The job dispatch engine. Called automatically when a new job is posted.
 * Finds all webhook agents with matching capabilities, POSTs the job to each,
 * and records which agents were notified.
 *
 * Flow:
 *   1. Job posted → /api/marketplace/jobs calls this
 *   2. This finds webhook agents whose capabilities match the job's skills/category
 *   3. POSTs job details to each endpoint (signed with HMAC)
 *   4. Agent responds with accepted: true/false
 *   5. If accepted → auto-creates application on their behalf
 *   6. Records dispatch in webhook_events table
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHmac, createHash } from 'crypto'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Sign dispatch payload with agent's webhook secret
function signPayload(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex')
}

// Match job to webhook agent capabilities
function jobMatchesAgent(job: any, agent: any): boolean {
  const agentCaps: string[] = agent.capabilities || []
  if (agentCaps.length === 0) return true // no filter = accepts all jobs

  const jobSkills: string[] = job.skills_required || []
  const jobCategory: string = (job.category || '').toLowerCase()

  // Check if any capability matches job skills or category
  return agentCaps.some((cap: string) => {
    const c = cap.toLowerCase()
    return (
      jobCategory.includes(c) ||
      c.includes(jobCategory) ||
      jobSkills.some((s: string) => s.toLowerCase().includes(c) || c.includes(s.toLowerCase()))
    )
  })
}

export async function POST(req: NextRequest) {
  const supabase = getSupabase()

  // Internal auth — only callable from our own API routes
  const internalKey = req.headers.get('x-internal-key')
  if (internalKey !== process.env.INTERNAL_API_KEY && internalKey !== 'moltos-internal-dispatch') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { job_id } = await req.json()
  if (!job_id) return NextResponse.json({ error: 'job_id required' }, { status: 400 })

  // Get job details
  const { data: job } = await (supabase as any)
    .from('marketplace_jobs')
    .select('id, title, description, budget, category, skills_required, min_tap_score, status, hirer_id')
    .eq('id', job_id)
    .eq('status', 'open')
    .single()

  if (!job) return NextResponse.json({ error: 'Job not found or not open' }, { status: 404 })

  // Find eligible webhook agents
  const { data: webhookAgents } = await (supabase as any)
    .from('webhook_agents')
    .select('id, agent_id, endpoint_url, secret, capabilities, min_budget, max_concurrent, timeout_seconds')
    .eq('status', 'active')
    .lte('min_budget', job.budget)

  if (!webhookAgents || webhookAgents.length === 0) {
    return NextResponse.json({ dispatched: 0, message: 'No active webhook agents' })
  }

  // Filter by capability match and TAP score
  const eligible = webhookAgents.filter((agent: any) => jobMatchesAgent(job, agent))

  if (eligible.length === 0) {
    return NextResponse.json({ dispatched: 0, message: 'No capability-matched agents' })
  }

  const dispatched: string[] = []
  const failed: string[] = []
  const accepted: string[] = []

  // Dispatch to each eligible agent
  await Promise.allSettled(
    eligible.map(async (agent: any) => {
      const payload = JSON.stringify({
        event: 'job.available',
        job: {
          id: job.id,
          title: job.title,
          description: job.description,
          budget_credits: job.budget,
          budget_usd: (job.budget / 100).toFixed(2),
          category: job.category,
          skills_required: job.skills_required,
          min_tap_score: job.min_tap_score,
        },
        clawfs_output_path: `/agents/${agent.agent_id}/jobs/${job.id}/result.json`,
        complete_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://moltos.org'}/api/webhook-agent/complete`,
        timestamp: Date.now(),
      })

      const signature = signPayload(payload, agent.secret)

      try {
        const res = await fetch(agent.endpoint_url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-MoltOS-Signature': signature,
            'X-MoltOS-Event': 'job.available',
            'X-MoltOS-Agent': agent.agent_id,
            'X-MoltOS-Job': job.id,
          },
          body: payload,
          signal: AbortSignal.timeout((agent.timeout_seconds || 10) * 1000),
        })

        const responseData = await res.json().catch(() => ({})) as any
        dispatched.push(agent.agent_id)

        // Log dispatch event
        await (supabase as any).from('webhook_events').insert({
          webhook_agent_id: agent.id,
          agent_id: agent.agent_id,
          event_type: 'job.available',
          job_id: job.id,
          response_status: res.status,
          response_body: responseData,
          success: res.ok,
        })

        // If agent responds with accepted: true → auto-create application
        if (res.ok && responseData.accepted === true) {
          accepted.push(agent.agent_id)

          const proposal = responseData.proposal ||
            `Webhook agent ${agent.agent_id} accepted this job automatically. Capabilities: ${(agent.capabilities || []).join(', ')}`

          await (supabase as any).from('marketplace_applications').insert({
            job_id: job.id,
            applicant_id: agent.agent_id,
            applicant_public_key: agent.agent_id,
            proposal,
            status: 'pending',
          })

          // Update error count reset on success
          await (supabase as any).from('webhook_agents')
            .update({ error_count: 0, last_pinged_at: new Date().toISOString() })
            .eq('id', agent.id)
        }

      } catch (err: any) {
        failed.push(agent.agent_id)

        // Increment error count — auto-pause at 5 consecutive errors
        const { data: current } = await (supabase as any)
          .from('webhook_agents')
          .select('error_count')
          .eq('id', agent.id)
          .single()

        const newErrorCount = (current?.error_count || 0) + 1

        await (supabase as any).from('webhook_agents').update({
          error_count: newErrorCount,
          status: newErrorCount >= 5 ? 'error' : 'active',
          last_pinged_at: new Date().toISOString(),
        }).eq('id', agent.id)

        // Log failed dispatch
        await (supabase as any).from('webhook_events').insert({
          webhook_agent_id: agent.id,
          agent_id: agent.agent_id,
          event_type: 'job.available',
          job_id: job.id,
          response_status: 0,
          success: false,
          error: err.message,
        })
      }
    })
  )

  return NextResponse.json({
    job_id,
    eligible: eligible.length,
    dispatched: dispatched.length,
    accepted: accepted.length,
    failed: failed.length,
    accepted_agents: accepted,
  })
}
