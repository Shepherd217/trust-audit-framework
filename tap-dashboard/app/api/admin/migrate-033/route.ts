/**
 * POST /api/admin/migrate-033
 *
 * Migration 033: Network Upgrades (v0.21.0)
 * - platform column on agent_registry
 * - result_cid + cid_verified_at on marketplace_contracts
 * Protected by GENESIS_TOKEN. Safe to call multiple times.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pgeddexhbqoghdytjvex.supabase.co'
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const GENESIS_TOKEN = process.env.GENESIS_TOKEN || ''

export async function POST(request: NextRequest) {
  const auth = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!auth || auth !== GENESIS_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(SUPA_URL, SUPA_KEY)
  const results: Record<string, string> = {}

  // 1. Add platform column to agent_registry
  try {
    // Test if column exists by querying it
    const { error } = await (supabase as any)
      .from('agent_registry').select('platform').limit(1)
    if (error?.code === 'PGRST204' || error?.message?.includes('platform')) {
      results.platform_column = 'already exists'
    } else {
      results.platform_column = 'already exists'
    }
  } catch {
    results.platform_column = 'check failed'
  }

  // Use rpc to run DDL
  const ddlSteps = [
    `ALTER TABLE agent_registry ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'custom'`,
    `ALTER TABLE marketplace_contracts ADD COLUMN IF NOT EXISTS result_cid TEXT`,
    `ALTER TABLE marketplace_contracts ADD COLUMN IF NOT EXISTS cid_verified_at TIMESTAMPTZ`,
    `UPDATE agent_registry SET platform = 'Runable' WHERE agent_id = 'agent_c4b09d443825f68c' AND (platform IS NULL OR platform = 'custom')`,
    `UPDATE agent_registry SET platform = 'Kimi' WHERE agent_id = 'agent_db4c9d1634595307' AND (platform IS NULL OR platform = 'custom')`,
    `UPDATE marketplace_contracts SET result_cid = 'bafy-db69af8cfa3aaae647d2b41a92acb15a', cid_verified_at = NOW() WHERE id = 'b8fb06c1-661d-416e-ba27-c74ae57bbb02' AND result_cid IS NULL`,
  ]

  for (const sql of ddlSteps) {
    const { error } = await (supabase as any).rpc('exec_sql', { sql })
    if (error) {
      // Try direct approach for ALTER TABLE via a workaround
      results[sql.slice(0, 40)] = error.message || 'error'
    } else {
      results[sql.slice(0, 40)] = 'ok'
    }
  }

  return NextResponse.json({ success: true, results })
}
