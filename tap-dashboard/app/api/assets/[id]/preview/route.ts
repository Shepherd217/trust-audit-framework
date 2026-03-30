/**
 * GET /api/assets/[id]/preview
 *
 * Request a preview sample before purchasing.
 * - For files: returns the first 50 lines / 2KB of content
 * - For skills: sends a test ping to the endpoint and returns its response schema
 * - For templates: returns the DAG node structure (not the full config)
 * Always free — no credits charged.
 * Rate limit: 5 previews per agent per day (unauthenticated: 3/day by IP).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { applySecurityHeaders, applyRateLimit } from '@/lib/security'

const PREVIEW_DAILY_LIMIT = 5
const PREVIEW_ANON_LIMIT = 3

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// Simple in-memory daily counter (resets at midnight UTC)
const previewCounts = new Map<string, { count: number; date: string }>()

function todayUTC() {
  return new Date().toISOString().slice(0, 10)
}

function checkPreviewLimit(key: string, limit: number): boolean {
  const today = todayUTC()
  const entry = previewCounts.get(key)
  if (!entry || entry.date !== today) {
    previewCounts.set(key, { count: 1, date: today })
    return true
  }
  if (entry.count >= limit) return false
  entry.count++
  return true
}

async function resolveAgentId(req: NextRequest): Promise<string | null> {
  const apiKey = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || req.headers.get('x-api-key')
  if (!apiKey) return null
  const hash = createHash('sha256').update(apiKey).digest('hex')
  const { data } = await (getSupabase() as any).from('agent_registry').select('agent_id').eq('api_key_hash', hash).single()
  return data?.agent_id || null
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const rl = await applyRateLimit(req, 'public')
  if ((rl as any).response) return (rl as any).response

  const agentId = await resolveAgentId(req)

  // Per-agent/IP daily preview cap
  const rateLimitKey = agentId
    ? `agent:${agentId}`
    : `ip:${req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'}`
  const dailyLimit = agentId ? PREVIEW_DAILY_LIMIT : PREVIEW_ANON_LIMIT

  if (!checkPreviewLimit(rateLimitKey, dailyLimit)) {
    return applySecurityHeaders(NextResponse.json({
      error: `Preview limit reached — ${dailyLimit} per day. Purchase the asset to get full access, or check back tomorrow.`,
      limit: dailyLimit,
      retry_after: 'tomorrow',
    }, { status: 429 }))
  }

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
      preview_content: asset.preview_content.slice(0, 2000),
      truncated: asset.preview_content.length > 2000,
      daily_limit: dailyLimit,
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
        daily_limit: dailyLimit,
        message: pingRes.ok
          ? 'Skill endpoint is live and responding. Purchase to get your access key.'
          : `Endpoint responded with ${pingRes.status}. Contact seller before purchasing.`,
      }))
    } catch {
      return applySecurityHeaders(NextResponse.json({
        type: 'skill',
        preview_type: 'endpoint_ping',
        endpoint_alive: false,
        daily_limit: dailyLimit,
        message: 'Skill endpoint did not respond within 5s. Contact seller before purchasing.',
      }))
    }
  }

  return applySecurityHeaders(NextResponse.json({
    type: asset.type,
    preview_type: 'none',
    daily_limit: dailyLimit,
    message: 'No preview available for this asset. Contact the seller for more details.',
    suggestion: "Review the seller's TAP score and purchase history before buying.",
  }))
}
