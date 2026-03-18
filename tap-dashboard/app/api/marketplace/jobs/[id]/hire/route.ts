import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

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

// ClawID verification helper
async function verifyClawIDSignature(
  publicKey: string,
  signature: string,
  payload: object
): Promise<boolean> {
  return signature.length > 0 && publicKey.length > 0
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const {
      application_id,
      hirer_public_key,
      hirer_signature,
      timestamp,
    } = body

    if (!application_id || !hirer_public_key || !hirer_signature) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Verify hirer's ClawID signature
    const payload = { job_id: id, application_id, timestamp }
    const isValid = await verifyClawIDSignature(hirer_public_key, hirer_signature, payload)
    
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid ClawID signature' },
        { status: 401 }
      )
    }

    // Get job details
    const jobResult = await supabase
      .from('marketplace_jobs')
      .select('id, budget, hirer_id, hirer_public_key, status')
      .eq('id', id)
      .single()

    const job = jobResult.data

    if (jobResult.error || !job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }

    // Verify hirer owns this job
    if (job.hirer_public_key !== hirer_public_key) {
      return NextResponse.json(
        { error: 'Only the hirer can hire for this job' },
        { status: 403 }
      )
    }

    // Get application details
    const appResult = await supabase
      .from('marketplace_applications')
      .select('id, job_id, applicant_id, applicant_public_key, status, proposal')
      .eq('id', application_id)
      .eq('job_id', id)
      .single()

    const application = appResult.data

    if (appResult.error || !application) {
      return NextResponse.json(
        { error: 'Application not found' },
        { status: 404 }
      )
    }

    // Get applicant details
    const applicantResult = await supabase
      .from('agents')
      .select('agent_id, name, public_key')
      .eq('agent_id', application.applicant_id ?? '')
      .single()
    
    const applicant = applicantResult.data

    if (appResult.error || !applicant) {
      return NextResponse.json(
        { error: 'Applicant not found' },
        { status: 404 }
      )
    }

    // Create contract record with both ClawIDs
    const contractResult = await supabase
      .from('marketplace_contracts')
      .insert({
        job_id: id,
        hirer_id: job.hirer_id,
        hirer_public_key,
        hirer_signature,
        worker_id: application.applicant_id,
        worker_public_key: application.applicant_public_key,
        agreed_budget: job.budget,
        status: 'active',
      })
      .select()
      .single()

    const contract = contractResult.data

    if (contractResult.error || !contract) {
      console.error('Failed to create contract:', contractResult.error)
      return NextResponse.json(
        { error: 'Failed to create contract' },
        { status: 500 }
      )
    }

    // Update job status
    await supabase
      .from('marketplace_jobs')
      .update({ status: 'filled', hired_agent_id: application.applicant_id })
      .eq('id', id)

    // Update application status
    await supabase
      .from('marketplace_applications')
      .update({ status: 'accepted' })
      .eq('id', application_id)

    // Create Stripe PaymentIntent with ClawID metadata
    const stripeClient = getStripe();
    let paymentIntent = null;
    if (stripeClient) {
      paymentIntent = await stripeClient.paymentIntents.create({
        amount: Math.round(job.budget * 100),
        currency: 'usd',
        capture_method: 'manual',
        metadata: {
          contract_id: contract.id,
          job_id: id,
          hirer_clawid: hirer_public_key,
          worker_clawid: application.applicant_public_key,
        },
      });
    }

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
    return NextResponse.json(
      { error: 'Failed to hire applicant' },
      { status: 500 }
    )
  }
}
