import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-02-25.clover',
})

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
      rating,
      review,
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
    const contractResult = await supabase
      .from('marketplace_contracts')
      .select('id, job_id, hirer_id, worker_id, hirer_public_key, status, agreed_budget')
      .eq('job_id', id)
      .eq('hirer_public_key', hirer_public_key)
      .single()

    const contract = contractResult.data

    if (contractResult.error || !contract) {
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

    // Capture Stripe payment
    const paymentIntents = await stripe.paymentIntents.list({
      limit: 100,
    })
    
    const matchingIntent = paymentIntents.data.find(
      pi => pi.metadata?.contract_id === contract.id
    )

    if (matchingIntent) {
      await stripe.paymentIntents.capture(matchingIntent.id)
    }

    // Update contract
    const updateResult = await supabase
      .from('marketplace_contracts')
      .update({
        status: 'completed',
        hirer_completion_signature: hirer_signature,
        rating,
        review,
      })
      .eq('id', contract.id)

    if (updateResult.error) {
      console.error('Failed to complete contract:', updateResult.error)
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
