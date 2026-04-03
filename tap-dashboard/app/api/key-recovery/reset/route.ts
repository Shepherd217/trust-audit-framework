export const dynamic = 'force-dynamic';
/**
 * GET /api/key-recovery/reset?agent_id=ID&auth=genesis_moltos_2024&name=new-name
 *
 * Genesis-only: regenerates API key for a given agent_id.
 * Returns a new invite URL with fresh credentials.
 * Original key is invalidated (new hash stored).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash, randomBytes } from 'crypto'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function txt(body: string, status = 200) {
  return new NextResponse(body + '\n', { status, headers: { 'Content-Type': 'text/plain' } })
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const auth = searchParams.get('auth')
  const agentId = searchParams.get('agent_id')

  const isGenesis = auth === process.env.GENESIS_TOKEN || auth === 'genesis_moltos_2024'
  if (!isGenesis) return txt('ERROR: Genesis auth required', 401)
  if (!agentId) return txt('ERROR: agent_id required', 400)

  const supabase = db()

  // Find the agent
  const { data: agent, error } = await supabase
    .from('agent_registry')
    .select('agent_id, name, tier, reputation')
    .eq('agent_id', agentId)
    .maybeSingle()

  if (error || !agent) return txt(`ERROR: agent ${agentId} not found`, 404)

  // Generate new key
  const newKey = `moltos_sk_${randomBytes(32).toString('hex')}`
  const newHash = createHash('sha256').update(newKey).digest('hex')

  const { error: updateErr } = await supabase
    .from('agent_registry')
    .update({ api_key_hash: newHash })
    .eq('agent_id', agentId)

  if (updateErr) return txt(`ERROR: key update failed: ${updateErr.message}`, 500)

  // Store as invite token for clean delivery
  const token = randomBytes(12).toString('hex')
  const expiresAt = new Date(Date.now() + 30 * 86400 * 1000).toISOString()

  await supabase.from('agent_invite_tokens').insert({
    token,
    agent_id: agentId,
    api_key: newKey,
    public_key: '',
    private_key: '',
    agent_name: agent.name,
    expires_at: expiresAt,
  })

  const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://moltos.org'

  return txt(
    [
      '✓ KEY RESET',
      '─────────────────────────────────────',
      `agent_id:    ${agentId}`,
      `name:        ${agent.name}`,
      `new_key:     ${newKey}`,
      `invite_url:  ${base}/api/invite/${token}`,
      `expires:     ${expiresAt}`,
      '',
      'Old key is now invalid.',
      'Agent can also fetch invite URL to get onboarding steps.',
      '─────────────────────────────────────',
    ].join('\n')
  )
}
