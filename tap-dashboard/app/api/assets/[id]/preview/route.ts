/**
 * POST /api/assets/[id]/preview
 *
 * Request a preview sample before purchasing.
 * - For files: returns the first 50 lines / 2KB of content
 * - For skills: sends a test ping to the endpoint and returns its response schema
 * - For templates: returns the DAG node structure (not the full config)
 * Always free — no credits charged.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { applySecurityHeaders, applyRateLimit } from '@/lib/security'

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const rl = await applyRateLimit(req, 'public')
  if ((rl as any).response) return (rl as any).response

  const sb = getSupabase()

  const { data: asset } = await (sb as any)
    .from('agent_assets')
    .select('id, type, title, preview_content, endpoint_url, clawfs_path, status')
    .eq('id', params.id)
    .single()

  if (!asset) return applySecurityHeaders(NextResponse.json({ error: 'Asset not found' }, { status: 404 }))
  if (asset.status !== 'active') return applySecurityHeaders(NextResponse.json({ error: 'Asset not available' }, { status: 410 }))

  // Seller-provided preview content (truncated)
  if (asset.preview_content) {
    return applySecurityHeaders(NextResponse.json({
      type: asset.type,
      preview_type: 'seller_provided',
      content: asset.preview_content.slice(0, 2000),
      truncated: asset.preview_content.length > 2000,
    }))
  }

  // For skills: ping the endpoint and return its schema/response format
  if (asset.type === 'skill' && asset.endpoint_url) {
    try {
      const pingRes = await fetch(asset.endpoint_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Preview': 'true' },
        body: JSON.stringify({ preview: true }),
        signal: AbortSignal.timeout(5000),
      })
      const pingBody = await pingRes.text().then(t => t.slice(0, 500)).catch(() => '[no response body]')
      return applySecurityHeaders(NextResponse.json({
        type: 'skill',
        preview_type: 'endpoint_ping',
        endpoint_status: pingRes.status,
        endpoint_alive: pingRes.ok || pingRes.status < 500,
        response_preview: pingBody,
        message: pingRes.ok
          ? 'Skill endpoint is live and responding. Purchase to get your access key.'
          : `Endpoint responded with ${pingRes.status}. Contact seller before purchasing.`,
      }))
    } catch {
      return applySecurityHeaders(NextResponse.json({
        type: 'skill',
        preview_type: 'endpoint_ping',
        endpoint_alive: false,
        message: 'Skill endpoint did not respond within 5s. Contact seller before purchasing.',
      }))
    }
  }

  return applySecurityHeaders(NextResponse.json({
    type: asset.type,
    preview_type: 'none',
    message: 'No preview available for this asset. Contact the seller for more details.',
    suggestion: 'Review the seller\'s TAP score and purchase history before buying.',
  }))
}
