export const dynamic = 'force-dynamic';
import { applyRateLimit } from '@/lib/security'
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { verifyClawIDSignature } from '@/lib/clawid-auth'
import { createHash } from 'crypto'
import { createTypedClient } from '@/lib/database.extensions'

// Lazy Stripe initialization
let stripe: any = null;
function getStripe() {
  if (!stripe && process.env.STRIPE_SECRET_KEY) {
    const Stripe = require('stripe');
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2026-02-25.clover',
    });
  }
  return stripe;
}

function getServiceClient() {
  return createTypedClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const _rl = await applyRateLimit(request, 'critical')
    if (_rl.response) return _rl.response

    const { id } = await params
    const body = await request.json()
    const {
      application_id,
      hirer_public_key,
      hirer_signature,
      timestamp,
    } = body

    if (!application_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const sb = getServiceClient()

    // ── Auth path A: API key in Bearer header (agent auth) ──────────────────
    const authHeader = request.headers.get('authorization') || ''
    const apiKey = authHeader.replace(/^Bearer\s+/i, '').trim()
    let hirerAgentId: string | null = null

    if (apiKey.startsWith('moltos_sk_')) {
      const hash = createHash('sha256').update(apiKey).digest('hex')
      const { data: agentRow } = await sb
        .from('agent_registry')
        .select('agent_id, name, public_key')
        .eq('api_key_hash', hash)
        .maybeSingle()
      if (agentRow) hirerAgentId = agentRow.agent_id
    }

    // ── Auth path B: Ed25519 ClawID signature ───────────────────────────────
    if (!hirerAgentId) {
      if (!hirer_public_key || !hirer_signature) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
      }
      const payload = { job_id: id, application_id, timestamp }
      const verification = await verifyClawIDSignature(hirer_public_key, hirer_signature, payload)
      if (!verification.valid) {
        return NextResponse.json({ error: verification.error || 'Invalid ClawID signature' }, { status: 401 })
      }
    }

    // Get job details
    const jobResult = await sb
      .from('marketplace_jobs')
      .select('id, budget, hirer_id, hirer_public_key, status, title')
      .eq('id', id)
      .maybeSingle()

    const job = jobResult.data

    if (jobResult.error || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // Verify hirer owns this job (API key path uses agent_id, Ed25519 path uses public_key)
    if (hirerAgentId) {
      if (job.hirer_id !== hirerAgentId) {
        return NextResponse.json({ error: 'Only the hirer can hire for this job' }, { status: 403 })
      }
    } else {
      if (job.hirer_public_key !== hirer_public_key) {
        return NextResponse.json({ error: 'Only the hirer can hire for this job' }, { status: 403 })
      }
    }

    // Get application details
    const appResult = await sb
      .from('marketplace_applications')
      .select('id, job_id, applicant_id, applicant_public_key, status, proposal')
      .eq('id', application_id)
      .eq('job_id', id)
      .maybeSingle()

    const application = appResult.data

    if (appResult.error || !application) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    // Get applicant details — check both tables
    let applicant: { agent_id: string; name: string; public_key: string } | null = null
    const legacyApplicant = await sb
      .from('agents')
      .select('agent_id, name, public_key')
      .eq('agent_id', application.applicant_id ?? '')
      .maybeSingle()
    if (legacyApplicant.data) {
      applicant = { ...legacyApplicant.data, name: legacyApplicant.data.name ?? '' }
    } else {
      const regApplicant = await sb
        .from('agent_registry')
        .select('agent_id, name, public_key')
        .eq('agent_id', application.applicant_id ?? '')
        .maybeSingle()
      if (regApplicant.data) applicant = { ...regApplicant.data, name: regApplicant.data.name ?? '' }
    }

    if (!applicant) {
      return NextResponse.json({ error: 'Applicant not found' }, { status: 404 })
    }

    // Use hirer_public_key from job row if not supplied in body
    const resolvedHirerPubKey = hirer_public_key || job.hirer_public_key || hirerAgentId || ''
    const resolvedHirerSig    = hirer_signature  || `api_key_hire_${Date.now()}`

    // Create contract record
    const contractResult = await sb
      .from('marketplace_contracts')
      .insert({
        job_id: id,
        hirer_id: job.hirer_id,
        hirer_public_key: resolvedHirerPubKey,
        hirer_signature:  resolvedHirerSig,
        worker_id: application.applicant_id,
        worker_public_key: application.applicant_public_key,
        agreed_budget: job.budget,
        status: 'active',
      })
      .select()
      .maybeSingle()

    const contract = contractResult.data

    if (contractResult.error || !contract) {
      console.error('Failed to create contract:', contractResult.error)
      return NextResponse.json({ error: 'Failed to create contract' }, { status: 500 })
    }

    // Update job status
    await sb
      .from('marketplace_jobs')
      .update({ status: 'filled', hired_agent_id: application.applicant_id })
      .eq('id', id)

    // Update application status
    await sb
      .from('marketplace_applications')
      .update({ status: 'accepted' })
      .eq('id', application_id)

    // Create Stripe PaymentIntent with ClawID metadata
    const stripeClient = getStripe();
    let paymentIntent = null;
    if (stripeClient) {
      try {
        paymentIntent = await stripeClient.paymentIntents.create({
          amount: Math.round(job.budget * 100),
          currency: 'usd',
          capture_method: 'manual',
          metadata: {
            contract_id: contract.id,
            job_id: id,
            hirer_clawid: resolvedHirerPubKey,
            worker_clawid: application.applicant_public_key,
          },
        });
      } catch (stripeErr) {
        console.error('Stripe PI creation failed (non-fatal):', stripeErr)
      }
    }

    // Fire webhooks
    try {
      const { deliverWebhook } = await import('@/lib/webhooks')
      deliverWebhook(application.applicant_id ?? '', 'job.hired', {
        contract_id: contract.id,
        job_id: id,
        job_title: job.title,
        budget: job.budget,
        hirer_id: job.hirer_id,
      }).catch(() => null)
    } catch {} // intentional

    return NextResponse.json({
      success: true,
      contract: {
        id: contract.id,
        job_id: contract.job_id,
        status: contract.status,
        worker: {
          id: applicant.agent_id,
          name: applicant.name,
        },
      },
      payment_intent: paymentIntent ? {
        id: paymentIntent.id,
        client_secret: paymentIntent.client_secret,
      } : null,
    })
  } catch (error) {
    console.error('Marketplace hire error:', error)
    return NextResponse.json({ error: 'Failed to hire applicant' }, { status: 500 })
  }
}
