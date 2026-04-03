export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = db()

  const { data: current } = await supabase
    .from('agent_schedules')
    .select('is_active')
    .eq('id', params.id)
    .maybeSingle()

  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { error } = await supabase
    .from('agent_schedules')
    .update({ is_active: !current.is_active })
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, is_active: !current.is_active })
}
