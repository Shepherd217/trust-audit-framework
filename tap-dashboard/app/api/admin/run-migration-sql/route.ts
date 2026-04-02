export const dynamic = 'force-dynamic';
/**
 * POST /api/admin/run-migration-sql
 * Direct SQL executor for 034 migration. GENESIS_TOKEN protected.
 * Uses postgres.js via the Supabase connection string.
 * One-time use. Tables are idempotent (IF NOT EXISTS).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

const GENESIS_TOKEN = process.env.GENESIS_TOKEN || ''
const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!auth || auth !== GENESIS_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sb = createTypedClient(SUPA_URL, SUPA_KEY)
  const results: Record<string, any> = {}

  // Check current table state
  const tables = ['webhook_subscriptions', 'agent_provenance', 'agent_contests', 'contest_entries', 'memory_packages', 'memory_purchases']
  
  for (const t of tables) {
    const { error } = await sb.from(t).select('count').limit(1)
    results[t] = error ? `missing (${error.code})` : 'exists'
  }

  // Attempt to create tables via a stored procedure if available
  const createTablesSQL = `
DO $$
BEGIN

-- webhook_subscriptions
IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'webhook_subscriptions') THEN
  CREATE TABLE webhook_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    agent_id TEXT NOT NULL,
    url TEXT NOT NULL,
    secret TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
    events TEXT[] NOT NULL DEFAULT ARRAY['job.posted','job.hired','job.completed','arbitra.opened','webhook.test'],
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    last_delivered_at TIMESTAMPTZ,
    delivery_failures INT DEFAULT 0
  );
  CREATE INDEX idx_webhook_subscriptions_agent ON webhook_subscriptions(agent_id);
  CREATE INDEX idx_webhook_subscriptions_active ON webhook_subscriptions(active) WHERE active = true;
END IF;

-- agent_provenance
IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'agent_provenance') THEN
  CREATE TABLE agent_provenance (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    agent_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    reference_id TEXT,
    reference_cid TEXT,
    related_agent_id TEXT,
    skill TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
  );
  CREATE INDEX idx_agent_provenance_agent ON agent_provenance(agent_id, created_at DESC);
  CREATE INDEX idx_agent_provenance_type ON agent_provenance(agent_id, event_type);
END IF;

-- agent_contests
IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'agent_contests') THEN
  CREATE TABLE agent_contests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    job_id TEXT,
    title TEXT NOT NULL,
    description TEXT,
    prize_pool INT NOT NULL DEFAULT 0,
    entry_fee INT DEFAULT 0,
    deadline TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    winner_agent_id TEXT,
    winner_cid TEXT,
    hirer_id TEXT NOT NULL,
    min_molt_score INT DEFAULT 0,
    max_participants INT DEFAULT 100,
    participant_count INT DEFAULT 0,
    staking_pool INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ
  );
  CREATE INDEX idx_agent_contests_status ON agent_contests(status, deadline);
  CREATE INDEX idx_agent_contests_hirer ON agent_contests(hirer_id);
END IF;

-- contest_entries
IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'contest_entries') THEN
  CREATE TABLE contest_entries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    contest_id UUID NOT NULL,
    agent_id TEXT NOT NULL,
    result_cid TEXT,
    submitted_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'entered',
    score NUMERIC,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(contest_id, agent_id)
  );
  CREATE INDEX idx_contest_entries_contest ON contest_entries(contest_id, submitted_at DESC);
  CREATE INDEX idx_contest_entries_agent ON contest_entries(agent_id);
END IF;

-- memory_packages
IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'memory_packages') THEN
  CREATE TABLE memory_packages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    seller_agent_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    skill TEXT NOT NULL,
    price INT NOT NULL DEFAULT 100,
    proof_cids TEXT[] DEFAULT ARRAY[]::TEXT[],
    job_count INT DEFAULT 0,
    seller_molt_score INT,
    downloads INT DEFAULT 0,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  );
  CREATE INDEX idx_memory_packages_skill ON memory_packages(skill, active) WHERE active = true;
  CREATE INDEX idx_memory_packages_seller ON memory_packages(seller_agent_id);
END IF;

-- memory_purchases
IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'memory_purchases') THEN
  CREATE TABLE memory_purchases (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    package_id UUID NOT NULL,
    buyer_agent_id TEXT NOT NULL,
    seller_agent_id TEXT NOT NULL,
    price_paid INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(package_id, buyer_agent_id)
  );
  CREATE INDEX idx_memory_purchases_buyer ON memory_purchases(buyer_agent_id);
  CREATE INDEX idx_memory_purchases_package ON memory_purchases(package_id);
END IF;

END $$;
`

  // Try via the rpc endpoint using a postgres function
  let execResult = 'not_attempted'
  
  try {
    // Supabase has a built-in pg_catalog access — try using a DO block via schema
    const { data, error: rpcError } = await sb.rpc('exec_sql', { sql: createTablesSQL } as any)
    if (rpcError) {
      execResult = `rpc_error: ${rpcError.message}`
    } else {
      execResult = 'executed'
    }
  } catch (e: any) {
    execResult = `exception: ${e.message}`
  }

  return NextResponse.json({
    migration: '034',
    table_status_before: results,
    exec_attempt: execResult,
    manual_sql_required: execResult !== 'executed',
    sql_to_run: createTablesSQL,
    instructions: execResult !== 'executed' 
      ? 'Copy the sql_to_run field and execute it in your Supabase SQL Editor at https://supabase.com/dashboard/project/pgeddexhbqoghdytjvex/sql'
      : 'Migration complete',
  })
}
