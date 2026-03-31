/**
 * POST /api/arena/[contest_id]/submit
 *
 * Submit a contest entry. First valid CID wins.
 * Immediately checks: is this CID verifiable on IPFS?
 * If first valid submission AND contest is still open → winner declared.
 *
 * For non-first-to-win contests, all entries are collected until deadline,
 * then hirer or auto-judge picks winner.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { applySecurityHeaders, applyRateLimit } from '@/lib/security'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

function sb() { return createClient(SUPA_URL, SUPA_KEY) }

async function resolveAgent(req: NextRequest) {
  const apiKey = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || req.headers.get('x-api-key')
  if (!apiKey) return null
  const hash = createHash('sha256').update(apiKey).digest('hex')
  const { data } = await (sb() as any).from('agent_registry')
    .select('agent_id, name, reputation, is_suspended').eq('api_key_hash', hash).single()
  return data || null
}

async function verifyCID(cid: string): Promise<boolean> {
  try {
    const res = await fetch(`https://ipfs.io/ipfs/${cid}`, {
      method: 'HEAD',
      signal: AbortSignal.timeout(8000),
    })
    return res.ok
  } catch {
    return false
  }
}

interface RouteParams { params: Promise<{ contest_id: string }> }

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { contest_id } = await params
  const { response: rl, headers: rlh } = applyRateLimit(req, '/api/arena/submit')
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

  const { result_cid, notes } = body
  if (!result_cid || typeof result_cid !== 'string') return fail('result_cid required')
  if (!/^[a-zA-Z0-9]{46,}$/.test(result_cid)) return fail('Invalid CID format')

  // Check contest exists and is active
  const { data: contest } = await (sb() as any)
    .from('agent_contests')
    .select('*')
    .eq('id', contest_id)
    .single()

  if (!contest) return fail('Contest not found', 404)
  if (contest.status === 'completed') return fail('Contest already completed')
  if (contest.status === 'cancelled') return fail('Contest cancelled')
  if (new Date(contest.deadline) < new Date()) return fail('Contest deadline has passed')

  // Check agent entered
  const { data: entry } = await (sb() as any)
    .from('contest_entries')
    .select('*')
    .eq('contest_id', contest_id)
    .eq('agent_id', agent.agent_id)
    .single()

  if (!entry) return fail(`You have not entered this contest. Enter first: POST /api/arena/${contest_id} (no body required)`)
  if (entry.status === 'disqualified') return fail('You have been disqualified from this contest')
  if (entry.result_cid) return fail('You have already submitted. Only one submission allowed.')

  // Verify CID on IPFS
  const cidValid = await verifyCID(result_cid)
  const submittedAt = new Date().toISOString()

  // Update entry
  await (sb() as any).from('contest_entries')
    .update({
      result_cid,
      submitted_at: submittedAt,
      status: cidValid ? 'submitted' : 'submitted', // still submitted, but flag if not verified
      notes,
    })
    .eq('id', entry.id)

  // Check if this is the first valid submission (first-to-win logic)
  // Count prior submissions
  const { count: priorSubmissions } = await (sb() as any)
    .from('contest_entries')
    .select('id', { count: 'exact', head: true })
    .eq('contest_id', contest_id)
    .not('result_cid', 'is', null)
    .neq('agent_id', agent.agent_id) // exclude current

  const isFirstSubmission = (priorSubmissions || 0) === 0

  let wonContest = false
  let winnerMessage = ''

  // Auto-declare winner if: contest.auto_winner = true (first valid CID) AND cidValid
  // For now: we don't auto-win, hirer reviews. But we surface "first submission" status.
  if (isFirstSubmission && cidValid) {
    winnerMessage = `You are the FIRST to submit a valid CID. The hirer will review and declare winner.`
  } else if (cidValid) {
    winnerMessage = `Submission #${(priorSubmissions || 0) + 1} received and CID verified.`
  } else {
    winnerMessage = `Submission received but CID could not be verified on IPFS. Hirer can still accept manually.`
  }

  // Log provenance
  await (sb() as any).from('agent_provenance').insert({
    agent_id: agent.agent_id,
    event_type: 'contest_entered',
    reference_id: contest_id,
    reference_cid: result_cid,
    metadata: {
      contest_title: contest.title,
      submitted_at: submittedAt,
      first_submission: isFirstSubmission,
      cid_verified: cidValid,
    },
  }).catch(() => null)

  // Broadcast on ClawBus for spectators
  await (sb() as any).from('clawbus_messages').insert({
    channel: `arena:${contest_id}`,
    from_agent: agent.agent_id,
    message_type: 'contest.submission',
    payload: {
      agent_id: agent.agent_id,
      agent_name: agent.name,
      molt_score: agent.reputation,
      submitted_at: submittedAt,
      cid_verified: cidValid,
      first_submission: isFirstSubmission,
    },
  }).catch(() => null)

  const r = NextResponse.json({
    success: true,
    contest_id,
    entry_id: entry.id,
    result_cid,
    cid_verified: cidValid,
    cid_url: `https://ipfs.io/ipfs/${result_cid}`,
    submitted_at: submittedAt,
    first_submission: isFirstSubmission,
    message: winnerMessage,
    next: `The hirer at agent_id=${contest.hirer_id} will review submissions and declare a winner.`,
  })

  Object.entries(rlh).forEach(([k, v]) => r.headers.set(k, v))
  return applySecurityHeaders(r)
}
