import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-04-10',
})

// ClawID verification helper
async function verifyClawIDSignature(
  publicKey: string,
  signature: string,
  payload: object
): Promise<boolean> {
  // TODO: Implement actual Ed25519 signature verification
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
      // ClawID auth
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
    const { data: job, error: jobError } = await supabase
      .from('marketplace_jobs')
      .select('*, hirer:hirer_id(public_key)')
      .eq('id', id)
      .single()

    if (jobError || !job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }

    // Verify hirer owns this job
    if (job.hirer.public_key !== hirer_public_key) {
      return NextResponse.json(
        { error: 'Only the hirer can hire for this job' },
        { status: 403 }
      )
    }

    // Get application details
    const { data: application, error: appError } = await supabase
      .from('marketplace_applications')
      .select('*, applicant:applicant_id(agent_id, public_key, name)')
      .eq('id', application_id)
      .eq('job_id', id)
      .single()

    if (appError || !application) {
      return NextResponse.json(
        { error: 'Application not found' },
        { status: 404 }
      )
    }

    // Create contract record with both ClawIDs
    const { data: contract, error: contractError } = await supabase
      .from('marketplace_contracts')
      .insert({
        job_id: id,
        hirer_id: job.hirer_id,
        hirer_public_key,
        hirer_signature,
        worker_id: application.applicant.agent_id,
        worker_public_key: application.applicant.public_key,
        status: 'active',
        started_at: new Date().toISOString(),
        escrow_amount: job.budget,
      })
      .select()
      .single()

    if (contractError) {
      console.error('Failed to create contract:', contractError)
      return NextResponse.json(
        { error: 'Failed to create contract' },
        { status: 500 }
      )
    }

    // Update job status
    await supabase
      .from('marketplace_jobs')
      .update({ status: 'filled', worker_id: application.applicant.agent_id })
      .eq('id', id)

    // Update application status
    await supabase
      .from('marketplace_applications')
      .update({ status: 'accepted' })
      .eq('id', application_id)

    // Create Stripe PaymentIntent with ClawID metadata
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(job.budget * 100), // cents
      currency: 'usd',
      capture_method: 'manual',
      metadata: {
        contract_id: contract.id,
        job_id: id,
        hirer_clawid: hirer_public_key,
        worker_clawid: application.applicant.public_key,
      },
    })

    return NextResponse.json({
      success: true,
      contract: {
        id: contract.id,
        job_id: contract.job_id,
        status: contract.status,
        worker: {
          id: application.applicant.agent_id,
          name: application.applicant.name,
        },
      },
      payment_intent: {
        id: paymentIntent.id,
        client_secret: paymentIntent.client_secret,
      },
    })
  } catch (error) {
    console.error('Marketplace hire error:', error)
    return NextResponse.json(
      { error: 'Failed to hire applicant' },
      { status: 500 }
    )
  }
}
