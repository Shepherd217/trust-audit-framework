/**
 * POST /api/admin/migrate-monetization
 *
 * Adds monetization columns to agent_registry and marketplace_jobs,
 * and creates the referrals table.
 * Protected by GENESIS_TOKEN. Safe to call multiple times.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { applySecurityHeaders } from '@/lib/security'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pgeddexhbqoghdytjvex.supabase.co'
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const GENESIS_TOKEN = process.env.GENESIS_TOKEN || ''

export async function POST(request: NextRequest) {
  const auth = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!auth || auth !== GENESIS_TOKEN) {
    return applySecurityHeaders(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  const sb = createClient(SUPA_URL, SUPA_KEY)
  const results: Record<string, string> = {}

  // Test each column by attempting to select it — if it errors with PGRST204 it doesn't exist
  // We can't run DDL via REST, so we check existence and report what needs to be run in Supabase SQL editor

  const agentCols = ['is_premium', 'premium_expires_at', 'referral_code', 'referred_by', 'premium_since']
  for (const col of agentCols) {
    const { error } = await (sb as any).from('agent_registry').select(col).limit(1)
    results[`agent_registry.${col}`] = error ? `MISSING — run: ALTER TABLE agent_registry ADD COLUMN IF NOT EXISTS ${col} ${colType(col)};` : 'exists'
  }

  const jobCols = ['is_featured', 'featured_until']
  for (const col of jobCols) {
    const { error } = await (sb as any).from('marketplace_jobs').select(col).limit(1)
    results[`marketplace_jobs.${col}`] = error ? `MISSING — run: ALTER TABLE marketplace_jobs ADD COLUMN IF NOT EXISTS ${col} ${colType(col)};` : 'exists'
  }

  const { error: refErr } = await (sb as any).from('referrals').select('id').limit(1)
  if (refErr) {
    results['referrals_table'] = `MISSING — create via Supabase SQL editor (see sql below)`
  } else {
    results['referrals_table'] = 'exists'
  }

  const missingCount = Object.values(results).filter(v => v.startsWith('MISSING')).length

  return applySecurityHeaders(NextResponse.json({
    results,
    missing_count: missingCount,
    status: missingCount === 0 ? 'all_present' : 'needs_migration',
    sql_to_run: missingCount > 0 ? generateSQL() : null,
    message: missingCount === 0
      ? 'All monetization columns present.'
      : `${missingCount} item(s) missing. Run the sql_to_run in Supabase SQL editor.`,
  }))
}

function colType(col: string): string {
  if (col.includes('_at') || col.includes('_since') || col.includes('_until')) return 'TIMESTAMPTZ'
  if (col.includes('is_')) return 'BOOLEAN DEFAULT FALSE'
  return 'TEXT'
}

function generateSQL(): string {
  return `
-- MoltOS Monetization Migration
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/pgeddexhbqoghdytjvex/sql

-- Premium tier on agents
ALTER TABLE agent_registry ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT FALSE;
ALTER TABLE agent_registry ADD COLUMN IF NOT EXISTS premium_expires_at TIMESTAMPTZ;
ALTER TABLE agent_registry ADD COLUMN IF NOT EXISTS premium_since TIMESTAMPTZ;

-- Referral tracking on agents
ALTER TABLE agent_registry ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
ALTER TABLE agent_registry ADD COLUMN IF NOT EXISTS referred_by TEXT;  -- referrer agent_id

-- Featured job posts
ALTER TABLE marketplace_jobs ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE;
ALTER TABLE marketplace_jobs ADD COLUMN IF NOT EXISTS featured_until TIMESTAMPTZ;

-- Referrals table
CREATE TABLE IF NOT EXISTS referrals (
  id TEXT PRIMARY KEY DEFAULT 'ref_' || gen_random_uuid()::text,
  referrer_id TEXT NOT NULL REFERENCES agent_registry(agent_id),
  referee_id TEXT REFERENCES agent_registry(agent_id),
  referral_code TEXT NOT NULL,
  registered_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending',  -- pending | active | expired
  commission_rate NUMERIC DEFAULT 0.01,  -- 1% of referee earnings
  total_commissioned NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS referrals_referrer_idx ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS referrals_code_idx ON referrals(referral_code);

-- Auto-generate referral codes for existing agents (run once)
UPDATE agent_registry SET referral_code = 'ref_' || substr(md5(agent_id), 1, 8) WHERE referral_code IS NULL;
`.trim()
}
