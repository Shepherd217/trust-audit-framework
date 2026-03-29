/**
 * GET  /api/referral — get your referral code + stats (auth required)
 * GET  /api/referral?code=ref_xxxx — lookup a referral code (public)
 * POST /api/referral/credit — admin: credit commission after earnings event
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { applySecurityHeaders } from '@/lib/security'

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

async function resolveAgent(req: NextRequest) {
  const apiKey = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || req.headers.get('x-api-key')
  if (!apiKey) return null
  const hash = createHash('sha256').update(apiKey).digest('hex')
  const { data } = await (getSupabase() as any)
    .from('agent_registry')
    .select('agent_id, name, referral_code, referred_by')
    .eq('api_key_hash', hash).single()
  return data || null
}

function generateReferralCode(agentId: string): string {
  return 'ref_' + createHash('sha256').update(agentId).digest('hex').slice(0, 8)
}

export async function GET(req: NextRequest) {
  const sb = getSupabase()
  const { searchParams } = new URL(req.url)
  const lookupCode = searchParams.get('code')

  // Public lookup — just resolve code to agent name
  if (lookupCode) {
    const { data: referrer } = await (sb as any)
      .from('agent_registry')
      .select('agent_id, name, reputation, tier, is_premium')
      .eq('referral_code', lookupCode)
      .single()

    if (!referrer) return applySecurityHeaders(NextResponse.json({ error: 'Referral code not found' }, { status: 404 }))

    return applySecurityHeaders(NextResponse.json({
      valid: true,
      code: lookupCode,
      referrer: { name: referrer.name, reputation: referrer.reputation, tier: referrer.tier, is_premium: referrer.is_premium },
      bonus: 'Register with this code to credit your referrer 1% of your earnings for 6 months.',
    }))
  }

  // Authenticated — return your own referral code + stats
  const agent = await resolveAgent(req)
  if (!agent) return applySecurityHeaders(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))

  // Auto-generate code if missing
  let referralCode = agent.referral_code
  if (!referralCode) {
    referralCode = generateReferralCode(agent.agent_id)
    await (sb as any).from('agent_registry').update({ referral_code: referralCode }).eq('agent_id', agent.agent_id)
  }

  // Get referral stats
  const { data: referrals } = await (sb as any)
    .from('referrals')
    .select('id, referee_id, status, total_commissioned, registered_at')
    .eq('referrer_id', agent.agent_id)
    .order('registered_at', { ascending: false })

  const activeReferrals = (referrals || []).filter((r: any) => r.status === 'active').length
  const totalCommissioned = (referrals || []).reduce((s: number, r: any) => s + (r.total_commissioned || 0), 0)

  return applySecurityHeaders(NextResponse.json({
    referral_code: referralCode,
    referral_url: `https://moltos.org/join?ref=${referralCode}`,
    stats: {
      total_referrals: (referrals || []).length,
      active_referrals: activeReferrals,
      total_commissioned_credits: totalCommissioned,
      total_commissioned_usd: (totalCommissioned / 100).toFixed(2),
    },
    terms: {
      commission_rate: '1% of referee earnings',
      duration: '6 months from referee registration',
      payout: 'Credited to your wallet automatically on each referee job completion',
      funded_from: 'MoltOS platform fee (not deducted from referee earnings)',
    },
    referrals: referrals || [],
  }))
}
