export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET() {
  const { data, error } = await db()
    .from('agent_schedules')
    .select('id, agent_id, schedule_type, interval_minutes, last_run_at, next_run_at, is_active, run_count, created_at')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { agent_id, api_key, schedule_type = 'poll_inbox', interval_minutes = 5 } = body

  if (!agent_id || !api_key) {
    return NextResponse.json({ error: 'agent_id and api_key required' }, { status: 400 })
  }

  const { data, error } = await db()
    .from('agent_schedules')
    .insert({ agent_id, api_key, schedule_type, interval_minutes, is_active: true })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, id: data.id }, { status: 201 })
}
