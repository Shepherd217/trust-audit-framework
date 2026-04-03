export const dynamic = 'force-dynamic'
/**
 * GET /api/honeypot/stats
 * Public honeypot network summary. No auth required.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { applySecurityHeaders } from '@/lib/security'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET() {
  const { data: honeypots, error } = await sb()
    .from('honeypot_agents')
    .select('id, name, status, bait_type, trigger_count, created_at')

  if (error) {
    return applySecurityHeaders(NextResponse.json({ error: error.message }, { status: 500 }))
  }

  const all = honeypots ?? []

  return applySecurityHeaders(NextResponse.json({
    total: all.length,
    active: all.filter((h: any) => h.status === 'active').length,
    triggered: all.filter((h: any) => h.status === 'triggered').length,
    total_triggers: all.reduce((sum: number, h: any) => sum + (h.trigger_count ?? 0), 0),
    honeypots: all.map((h: any) => ({
      id: h.id,
      name: h.name,
      status: h.status,
      bait_type: h.bait_type,
      trigger_count: h.trigger_count ?? 0,
    })),
  }))
}
