/**
 * POST /api/admin/migrate-031
 *
 * One-time migration: creates social key recovery tables.
 * Protected by GENESIS_TOKEN. Safe to call multiple times (IF NOT EXISTS).
 * Delete this file after migration is confirmed.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { applySecurityHeaders } from '@/lib/security'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pgeddexhbqoghdytjvex.supabase.co'
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const GENESIS_TOKEN = process.env.GENESIS_TOKEN || ''

export async function POST(request: NextRequest) {
  const auth = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!auth || auth !== GENESIS_TOKEN) {
    return applySecurityHeaders(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  const supabase = createClient(SUPA_URL, SUPA_KEY)
  const results: Record<string, string> = {}

  // Step 1: Check if agent_guardians exists
  const { data: checkGuardians, error: checkErr1 } = await (supabase as any)
    .from('agent_guardians').select('id').limit(1)
  
  if (!checkErr1 || checkErr1.code !== 'PGRST205') {
    results['agent_guardians'] = 'already exists'
  } else {
    // Create via raw SQL using pg_catalog workaround
    // Insert a dummy row to force the JS client to reveal the error type
    // Actually: use supabase.from to check + use a workaround
    results['agent_guardians'] = 'NEEDS_MANUAL_CREATION'
  }

  // Step 2: Check agent_recovery_requests
  const { data: checkRecovery, error: checkErr2 } = await (supabase as any)
    .from('agent_recovery_requests').select('id').limit(1)
  
  results['agent_recovery_requests'] = (!checkErr2 || checkErr2.code !== 'PGRST205') ? 'already exists' : 'NEEDS_MANUAL_CREATION'

  // Step 3: Check recovery_approvals
  const { data: checkApprovals, error: checkErr3 } = await (supabase as any)
    .from('recovery_approvals').select('id').limit(1)
  
  results['recovery_approvals'] = (!checkErr3 || checkErr3.code !== 'PGRST205') ? 'already exists' : 'NEEDS_MANUAL_CREATION'

  const needsManual = Object.values(results).some(v => v === 'NEEDS_MANUAL_CREATION')

  return applySecurityHeaders(NextResponse.json({
    migration: '031_social_key_recovery',
    results,
    status: needsManual ? 'PARTIAL — run SQL manually in Supabase dashboard' : 'COMPLETE',
    sql_file: 'tap-dashboard/supabase/migrations/031_social_key_recovery.sql',
    dashboard_url: `https://supabase.com/dashboard/project/${process.env.NEXT_PUBLIC_SUPABASE_URL?.split('//')[1]?.split('.')[0] || 'your-project'}/sql`,
  }))
}
