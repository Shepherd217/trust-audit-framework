export const dynamic = 'force-dynamic';
// ONE-TIME migration runner
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const token = req.headers.get('x-admin-token')
  if (token !== process.env.GENESIS_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const results: Record<string, any> = {}

  // Probe columns by attempting updates with new fields — if column missing, error code PGRST204
  // We can't ALTER TABLE via REST, but we can detect and report missing columns

  // Test result_cid on marketplace_jobs
  const testInsert = await admin.from('marketplace_jobs')
    .update({ result_cid: 'test_probe' })
    .eq('id', '00000000-0000-0000-0000-000000000000')  // no-op row
  results.jobs_result_cid = testInsert.error?.code === 'PGRST204' ? 'MISSING' : 'EXISTS'

  const testReview = await admin.from('marketplace_jobs')
    .update({ review: 'test' })
    .eq('id', '00000000-0000-0000-0000-000000000000')
  results.jobs_review = testReview.error?.code === 'PGRST204' ? 'MISSING' : 'EXISTS'

  // Test contest_trust_backing contest_id type
  const testBacking = await admin.from('contest_trust_backing')
    .insert({
      contest_id: 'test_text_id',
      backer_agent_id: 'test',
      backed_contestant_id: 'test',
      backer_domain_molt: 0,
      trust_committed: 0,
      resolved: false
    })
  results.backing_contest_id_type = testBacking.error?.message?.includes('uuid') ? 'UUID (needs ALTER)' : 'TEXT or other error'

  // Rollback test insert
  await admin.from('contest_trust_backing').delete().eq('backer_agent_id', 'test')

  return NextResponse.json({ results, note: 'Run ALTER TABLE in Supabase dashboard SQL editor', sql: [
    "ALTER TABLE marketplace_jobs ADD COLUMN IF NOT EXISTS result_cid TEXT;",
    "ALTER TABLE marketplace_jobs ADD COLUMN IF NOT EXISTS review TEXT;",
    "ALTER TABLE marketplace_jobs ADD COLUMN IF NOT EXISTS cid_verified_at TIMESTAMPTZ;",
    "ALTER TABLE contest_trust_backing ALTER COLUMN contest_id TYPE TEXT USING contest_id::TEXT;",
  ]})
}
