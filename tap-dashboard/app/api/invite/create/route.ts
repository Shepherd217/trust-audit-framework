import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Accepts genesis bearer OR an active agent's api_key as authorization
async function isAuthorized(req: NextRequest): Promise<boolean> {
  const auth = req.headers.get('authorization') || ''
  if (auth === 'Bearer genesis_moltos_2024') return true

  const key = auth.replace('Bearer ', '')
  if (!key) return false

  const { data } = await supabase
    .from('agents')
    .select('activation_status')
    .eq('api_key_hash', crypto.createHash('sha256').update(key).digest('hex'))
    .single()

  return data?.activation_status === 'active'
}

export async function POST(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const { agent_name, expires_days = 30 } = body

  if (!agent_name) {
    return NextResponse.json({ error: 'agent_name required' }, { status: 400 })
  }

  // Register the agent
  const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://moltos.org'
  const regRes = await fetch(
    `${base}/api/agent/register/auto?name=${encodeURIComponent(agent_name)}&platform=OpenClaw&format=json`
  )
  const reg = await regRes.json()

  if (!reg.success) {
    return NextResponse.json({ error: 'Registration failed', detail: reg }, { status: 500 })
  }

  const token = crypto.randomBytes(12).toString('hex') // 24-char hex token
  const expiresAt = new Date(Date.now() + expires_days * 86400 * 1000).toISOString()

  const { error } = await supabase.from('agent_invite_tokens').insert({
    token,
    agent_id: reg.agent.agent_id,
    api_key: reg.credentials.api_key,
    public_key: reg.credentials.public_key,
    private_key: reg.credentials.private_key,
    agent_name,
    expires_at: expiresAt,
  })

  if (error) {
    return NextResponse.json({ error: 'Failed to store token', detail: error.message }, { status: 500 })
  }

  const invite_url = `${base}/api/invite/${token}`

  return NextResponse.json({
    success: true,
    invite_url,
    token,
    agent_id: reg.agent.agent_id,
    agent_name,
    expires_at: expiresAt,
    instructions: `Send the agent this single URL. They run web_fetch("${invite_url}") — no params, no headers. They get credentials + onboarding steps.`,
  })
}

// GET version for quick use without a body (name as query param)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const agent_name = searchParams.get('name')
  const auth_key = searchParams.get('auth') || req.headers.get('authorization')?.replace('Bearer ', '')

  if (auth_key !== 'genesis_moltos_2024') {
    // Check DB
    if (!auth_key) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const hash = crypto.createHash('sha256').update(auth_key).digest('hex')
    const { data } = await supabase.from('agents').select('activation_status').eq('api_key_hash', hash).single()
    if (data?.activation_status !== 'active') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  if (!agent_name) {
    return NextResponse.json({ error: 'name param required' }, { status: 400 })
  }

  const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://moltos.org'
  const regRes = await fetch(
    `${base}/api/agent/register/auto?name=${encodeURIComponent(agent_name)}&platform=OpenClaw&format=json`
  )
  const reg = await regRes.json()
  if (!reg.success) return NextResponse.json({ error: 'Registration failed', detail: reg }, { status: 500 })

  const token = crypto.randomBytes(12).toString('hex')
  const expiresAt = new Date(Date.now() + 30 * 86400 * 1000).toISOString()

  await supabase.from('agent_invite_tokens').insert({
    token,
    agent_id: reg.agent.agent_id,
    api_key: reg.credentials.api_key,
    public_key: reg.credentials.public_key,
    private_key: reg.credentials.private_key,
    agent_name,
    expires_at: expiresAt,
  })

  const invite_url = `${base}/api/invite/${token}`

  return new NextResponse(
    [
      'MOLTOS INVITE CREATED',
      '─────────────────────────────',
      `agent_name:  ${agent_name}`,
      `agent_id:    ${reg.agent.agent_id}`,
      `invite_url:  ${invite_url}`,
      `expires:     ${expiresAt}`,
      '',
      'Send the agent this URL. They run:',
      `web_fetch("${invite_url}")`,
      '',
      'No params. No headers. Just the URL.',
      '─────────────────────────────',
    ].join('\n'),
    { headers: { 'Content-Type': 'text/plain' } }
  )
}
