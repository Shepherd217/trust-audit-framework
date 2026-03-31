import { NextRequest, NextResponse } from 'next/server'
import { flagViolation } from '@/lib/security-violations'
import { createClient } from '@supabase/supabase-js'
import { verifyClawIDSignature } from '@/lib/clawid-auth'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pgeddexhbqoghdytjvex.supabase.co'
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createClient(SUPA_URL, SUPA_KEY)
    const body = await request.json()
    const { proposal, estimated_hours, applicant_public_key, applicant_signature, timestamp } = body

    if (!proposal) {
      return NextResponse.json({ error: 'proposal is required' }, { status: 400 })
    }

    // Auth: API key OR Ed25519 signature
    const apiKeyHeader = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || request.headers.get('x-api-key') ||
      request.headers.get('authorization')?.replace('Bearer ', '')

    let applicant: any = null

    if (apiKeyHeader) {
      const { createHash } = await import('crypto')
      const keyHash = createHash('sha256').update(apiKeyHeader).digest('hex')

      // Check agent_registry first (new agents)
      const { data: regAgent } = await supabase
        .from('agent_registry')
        .select('agent_id, name, reputation, tier')
        .eq('api_key_hash', keyHash)
        .single()

      if (regAgent) {
        applicant = regAgent
      } else {
        return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
      }
    } else {
      // Ed25519 signature auth
      if (!applicant_public_key || !applicant_signature) {
        return NextResponse.json({
          error: 'Missing required fields. Provide X-API-Key header or applicant_public_key + applicant_signature'
        }, { status: 400 })
      }

      const payload: import('@/lib/clawid-auth').ClawIDPayload = {
        job_id: id, proposal, challenge: applicant_signature, timestamp
      }
      const verification = await verifyClawIDSignature(applicant_public_key, applicant_signature, payload)

      if (!verification.valid) {
        return NextResponse.json({ error: verification.error || 'Invalid signature' }, { status: 401 })
      }

      const { data: agentByKey } = await supabase
        .from('agent_registry')
        .select('agent_id, name, reputation, tier')
        .eq('public_key', applicant_public_key)
        .single()

      applicant = agentByKey
      if (!applicant) {
        return NextResponse.json({ error: 'Applicant agent not found' }, { status: 404 })
      }
    }

    // Get job details
    const { data: job } = await supabase
      .from('marketplace_jobs')
      .select('min_tap_score, status')
      .eq('id', id)
      .single()

    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    if (job.status !== 'open') return NextResponse.json({ error: 'Job is no longer open' }, { status: 400 })
    // Block self-application — flag violation
    if (job.hirer_id && (job.hirer_id === applicant?.agent_id)) {
      await flagViolation(applicant.agent_id, 'self_apply', { job_id: id }, '/marketplace/jobs/apply')
      return NextResponse.json({ error: 'Cannot apply to your own job' }, { status: 400 })
    }
    if ((applicant.reputation ?? 0) < (job.min_tap_score ?? 0)) {
      return NextResponse.json({ error: 'Insufficient MOLT score for this job' }, { status: 403 })
    }

    // Create application
    const { data: application, error } = await supabase
      .from('marketplace_applications')
      .insert({
        job_id: id,
        applicant_id: applicant.agent_id,
        applicant_public_key: applicant_public_key || applicant.agent_id,
        applicant_signature: applicant_signature || 'api-key-auth',
        proposal,
        estimated_hours: estimated_hours || null,
        status: 'pending',
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to create application:', error)
      return NextResponse.json({ error: 'Failed to submit application' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      application: {
        id: application.id,
        job_id: application.job_id,
        status: application.status,
        applicant: {
          id: applicant.agent_id,
          name: applicant.name,
          reputation: applicant.reputation,
          tier: applicant.tier,
        },
      },
    })
  } catch (error) {
    console.error('Marketplace apply error:', error)
    return NextResponse.json({ error: 'Failed to submit application' }, { status: 500 })
  }
}
