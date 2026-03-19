import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import Stripe from 'stripe'
import { verifyClawIDSignature } from '@/lib/clawid-auth'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
})

// POST /api/escrow/milestone/submit - Worker submits work
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      escrow_id,
      milestone_index,
      deliverables, // Array of {type, cid, description}
      notes,
      // ClawID auth
      worker_public_key,
      worker_signature,
      timestamp,
    } = body

    if (!escrow_id || milestone_index === undefined || !worker_public_key || !worker_signature) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Verify worker signature
    const verification = await verifyClawIDSignature(worker_public_key, worker_signature, {
      action: 'submit_milestone',
      escrow_id,
      milestone_index,
      timestamp,
    })

    if (!verification.valid) {
      return NextResponse.json(
        { error: verification.error || 'Invalid signature' },
        { status: 401 }
      )
    }

    // Get worker
    const { data: worker } = await supabase
      .from('agent_registry')
      .select('agent_id')
      .eq('public_key', worker_public_key)
      .single()

    if (!worker) {
      return NextResponse.json({ error: 'Worker not found' }, { status: 404 })
    }

    // Get milestone
    const { data: milestone, error: milestoneError } = await supabase
      .from('escrow_milestones')
      .select('*, escrow:escrow_id(*)')
      .eq('escrow_id', escrow_id)
      .eq('milestone_index', milestone_index)
      .single()

    if (milestoneError || !milestone) {
      return NextResponse.json({ error: 'Milestone not found' }, { status: 404 })
    }

    // Verify worker is assigned to this escrow
    if (milestone.escrow.worker_id !== worker.agent_id) {
      return NextResponse.json(
        { error: 'You are not the assigned worker for this escrow' },
        { status: 403 }
      )
    }

    // Update milestone
    const { error: updateError } = await supabase
      .from('escrow_milestones')
      .update({
        status: 'submitted',
        deliverables: deliverables || [],
        submitted_at: new Date().toISOString(),
        submitted_by: worker.agent_id,
      })
      .eq('id', milestone.id)

    if (updateError) {
      return NextResponse.json({ error: 'Failed to submit milestone' }, { status: 500 })
    }

    // Log event
    await supabase.from('payment_audit_log').insert({
      escrow_id,
      event_type: 'milestone_submitted',
      actor_id: worker.agent_id,
      actor_type: 'worker',
      event_data: {
        milestone_index,
        deliverables_count: deliverables?.length || 0,
      },
    })

    return NextResponse.json({
      success: true,
      milestone: {
        index: milestone_index,
        status: 'submitted',
        submitted_at: new Date().toISOString(),
      },
      message: 'Work submitted. Awaiting hirer approval.',
    })
  } catch (error) {
    console.error('Milestone submit error:', error)
    return NextResponse.json(
      { error: 'Failed to submit milestone' },
      { status: 500 }
    )
  }
}

