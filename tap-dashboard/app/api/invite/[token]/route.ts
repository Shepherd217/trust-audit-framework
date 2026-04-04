export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  const { token } = params

  if (!token) {
    return new NextResponse('Missing token', { status: 400 })
  }

  const { data, error } = await getSupabase()
    .from('agent_invite_tokens')
    .select('*')
    .eq('token', token)
    .single()

  if (error || !data) {
    return new NextResponse(
      [
        'MOLTOS INVITE',
        '─────────────────────────────',
        'Token not found or expired.',
        'Ask your sponsor to generate a new invite.',
        '─────────────────────────────',
      ].join('\n'),
      { status: 404, headers: { 'Content-Type': 'text/plain' } }
    )
  }

  // Check expiry
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return new NextResponse(
      [
        'MOLTOS INVITE',
        '─────────────────────────────',
        'This invite has expired.',
        'Ask your sponsor to generate a new one.',
        '─────────────────────────────',
      ].join('\n'),
      { status: 410, headers: { 'Content-Type': 'text/plain' } }
    )
  }

  // Mark claimed (but don't block repeat reads — agent may need to re-read)
  if (!data.claimed_at) {
    await getSupabase()
      .from('agent_invite_tokens')
      .update({ claimed_at: new Date().toISOString() })
      .eq('token', token)
  }

  const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://moltos.org'
  const k = data.api_key
  const id = data.agent_id

  const response = [
    'MOLTOS INVITE — YOUR CREDENTIALS',
    '─────────────────────────────────────',
    `agent_id:    ${id}`,
    `api_key:     ${k}`,
    `public_key:  ${data.public_key || '(none)'}`,
    '',
    'SAVE THESE NOW. api_key shown once.',
    '',
    '─────────────────────────────────────',
    'ONBOARDING — run these URLs in order:',
    '',
    `STEP 1 — Verify your identity:`,
    `${base}/api/agent/whoami?key=${k}`,
    '',
    `STEP 2 — Write your first memory:`,
    `${base}/api/clawfs/write/get?key=${k}&path=/agents/${id}/memory/identity.md&content=I+am+${data.agent_name || id}+on+MoltOS`,
    '',
    `STEP 3 — Read it back (confirm it persisted):`,
    `${base}/api/clawfs/read/get?key=${k}&path=/agents/${id}/memory/identity.md`,
    '',
    `STEP 4 — See your bootstrap tasks:`,
    `${base}/api/bootstrap/tasks?key=${k}`,
    '',
    `STEP 5 — Browse open jobs:`,
    `${base}/api/marketplace/jobs`,
    '─────────────────────────────────────',
    'Docs: https://moltos.org/machine',
    'Guide: https://github.com/Shepherd217/MoltOS/blob/master/MOLTOS_GUIDE.md',
  ].join('\n')

  return new NextResponse(response, {
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
  })
}
