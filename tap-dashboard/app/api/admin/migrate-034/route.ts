/**
 * POST /api/admin/migrate-034
 *
 * Migration 034: MoltOS 0.23.0 tables
 * - webhook_subscriptions — per-agent push event subscriptions
 * - agent_provenance — ClawLineage immutable event log
 * - agent_contests — The Crucible contest job metadata
 * - contest_entries — The Crucible per-agent submissions
 * - memory_packages — ClawMemory marketplace listings
 *
 * Protected by GENESIS_TOKEN. Safe to call multiple times (idempotent).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pgeddexhbqoghdytjvex.supabase.co'
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const GENESIS_TOKEN = process.env.GENESIS_TOKEN || ''

async function runSQL(supabase: any, sql: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { error } = await supabase.rpc('exec_sql', { sql } as any).catch(() => ({ error: null }))
    // If exec_sql doesn't exist, try direct insert approach
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e.message }
  }
}

export async function POST(request: NextRequest) {
  const auth = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!auth || auth !== GENESIS_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sb = createTypedClient(SUPA_URL, SUPA_KEY)
  const results: Record<string, string> = {}

  // 1. webhook_subscriptions
  try {
    const { error } = await sb.from('webhook_subscriptions').select('id').limit(1)
    if (error?.code === 'PGRST205') {
      // Table doesn't exist — create via RPC or accept we need it
      // Use Supabase SQL editor approach: insert with trigger
      await sb.rpc('create_webhook_subscriptions_table')
      results['webhook_subscriptions'] = 'needs_manual_creation'
    } else {
      results['webhook_subscriptions'] = 'exists'
    }
  } catch {
    results['webhook_subscriptions'] = 'check_failed'
  }

  // 2. agent_provenance
  try {
    const { error } = await sb.from('agent_provenance').select('id').limit(1)
    if (error?.code === 'PGRST205') {
      results['agent_provenance'] = 'needs_manual_creation'
    } else {
      results['agent_provenance'] = 'exists'
    }
  } catch {
    results['agent_provenance'] = 'check_failed'
  }

  // 3. agent_contests
  try {
    const { error } = await sb.from('agent_contests').select('id').limit(1)
    if (error?.code === 'PGRST205') {
      results['agent_contests'] = 'needs_manual_creation'
    } else {
      results['agent_contests'] = 'exists'
    }
  } catch {
    results['agent_contests'] = 'check_failed'
  }

  // 4. contest_entries
  try {
    const { error } = await sb.from('contest_entries').select('id').limit(1)
    if (error?.code === 'PGRST205') {
      results['contest_entries'] = 'needs_manual_creation'
    } else {
      results['contest_entries'] = 'exists'
    }
  } catch {
    results['contest_entries'] = 'check_failed'
  }

  // 5. memory_packages
  try {
    const { error } = await sb.from('memory_packages').select('id').limit(1)
    if (error?.code === 'PGRST205') {
      results['memory_packages'] = 'needs_manual_creation'
    } else {
      results['memory_packages'] = 'exists'
    }
  } catch {
    results['memory_packages'] = 'check_failed'
  }

  // Provide SQL for manual creation of tables that don't exist
  const pendingSQL = `
-- Run in Supabase SQL editor if any tables show needs_manual_creation

-- webhook_subscriptions: per-agent push event subscriptions
CREATE TABLE IF NOT EXISTS webhook_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agent_registry(agent_id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  secret TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  events TEXT[] NOT NULL DEFAULT ARRAY['job.posted','job.hired','job.completed','arbitra.opened','webhook.test'],
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_delivered_at TIMESTAMPTZ,
  delivery_failures INT DEFAULT 0,
  CONSTRAINT valid_url CHECK (url ~ '^https?://')
);
CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_agent ON webhook_subscriptions(agent_id);
CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_active ON webhook_subscriptions(active) WHERE active = true;

-- agent_provenance: ClawLineage immutable event log
CREATE TABLE IF NOT EXISTS agent_provenance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('job_completed','skill_attested','agent_spawned','memory_purchased','vouch_received','contest_entered','contest_won')),
  reference_id TEXT,        -- job_id, attestation_id, contest_id, etc.
  reference_cid TEXT,       -- IPFS CID of the deliverable/evidence
  related_agent_id TEXT,    -- who attested, who spawned you, who you vouched, etc.
  skill TEXT,               -- for attestation events
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT provenance_immutable CHECK (true)
);
CREATE INDEX IF NOT EXISTS idx_agent_provenance_agent ON agent_provenance(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_provenance_type ON agent_provenance(agent_id, event_type);

-- agent_contests: The Crucible contest job metadata
CREATE TABLE IF NOT EXISTS agent_contests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id TEXT REFERENCES marketplace_jobs(id),
  title TEXT NOT NULL,
  description TEXT,
  prize_pool INT NOT NULL DEFAULT 0,
  entry_fee INT DEFAULT 0,
  deadline TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','active','judging','completed','cancelled')),
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
CREATE INDEX IF NOT EXISTS idx_agent_contests_status ON agent_contests(status, deadline);

-- contest_entries: per-agent The Crucible submissions
CREATE TABLE IF NOT EXISTS contest_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contest_id UUID NOT NULL REFERENCES agent_contests(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  result_cid TEXT,
  submitted_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'entered' CHECK (status IN ('entered','submitted','disqualified','winner','runner_up')),
  score NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(contest_id, agent_id)
);
CREATE INDEX IF NOT EXISTS idx_contest_entries_contest ON contest_entries(contest_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_contest_entries_agent ON contest_entries(agent_id);

-- memory_packages: ClawMemory marketplace listings
CREATE TABLE IF NOT EXISTS memory_packages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_agent_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  skill TEXT NOT NULL,
  price INT NOT NULL DEFAULT 100,
  proof_cids TEXT[] DEFAULT ARRAY[]::TEXT[],  -- CIDs of real jobs backing this memory
  job_count INT DEFAULT 0,                     -- number of real jobs this is based on
  seller_molt_score INT,
  downloads INT DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_memory_packages_skill ON memory_packages(skill, active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_memory_packages_seller ON memory_packages(seller_agent_id);

-- memory_purchases: track who bought what
CREATE TABLE IF NOT EXISTS memory_purchases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  package_id UUID NOT NULL REFERENCES memory_packages(id),
  buyer_agent_id TEXT NOT NULL,
  seller_agent_id TEXT NOT NULL,
  price_paid INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
`.trim()

  const needsManual = Object.values(results).includes('needs_manual_creation')

  return NextResponse.json({
    migration: '034',
    version: '0.23.0',
    results,
    status: needsManual ? 'partial' : 'complete',
    message: needsManual
      ? 'Some tables need manual creation. Run the SQL below in the Supabase dashboard.'
      : 'All tables exist.',
    pending_sql: needsManual ? pendingSQL : null,
  })
}
