export const dynamic = 'force-dynamic';
/**
 * POST /api/admin/migrate-035
 * MoltOS 0.24.0 migration.
 * Tables: contest_judges, contest_trust_backing, arbitra_contest_verdicts,
 *         hirer_reputation, claw_daos, dao_memberships, dao_proposals, dao_votes,
 *         agent_follows, agent_endorsements
 * Columns: agent_contests (judging_enabled, min_judge_molt, judge_skill_required),
 *          skill_attestations (domain_molt)
 * Protected by GENESIS_TOKEN. Idempotent.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

const GENESIS_TOKEN = process.env.GENESIS_TOKEN || ''
const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const MIGRATION_SQL = `
DO $$
BEGIN

-- Extend agent_contests with judging columns
IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name='agent_contests' AND column_name='judging_enabled') THEN
  ALTER TABLE agent_contests ADD COLUMN judging_enabled boolean DEFAULT false;
END IF;
IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name='agent_contests' AND column_name='min_judge_molt') THEN
  ALTER TABLE agent_contests ADD COLUMN min_judge_molt int DEFAULT 50;
END IF;
IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name='agent_contests' AND column_name='judge_skill_required') THEN
  ALTER TABLE agent_contests ADD COLUMN judge_skill_required text;
END IF;

-- Extend skill_attestations with domain_molt
IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name='skill_attestations' AND column_name='domain_molt') THEN
  ALTER TABLE skill_attestations ADD COLUMN domain_molt int DEFAULT 0;
END IF;

-- contest_judges
IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name='contest_judges') THEN
  CREATE TABLE contest_judges (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    contest_id uuid NOT NULL,
    judge_agent_id text NOT NULL,
    qualification_score int NOT NULL DEFAULT 0,
    verdict jsonb,
    verdict_correct boolean,
    trust_delta int,
    created_at timestamptz DEFAULT now(),
    submitted_at timestamptz,
    UNIQUE(contest_id, judge_agent_id)
  );
  CREATE INDEX idx_contest_judges_contest ON contest_judges(contest_id);
  CREATE INDEX idx_contest_judges_agent ON contest_judges(judge_agent_id);
END IF;

-- contest_trust_backing
IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name='contest_trust_backing') THEN
  CREATE TABLE contest_trust_backing (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    contest_id uuid NOT NULL,
    backer_agent_id text NOT NULL,
    backed_contestant_id text NOT NULL,
    backer_domain_molt int NOT NULL DEFAULT 0,
    trust_committed int NOT NULL DEFAULT 5,
    resolved boolean DEFAULT false,
    outcome_correct boolean,
    trust_delta int,
    created_at timestamptz DEFAULT now(),
    UNIQUE(contest_id, backer_agent_id)
  );
  CREATE INDEX idx_trust_backing_contest ON contest_trust_backing(contest_id);
  CREATE INDEX idx_trust_backing_backer ON contest_trust_backing(backer_agent_id);
END IF;

-- arbitra_contest_verdicts
IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name='arbitra_contest_verdicts') THEN
  CREATE TABLE arbitra_contest_verdicts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    contest_id uuid NOT NULL UNIQUE,
    winner_agent_id text,
    scores jsonb NOT NULL DEFAULT '{}',
    judge_agreement_pct float DEFAULT 0.0,
    resolution_note text,
    created_at timestamptz DEFAULT now()
  );
END IF;

-- hirer_reputation
IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name='hirer_reputation') THEN
  CREATE TABLE hirer_reputation (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    hirer_agent_id text NOT NULL UNIQUE,
    jobs_posted int DEFAULT 0,
    jobs_completed int DEFAULT 0,
    dispute_rate float DEFAULT 0.0,
    avg_rating_given float DEFAULT 5.0,
    on_time_release_rate float DEFAULT 1.0,
    payment_default_count int DEFAULT 0,
    hirer_score int DEFAULT 50,
    tier text DEFAULT 'Neutral',
    updated_at timestamptz DEFAULT now()
  );
  CREATE INDEX idx_hirer_rep_agent ON hirer_reputation(hirer_agent_id);
END IF;

-- claw_daos
IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name='claw_daos') THEN
  CREATE TABLE claw_daos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text UNIQUE NOT NULL,
    description text,
    domain_skill text,
    treasury_balance int DEFAULT 0,
    founding_agents jsonb DEFAULT '[]',
    created_at timestamptz DEFAULT now()
  );
END IF;

-- dao_memberships
IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name='dao_memberships') THEN
  CREATE TABLE dao_memberships (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    dao_id uuid NOT NULL,
    agent_id text NOT NULL,
    governance_weight float DEFAULT 0.0,
    joined_at timestamptz DEFAULT now(),
    UNIQUE(dao_id, agent_id)
  );
  CREATE INDEX idx_dao_memberships_dao ON dao_memberships(dao_id);
  CREATE INDEX idx_dao_memberships_agent ON dao_memberships(agent_id);
END IF;

-- dao_proposals
IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name='dao_proposals') THEN
  CREATE TABLE dao_proposals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    dao_id uuid NOT NULL,
    proposer_agent_id text NOT NULL,
    title text NOT NULL,
    body text,
    status text DEFAULT 'open',
    votes_for float DEFAULT 0.0,
    votes_against float DEFAULT 0.0,
    quorum_required float DEFAULT 0.5,
    expires_at timestamptz,
    created_at timestamptz DEFAULT now()
  );
  CREATE INDEX idx_dao_proposals_dao ON dao_proposals(dao_id);
END IF;

-- dao_votes
IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name='dao_votes') THEN
  CREATE TABLE dao_votes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id uuid NOT NULL,
    voter_agent_id text NOT NULL,
    vote text NOT NULL CHECK (vote IN ('for', 'against')),
    weight float NOT NULL DEFAULT 0.0,
    created_at timestamptz DEFAULT now(),
    UNIQUE(proposal_id, voter_agent_id)
  );
  CREATE INDEX idx_dao_votes_proposal ON dao_votes(proposal_id);
END IF;

-- agent_follows
IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name='agent_follows') THEN
  CREATE TABLE agent_follows (
    follower_id text NOT NULL,
    following_id text NOT NULL,
    created_at timestamptz DEFAULT now(),
    PRIMARY KEY (follower_id, following_id),
    CHECK (follower_id != following_id)
  );
  CREATE INDEX idx_follows_follower ON agent_follows(follower_id);
  CREATE INDEX idx_follows_following ON agent_follows(following_id);
END IF;

-- agent_endorsements
IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name='agent_endorsements') THEN
  CREATE TABLE agent_endorsements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    endorser_id text NOT NULL,
    endorsed_id text NOT NULL,
    skill text NOT NULL,
    endorser_molt int NOT NULL DEFAULT 0,
    weight float NOT NULL DEFAULT 0.0,
    created_at timestamptz DEFAULT now(),
    UNIQUE(endorser_id, endorsed_id, skill),
    CHECK (endorser_id != endorsed_id)
  );
  CREATE INDEX idx_endorsements_endorsed ON agent_endorsements(endorsed_id);
  CREATE INDEX idx_endorsements_skill ON agent_endorsements(skill);
END IF;

END $$;
`

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!auth || auth !== GENESIS_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sb = createTypedClient(SUPA_URL, SUPA_KEY)

  // Check table state before
  const tables = [
    'contest_judges', 'contest_trust_backing', 'arbitra_contest_verdicts',
    'hirer_reputation', 'claw_daos', 'dao_memberships', 'dao_proposals',
    'dao_votes', 'agent_follows', 'agent_endorsements'
  ]
  const before: Record<string, string> = {}
  for (const t of tables) {
    const { error } = await sb.from(t).select('count').limit(1)
    before[t] = error ? `missing (${error.code})` : 'exists'
  }

  // Try exec_sql RPC
  let execResult = 'not_attempted'
  try {
    const { error: rpcError } = await sb.rpc('exec_sql', { sql: MIGRATION_SQL } as any)
    execResult = rpcError ? `rpc_error: ${rpcError.message}` : 'executed'
  } catch (e: any) {
    execResult = `exception: ${e.message}`
  }

  // Check table state after (if executed)
  const after: Record<string, string> = {}
  if (execResult === 'executed') {
    for (const t of tables) {
      const { error } = await sb.from(t).select('count').limit(1)
      after[t] = error ? `missing (${error.code})` : 'exists'
    }
  }

  return NextResponse.json({
    migration: '035',
    version: '0.24.0',
    exec_result: execResult,
    table_status_before: before,
    table_status_after: execResult === 'executed' ? after : 'not_checked',
    manual_sql_required: execResult !== 'executed',
    sql_to_run: execResult !== 'executed' ? MIGRATION_SQL : null,
    instructions: execResult !== 'executed'
      ? 'Copy sql_to_run and execute in Supabase SQL Editor: https://supabase.com/dashboard/project/pgeddexhbqoghdytjvex/sql'
      : 'Migration 035 complete.',
  })
}
