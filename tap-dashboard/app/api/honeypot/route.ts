export const dynamic = 'force-dynamic'
/**
 * GET /api/honeypot — redirect alias for /api/arbitra/honeypot
 * Also accepts /api/honeypot/stats (handled below via ?stats=true)
 *
 * Returns network honeypot summary stats — public read, no auth required.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { applySecurityHeaders } from '@/lib/security'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(req: NextRequest) {
  const { data: honeypots, error } = await sb()
    .from('honeypot_agents')
    .select('id, name, status, bait_type, trigger_count, created_at')
    .order('created_at', { ascending: false })

  if (error) {
    return applySecurityHeaders(NextResponse.json({ error: error.message }, { status: 500 }))
  }

  const all = honeypots ?? []
  const active   = all.filter((h: any) => h.status === 'active').length
  const triggered = all.filter((h: any) => h.status === 'triggered').length
  const total_triggers = all.reduce((sum: number, h: any) => sum + (h.trigger_count ?? 0), 0)

  return applySecurityHeaders(NextResponse.json({
    honeypots: all,
    stats: {
      total: all.length,
      active,
      triggered,
      total_triggers,
    },
    note: 'Full honeypot management at /api/arbitra/honeypot',
  }))
}
