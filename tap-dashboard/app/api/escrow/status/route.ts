import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
})

// GET /api/escrow/status - Get escrow details
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const escrow_id = searchParams.get('escrow_id')
    const job_id = searchParams.get('job_id')

    if (!escrow_id && !job_id) {
      return NextResponse.json(
        { error: 'Missing escrow_id or job_id' },
        { status: 400 }
      )
    }

    let query = supabase
      .from('payment_escrows')
      .select(`
        *,
        milestones:escrow_milestones(*),
        hirer:hirer_id(agent_id, name, reputation),
        worker:worker_id(agent_id, name, reputation)
      `)

    if (escrow_id) {
      query = query.eq('id', escrow_id)
    } else {
      query = query.eq('job_id', job_id)
    }

    const { data: escrow, error } = await query.single()

    if (error || !escrow) {
      return NextResponse.json({ error: 'Escrow not found' }, { status: 404 })
    }

    // Get recent audit events
    const { data: events } = await supabase
      .from('payment_audit_log')
      .select('event_type, actor_type, created_at')
      .eq('escrow_id', escrow.id)
      .order('created_at', { ascending: false })
      .limit(10)

    return NextResponse.json({
      escrow: {
        id: escrow.id,
        status: escrow.status,
        amount_total: escrow.amount_total,
        amount_locked: escrow.amount_locked,
        amount_released: escrow.amount_released,
        platform_fee: escrow.platform_fee,
        created_at: escrow.created_at,
        locked_at: escrow.locked_at,
        released_at: escrow.released_at,
        hirer: escrow.hirer,
        worker: escrow.worker,
        milestones: escrow.milestones?.sort((a: any, b: any) => 
          a.milestone_index - b.milestone_index
        ),
      },
      events,
    })
  } catch (error) {
    console.error('Escrow status error:', error)
    return NextResponse.json(
      { error: 'Failed to get escrow status' },
      { status: 500 }
    )
  }
}

// POST /api/escrow/lock - Confirm funds locked (called after Stripe payment)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { escrow_id, payment_intent_id } = body

    if (!escrow_id || !payment_intent_id) {
      return NextResponse.json(
        { error: 'Missing escrow_id or payment_intent_id' },
        { status: 400 }
      )
    }

    // Verify payment intent with Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent_id)

    if (paymentIntent.status !== 'succeeded') {
      return NextResponse.json(
        { error: `Payment not complete. Status: ${paymentIntent.status}` },
        { status: 400 }
      )
    }

    // Get escrow
    const { data: escrow, error: escrowError } = await supabase
      .from('payment_escrows')
      .select('*')
      .eq('id', escrow_id)
      .eq('stripe_payment_intent_id', payment_intent_id)
      .single()

    if (escrowError || !escrow) {
      return NextResponse.json({ error: 'Escrow not found' }, { status: 404 })
    }

    if (escrow.status !== 'pending') {
      return NextResponse.json(
        { error: `Escrow is already ${escrow.status}` },
        { status: 400 }
      )
    }

    // Update escrow to locked
    const { error: updateError } = await supabase
      .from('payment_escrows')
      .update({
        status: 'locked',
        amount_locked: escrow.amount_total,
        locked_at: new Date().toISOString(),
      })
      .eq('id', escrow_id)

    if (updateError) {
      console.error('Failed to lock escrow:', updateError)
      return NextResponse.json(
        { error: 'Failed to lock escrow' },
        { status: 500 }
      )
    }

    // Update first milestone to in_progress
    await supabase
      .from('escrow_milestones')
      .update({ status: 'in_progress' })
      .eq('escrow_id', escrow_id)
      .eq('milestone_index', 0)

    // Log event
    await supabase.from('payment_audit_log').insert({
      escrow_id,
      event_type: 'funds_locked',
      actor_id: 'system',
      actor_type: 'stripe_webhook',
      stripe_event_id: paymentIntent.id,
      amount_after: escrow.amount_total,
      event_data: {
        payment_intent_id,
        amount: escrow.amount_total,
      },
    })

    return NextResponse.json({
      success: true,
      escrow: {
        id: escrow_id,
        status: 'locked',
        amount_locked: escrow.amount_total,
        locked_at: new Date().toISOString(),
      },
      message: 'Funds locked in escrow. Work can begin.',
    })
  } catch (error) {
    console.error('Escrow lock error:', error)
    return NextResponse.json(
      { error: 'Failed to lock escrow' },
      { status: 500 }
    )
  }
}
