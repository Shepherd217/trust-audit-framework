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
      rating,
      review,
      // ClawID auth
      hirer_public_key,
      hirer_signature,
      timestamp,
    } = body

    if (!hirer_public_key || !hirer_signature) {
      return NextResponse.json(
        { error: 'Missing ClawID signature' },
        { status: 400 }
      )
    }

    // Verify hirer's ClawID signature
    const payload = { job_id: id, rating, timestamp }
    const isValid = await verifyClawIDSignature(hirer_public_key, hirer_signature, payload)
    
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid ClawID signature' },
        { status: 401 }
      )
    }

    // Get contract details
    const { data: contract, error: contractError } = await supabase
      .from('marketplace_contracts')
      .select('*, job:job_id(budget)')
      .eq('job_id', id)
      .eq('hirer_public_key', hirer_public_key)
      .single()

    if (contractError || !contract) {
      return NextResponse.json(
        { error: 'Contract not found or unauthorized' },
        { status: 404 }
      )
    }

    if (contract.status !== 'active') {
      return NextResponse.json(
        { error: 'Contract is not active' },
        { status: 400 }
      )
    }

    // Capture Stripe payment (97.5% to worker)
    const paymentIntents = await stripe.paymentIntents.list({
      limit: 1,
      metadata: { contract_id: contract.id },
    })

    if (paymentIntents.data.length > 0) {
      await stripe.paymentIntents.capture(paymentIntents.data[0].id)
    }

    // Update contract
    const { error: updateError } = await supabase
      .from('marketplace_contracts')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        hirer_completion_signature: hirer_signature,
        rating,
        review,
      })
      .eq('id', contract.id)

    if (updateError) {
      console.error('Failed to complete contract:', updateError)
      return NextResponse.json(
        { error: 'Failed to complete job' },
        { status: 500 }
      )
    }

    // Update job status
    await supabase
      .from('marketplace_jobs')
      .update({ status: 'completed' })
      .eq('id', id)

    // Create TAP attestation for worker (hirer attests to worker's performance)
    const { error: attestError } = await supabase
      .from('attestations')
      .insert({
        attester_id: contract.hirer_id,
        target_id: contract.worker_id,
        claim: `Completed marketplace job: ${review || 'Job completed satisfactorily'}`,
        score: rating || 90,
        signature: hirer_signature,
        created_at: new Date().toISOString(),
      })

    if (attestError) {
      console.error('Failed to create attestation:', attestError)
    }

    return NextResponse.json({
      success: true,
      message: 'Job completed and payment released',
      contract: {
        id: contract.id,
        status: 'completed',
        payment_released: true,
      },
    })
  } catch (error) {
    console.error('Marketplace complete error:', error)
    return NextResponse.json(
      { error: 'Failed to complete job' },
      { status: 500 }
    )
  }
}
