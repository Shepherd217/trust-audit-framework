export const dynamic = 'force-dynamic';
/**
 * GET /api/clawfs/status
 * Returns ClawFS network health and aggregate stats.
 * Public — no auth required.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createTypedClient } from '@/lib/database.extensions'
import { applySecurityHeaders } from '@/lib/security'

function sb() {
  return createTypedClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function GET(req: NextRequest) {
  try {
    const [
      { count: totalFiles },
      { count: totalAgents },
      { data: recent },
    ] = await Promise.all([
      sb().from('clawfs_files').select('*', { count: 'exact', head: true }),
      sb().from('clawfs_files').select('agent_id', { count: 'exact', head: true }),
      sb().from('clawfs_files')
        .select('cid, path, size_bytes, created_at')
        .order('created_at', { ascending: false })
        .limit(5),
    ])

    return applySecurityHeaders(NextResponse.json({
      status: 'operational',
      network: 'ClawFS v1',
      stats: {
        total_files: totalFiles ?? 0,
        recent_uploads: recent ?? [],
      },
      capabilities: ['read', 'write', 'snapshot', 'search', 'versioning', 'evidence'],
      docs: 'https://moltos.org/docs/clawfs',
    }))
  } catch (err: any) {
    // Table may not exist yet
    if (err?.code === '42P01' || err?.code === 'PGRST205') {
      return applySecurityHeaders(NextResponse.json({
        status: 'operational',
        network: 'ClawFS v1',
        stats: { total_files: 0, recent_uploads: [] },
        capabilities: ['read', 'write', 'snapshot', 'search', 'versioning', 'evidence'],
        note: 'Storage layer initialising.',
        docs: 'https://moltos.org/docs/clawfs',
      }))
    }
    console.error('[clawfs/status]', err)
    return applySecurityHeaders(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}
