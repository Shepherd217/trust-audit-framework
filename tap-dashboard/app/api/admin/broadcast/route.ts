export const dynamic = 'force-dynamic';
/**
 * POST /api/admin/broadcast
 *
 * Sends a ClawBus message from MOLTOS_PLATFORM to every registered agent.
 * Used for platform-wide notices: SDK updates, deprecation warnings, incidents.
 *
 * Auth: GENESIS_TOKEN only (Authorization: Bearer <token>)
 *
 * Body:
 *   type     — message type, e.g. "platform.notice" | "platform.sdk_update" | "platform.incident"
 *   subject  — short headline (shown in /inbox)
 *   body     — full message text
 *   version  — (optional) new SDK version string, e.g. "0.22.0"
 *   severity — (optional) "info" | "warning" | "critical"  (default: "info")
 *   url      — (optional) link to docs / release notes
 *
 * Response:
 *   { sent: number, failed: number, message_type: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getClawBusService } from '@/lib/claw/bus'
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

const PLATFORM_AGENT_ID = 'MOLTOS_PLATFORM'

function getSupabase() {
  return createTypedClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  // Auth — GENESIS_TOKEN only
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token || token !== process.env.GENESIS_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const {
    type = 'platform.notice',
    subject,
    body: messageBody,
    version,
    severity = 'info',
    url,
  } = body

  if (!subject || !messageBody) {
    return NextResponse.json({ error: 'subject and body are required' }, { status: 400 })
  }

  // Fetch all active agent IDs
  const supabase = getSupabase()
  const { data: agents, error } = await supabase
    .from('agent_registry')
    .select('agent_id')
    .eq('is_suspended', false)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!agents || agents.length === 0) {
    return NextResponse.json({ sent: 0, failed: 0, message_type: type })
  }

  const service = getClawBusService()
  const payload = {
    subject,
    body: messageBody,
    severity,
    ...(version && { version }),
    ...(url && { url }),
    timestamp: new Date().toISOString(),
  }

  let sent = 0
  let failed = 0

  // Fan out — send one message per agent
  await Promise.allSettled(
    agents.map(async ({ agent_id }: { agent_id: string }) => {
      try {
        const envelope = service.createEnvelope(
          PLATFORM_AGENT_ID,
          agent_id,
          type,
          payload,
          { priority: severity === 'critical' ? 'critical' : severity === 'warning' ? 'high' : 'normal' }
        )
        await service.send(envelope)
        sent++
      } catch {
        failed++
      }
    })
  )

  return NextResponse.json({ sent, failed, message_type: type })
}
