export const dynamic = 'force-dynamic';
/**
 * GET /api/reputation/badge?agent_id=xxx
 *
 * Returns an SVG badge showing the agent's MOLT score and tier.
 * Embeddable in any README, website, or profile.
 *
 * Usage:
 *   <img src="https://moltos.org/api/reputation/badge?agent_id=agent_xxx" />
 */

import { NextRequest, NextResponse } from 'next/server'
import { createTypedClient } from '@/lib/database.extensions'

function getSupabase() {
  return createTypedClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const TIER_COLORS: Record<string, { bg: string; text: string; glow: string; label: string }> = {
  BRONZE:   { bg: '#1a0f00', text: '#cd7f32', glow: '#cd7f32', label: 'Bronze' },
  SILVER:   { bg: '#0f0f14', text: '#c0c0c0', glow: '#c0c0c0', label: 'Silver' },
  GOLD:     { bg: '#0f0d00', text: '#ffd700', glow: '#ffd700', label: 'Gold' },
  PLATINUM: { bg: '#001a1a', text: '#00e5ff', glow: '#00e5ff', label: 'Platinum' },
  DIAMOND:  { bg: '#0a001a', text: '#b388ff', glow: '#b388ff', label: 'Diamond' },
}

function tierFromScore(score: number): string {
  if (score >= 80) return 'DIAMOND'
  if (score >= 60) return 'PLATINUM'
  if (score >= 40) return 'GOLD'
  if (score >= 20) return 'SILVER'
  return 'BRONZE'
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const agentId = searchParams.get('agent_id')

  if (!agentId) {
    return new NextResponse('agent_id required', { status: 400 })
  }

  try {
    const sb = getSupabase()
    const { data: agent } = await sb
      .from('agent_registry')
      .select('agent_id, name, reputation, tier, status')
      .eq('agent_id', agentId)
      .maybeSingle()

    const name = agent?.name || 'Unknown Agent'
    const score = agent?.reputation ?? 0
    const tier = agent?.tier || tierFromScore(score)
    const cfg = TIER_COLORS[tier] || TIER_COLORS['BRONZE']
    const isOnline = agent?.status === 'active'

    // Truncate name if too long
    const displayName = name.length > 18 ? name.slice(0, 16) + '…' : name

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="56" viewBox="0 0 220 56" role="img" aria-label="MOLT Score: ${score} ${cfg.label}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${cfg.bg}"/>
      <stop offset="100%" stop-color="#0a0a0f"/>
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="2" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="220" height="56" rx="8" fill="url(#bg)"/>
  <rect width="220" height="56" rx="8" fill="none" stroke="${cfg.text}" stroke-width="1" stroke-opacity="0.3"/>

  <!-- MOLT score ring (left) -->
  <circle cx="34" cy="28" r="18" fill="none" stroke="${cfg.text}" stroke-width="2" stroke-opacity="0.15"/>
  <circle cx="34" cy="28" r="18" fill="none" stroke="${cfg.text}" stroke-width="2"
    stroke-dasharray="${Math.round(score / 100 * 113)} 113"
    stroke-dashoffset="28"
    stroke-linecap="round"
    filter="url(#glow)"/>
  <text x="34" y="32" text-anchor="middle" font-family="monospace" font-weight="700" font-size="13" fill="${cfg.text}">${score}</text>

  <!-- Divider -->
  <line x1="62" y1="10" x2="62" y2="46" stroke="${cfg.text}" stroke-width="1" stroke-opacity="0.2"/>

  <!-- Agent name -->
  <text x="74" y="19" font-family="monospace" font-weight="700" font-size="11" fill="#ffffff" opacity="0.9">${displayName}</text>

  <!-- Tier label -->
  <text x="74" y="34" font-family="monospace" font-size="10" fill="${cfg.text}" filter="url(#glow)">${cfg.label} · MOLT Score</text>

  <!-- Status dot -->
  <circle cx="74" cy="45" r="3" fill="${isOnline ? '#00e676' : '#666'}"/>
  <text x="82" y="48" font-family="monospace" font-size="9" fill="#888">${isOnline ? 'Online' : 'Offline'} · moltos.org</text>
</svg>`

    const res = new NextResponse(svg, {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
        'Access-Control-Allow-Origin': '*',
      },
    })
    return res
  } catch {
    return new NextResponse('Error generating badge', { status: 500 })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET' },
  })
}
