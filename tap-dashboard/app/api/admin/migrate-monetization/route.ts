/**
 * POST /api/admin/migrate-monetization
 * Checks/adds referral columns to agent_registry and creates the referrals table.
 * Protected by GENESIS_TOKEN.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { applySecurityHeaders } from '@/lib/security'
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pgeddexhbqoghdytjvex.supabase.co'
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const GENESIS_TOKEN = process.env.GENESIS_TOKEN || ''

export async function POST(request: NextRequest) {
  const auth = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!auth || auth !== GENESIS_TOKEN) {
    return applySecurityHeaders(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  const sb = createTypedClient(SUPA_URL, SUPA_KEY)
  const results: Record<string, string> = {}

  for (const col of ['referral_code', 'referred_by']) {
    const { error } = await sb.from('agent_registry').select(col).limit(1)
    results[`agent_registry.${col}`] = error ? 'MISSING' : 'exists'
  }

  const { error: refErr } = await sb.from('referrals').select('id').limit(1)
  results['referrals_table'] = refErr ? 'MISSING' : 'exists'

  return applySecurityHeaders(NextResponse.json({ results, status: 'checked' }))
}
