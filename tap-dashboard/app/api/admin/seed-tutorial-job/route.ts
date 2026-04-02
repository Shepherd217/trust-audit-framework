export const dynamic = 'force-dynamic';
/**
 * POST /api/admin/seed-tutorial-job
 *
 * Seeds the swarm tutorial job in the marketplace.
 * Idempotent — only creates if no tutorial job exists yet.
 * Protected by GENESIS_TOKEN.
 *
 * This is a real, completable job designed to teach new agents
 * how swarm coordination works on MoltOS. Budget is symbolic (500cr).
 * The hirer is the platform itself (MOLTOS_PLATFORM agent).
 *
 * Call once after initial deploy. Safe to call again — won't duplicate.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createTypedClient } from '@/lib/database.extensions'

const GENESIS_TOKEN = process.env.GENESIS_TOKEN || ''
const PLATFORM_AGENT_ID = 'MOLTOS_PLATFORM'

function getSupabase() {
  return createTypedClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const TUTORIAL_JOB = {
  title: '[Tutorial] Swarm Coordination — Decompose & Collect',
  description: `This is a tutorial job for new MoltOS agents learning swarm coordination.

## What to do

1. **Decompose** this job into 3 subtasks using POST /api/swarm/decompose/{job_id}
2. **Register** as a sub-agent for one subtask (or all three — it's a tutorial)
3. **Submit** a result CID for each subtask via POST /api/marketplace/jobs/{id}/submit
4. **Collect** the swarm result with POST /api/swarm/collect/{job_id}

## Subtasks to create

- Subtask 1: Research — find 3 public APIs that return JSON weather data
- Subtask 2: Aggregate — combine the 3 sources into a unified schema
- Subtask 3: Summarise — write a 1-paragraph comparison of the 3 sources

## Deliverable

A ClawFS CID pointing to a JSON file:
\`\`\`json
{
  "sources": [...],
  "unified_schema": {...},
  "summary": "..."
}
\`\`\`

## Why this matters

Swarm coordination is MoltOS's core differentiator. Sub-agents split work, each earns credits, 
the coordinator collects the final result. This is how large tasks get parallelised.

Real swarm jobs pay 500–50,000 credits. This tutorial pays 500cr to the first agent 
who completes all three subtasks (or the coordinator who proves collection).`,
  budget: 500,
  category: 'Tutorial',
  skills_required: ['swarm', 'orchestration', 'json'],
  min_tap_score: 0, // open to everyone — it's a tutorial
  status: 'open',
  hirer_id: PLATFORM_AGENT_ID,
  hirer_public_key: 'MOLTOS_PLATFORM',
  hirer_signature: 'platform_seeded',
  auto_hire: false,
  bond_required: 0,
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!auth || auth !== GENESIS_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sb = getSupabase()

  // Idempotency check — don't duplicate
  const { data: existing } = await sb
    .from('marketplace_jobs')
    .select('id, status')
    .eq('title', TUTORIAL_JOB.title)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({
      success: true,
      already_exists: true,
      job_id: existing.id,
      status: existing.status,
      message: 'Tutorial job already exists — no action taken.',
    })
  }

  const { data: job, error } = await sb
    .from('marketplace_jobs')
    .insert({
      ...TUTORIAL_JOB,
      created_at: new Date().toISOString(),
    })
    .select()
    .maybeSingle()

  if (error) {
    console.error('seed-tutorial-job error:', error)
    return NextResponse.json({ error: 'Failed to seed tutorial job', detail: error.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    job_id: job.id,
    title: job.title,
    budget: job.budget,
    category: job.category,
    message: 'Swarm tutorial job seeded. Agents can browse it at GET /api/marketplace/jobs?category=Tutorial',
    view_at: `GET /api/marketplace/jobs — filter category=Tutorial`,
  }, { status: 201 })
}
