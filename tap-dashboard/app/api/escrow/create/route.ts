import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import Stripe from 'stripe'
import { verifyClawIDSignature } from '@/lib/clawid-auth'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
})

// POST /api/escrow/create - Create escrow and payment intent
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      job_id,
      milestones, // Array of {title, description, amount}
      // ClawID auth
      hirer_public_key,
      hirer_signature,
      timestamp,
    } = body

    // Validate
    if (!job_id || !milestones?.length || !hirer_public_key || !hirer_signature) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Verify total amount
    const totalAmount = milestones.reduce((sum: number, m: { amount: number }) => sum + m.amount, 0)
    if (totalAmount < 500) { // $5 minimum
      return NextResponse.json({ error: 'Minimum escrow amount is $5.00' }, { status: 400 })
    }
    if (totalAmount > 100000) { // $1000 maximum
      return NextResponse.json({ error: 'Maximum escrow amount is $1000.00' }, { status: 400 })
    }

    // Verify hirer signature
    const verification = await verifyClawIDSignature(hirer_public_key, hirer_signature, {
      action: 'create_escrow',
      job_id,
      milestones,
      timestamp,
    })

    if (!verification.valid) {
      return NextResponse.json(
        { error: verification.error || 'Invalid signature' },
        { status: 401 }
      )
    }

    // Get hirer agent
    const { data: hirer, error: hirerError } = await supabase
      .from('agent_registry')
      .select('agent_id, name')
      .eq('public_key', hirer_public_key)
      .single()

    if (hirerError || !hirer) {
      return NextResponse.json({ error: 'Hirer not found' }, { status: 404 })
    }

    // Get job details
    const { data: job, error: jobError } = await supabase
      .from('marketplace_jobs')
      .select('id, title, budget, worker_id, status')
      .eq('id', job_id)
      .single()

    if (jobError || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    if (job.status !== 'open' && job.status !== 'filled') {
      return NextResponse.json({ error: 'Job is not available for escrow' }, { status: 400 })
    }

    // Check if escrow already exists
    const { data: existing } = await supabase
      .from('payment_escrows')
      .select('id, status')
      .eq('job_id', job_id)
      .single()

    if (existing && existing.status !== 'cancelled') {
      return NextResponse.json(
        { error: 'Escrow already exists for this job', escrow_id: existing.id },
        { status: 409 }
      )
    }

    // Calculate platform fee (2.5%)
    const platformFee = Math.round(totalAmount * 0.025)

    // Create Stripe Payment Intent
    // This holds the hirer's funds
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalAmount,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      metadata: {
        job_id,
        hirer_id: hirer.agent_id,
        escrow_type: 'milestone',
        milestone_count: milestones.length.toString(),
      },
      description: `MoltOS Escrow: ${job.title}`,
    })

    // Create escrow record
    const { data: escrow, error: escrowError } = await supabase
      .from('payment_escrows')
      .insert({
        job_id,
        hirer_id: hirer.agent_id,
        worker_id: job.worker_id,
        amount_total: totalAmount,
        amount_locked: 0, // Not locked until payment confirmed
        platform_fee: platformFee,
        stripe_payment_intent_id: paymentIntent.id,
        status: 'pending',
        milestones: milestones,
        created_by: hirer.agent_id,
      })
      .select()
      .single()

    if (escrowError || !escrow) {
      console.error('Failed to create escrow:', escrowError)
      // Cancel the payment intent
      await stripe.paymentIntents.cancel(paymentIntent.id)
      return NextResponse.json({ error: 'Failed to create escrow' }, { status: 500 })
    }

    // Create milestone records
    const milestoneRecords = milestones.map((m: any, index: number) => ({
      escrow_id: escrow.id,
      milestone_index: index,
      title: m.title,
      description: m.description,
      amount: m.amount,
      status: 'pending',
    }))

    await supabase.from('escrow_milestones').insert(milestoneRecords)

    // Log the event
    await supabase.from('payment_audit_log').insert({
      escrow_id: escrow.id,
      job_id,
      event_type: 'escrow_created',
      actor_id: hirer.agent_id,
      actor_type: 'hirer',
      event_data: {
        amount_total: totalAmount,
        platform_fee: platformFee,
        milestone_count: milestones.length,
      },
    })

    return NextResponse.json({
      success: true,
      escrow: {
        id: escrow.id,
        status: escrow.status,
        amount_total: totalAmount,
        platform_fee: platformFee,
        milestones: milestones.length,
      },
      payment_intent: {
        client_secret: paymentIntent.client_secret,
        id: paymentIntent.id,
      },
      next_step: 'Confirm payment to lock funds in escrow',
    })
  } catch (error) {
    console.error('Escrow create error:', error)
    return NextResponse.json(
      { error: 'Failed to create escrow' },
      { status: 500 }
    )
  }
}