// POST /api/escrow/milestone/release - Hirer approves and releases payment
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      escrow_id,
      milestone_index,
      review_notes,
      // ClawID auth
      hirer_public_key,
      hirer_signature,
      timestamp,
    } = body

    if (!escrow_id || milestone_index === undefined || !hirer_public_key || !hirer_signature) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Verify hirer signature
    const verification = await verifyClawIDSignature(hirer_public_key, hirer_signature, {
      action: 'release_milestone',
      escrow_id,
      milestone_index,
      timestamp,
    })

    if (!verification.valid) {
      return NextResponse.json(
        { error: verification.error || 'Invalid signature' },
        { status: 401 }
      )
    }

    // Get hirer
    const { data: hirer } = await supabase
      .from('agent_registry')
      .select('agent_id')
      .eq('public_key', hirer_public_key)
      .single()

    if (!hirer) {
      return NextResponse.json({ error: 'Hirer not found' }, { status: 404 })
    }

    // Get escrow with milestone
    const { data: escrow, error: escrowError } = await supabase
      .from('payment_escrows')
      .select(`
        *,
        milestone:escrow_milestones(*)
      `)
      .eq('id', escrow_id)
      .eq('hirer_id', hirer.agent_id)
      .single()

    if (escrowError || !escrow) {
      return NextResponse.json(
        { error: 'Escrow not found or you are not the hirer' },
        { status: 404 }
      )
    }

    if (escrow.status !== 'locked') {
      return NextResponse.json(
        { error: `Escrow is ${escrow.status}, cannot release` },
        { status: 400 }
      )
    }

    // Get the specific milestone
    const milestone = escrow.milestone?.find((m: any) => m.milestone_index === milestone_index)
    if (!milestone) {
      return NextResponse.json({ error: 'Milestone not found' }, { status: 404 })
    }

    if (milestone.status !== 'submitted') {
      return NextResponse.json(
        { error: `Milestone is ${milestone.status}, cannot release` },
        { status: 400 }
      )
    }

    // Get worker's Connect account
    const { data: connectAccount } = await supabase
      .from('stripe_connect_accounts')
      .select('stripe_account_id, charges_enabled')
      .eq('agent_id', escrow.worker_id)
      .single()

    if (!connectAccount?.charges_enabled) {
      return NextResponse.json(
        { error: 'Worker has not completed Stripe Connect onboarding' },
        { status: 400 }
      )
    }

    // Calculate transfer amount (milestone amount minus platform fee portion)
    const milestoneAmount = milestone.amount
    const platformFeePortion = Math.round(milestoneAmount * 0.025)
    const transferAmount = milestoneAmount - platformFeePortion

    // Create transfer to worker
    const transfer = await stripe.transfers.create({
      amount: transferAmount,
      currency: 'usd',
      destination: connectAccount.stripe_account_id,
      transfer_group: escrow_id,
      metadata: {
        escrow_id,
        milestone_index: milestone_index.toString(),
        job_id: escrow.job_id,
      },
    })

    // Update milestone
    await supabase
      .from('escrow_milestones')
      .update({
        status: 'approved',
        released_at: new Date().toISOString(),
        reviewed_at: new Date().toISOString(),
        reviewed_by: hirer.agent_id,
        review_notes: review_notes || null,
        stripe_transfer_id: transfer.id,
      })
      .eq('id', milestone.id)

    // Update escrow totals
    const newReleased = (escrow.amount_released || 0) + milestoneAmount
    const newLocked = (escrow.amount_locked || 0) - milestoneAmount
    const allMilestones = escrow.milestone || []
    const releasedCount = allMilestones.filter((m: any) => m.status === 'approved').length + 1
    
    // Check if all milestones released
    const allReleased = releasedCount >= allMilestones.length

    await supabase
      .from('payment_escrows')
      .update({
        amount_released: newReleased,
        amount_locked: newLocked,
        status: allReleased ? 'released' : 'locked',
        released_at: allReleased ? new Date().toISOString() : escrow.released_at,
        current_milestone_index: allReleased ? null : milestone_index + 1,
      })
      .eq('id', escrow_id)

    // If not all released, set next milestone to in_progress
    if (!allReleased) {
      await supabase
        .from('escrow_milestones')
        .update({ status: 'in_progress' })
        .eq('escrow_id', escrow_id)
        .eq('milestone_index', milestone_index + 1)
    }

    // Log event
    await supabase.from('payment_audit_log').insert({
      escrow_id,
      event_type: 'milestone_released',
      actor_id: hirer.agent_id,
      actor_type: 'hirer',
      stripe_event_id: transfer.id,
      amount_before: escrow.amount_released || 0,
      amount_after: newReleased,
      event_data: {
        milestone_index,
        amount: milestoneAmount,
        transfer_amount: transferAmount,
        platform_fee: platformFeePortion,
      },
    })

    return NextResponse.json({
      success: true,
      release: {
        milestone_index,
        amount: milestoneAmount,
        transfer_amount: transferAmount,
        platform_fee: platformFeePortion,
        transfer_id: transfer.id,
      },
      escrow: {
        id: escrow_id,
        status: allReleased ? 'released' : 'locked',
        total_released: newReleased,
        remaining_locked: newLocked,
        complete: allReleased,
      },
      message: allReleased 
        ? 'All milestones released. Job complete!' 
        : 'Milestone released. Next milestone unlocked.',
    })
  } catch (error) {
    console.error('Milestone release error:', error)
    return NextResponse.json(
      { error: 'Failed to release milestone' },
      { status: 500 }
    )
  }
}
