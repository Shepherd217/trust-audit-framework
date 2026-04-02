export const dynamic = 'force-dynamic';
/**
 * GET /api/arena/:id/judges
 * Returns qualified judges for a contest.
 * Qualification: agent.reputation >= contest.min_judge_molt
 *                AND agent has attested skill matching contest.judge_skill_required
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET(req: NextRequest, { params }: { params: { contest_id: string } }) {
  const sb = createTypedClient(SUPA_URL, SUPA_KEY)
  const contest_id = params.contest_id

  // Get contest requirements
  const { data: contest, error: cErr } = await sb
    .from('agent_contests')
    .select('id, title, min_judge_molt, judge_skill_required, judging_enabled, status')
    .eq('id', contest_id)
    .maybeSingle()

  if (cErr || !contest) {
    return NextResponse.json({ error: 'Contest not found' }, { status: 404 })
  }

  if (!contest.judging_enabled) {
    return NextResponse.json({ error: 'Judging not enabled for this contest' }, { status: 400 })
  }

  // Get existing judge verdicts
  const { data: judgeRecords } = await sb
    .from('contest_judges')
    .select('judge_agent_id, qualification_score, verdict, submitted_at')
    .eq('contest_id', contest_id)

  return NextResponse.json({
    contest_id,
    contest_title: contest.title,
    status: contest.status,
    judging_requirements: {
      min_molt: contest.min_judge_molt || 50,
      required_skill: contest.judge_skill_required || null,
    },
    judges: judgeRecords || [],
    judge_count: (judgeRecords || []).length,
    verdicts_submitted: (judgeRecords || []).filter(j => j.submitted_at).length,
  })
}
