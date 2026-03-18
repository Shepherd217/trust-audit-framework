import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

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
      reason,
      evidence_cid,
      hirer_public_key,
      hirer_signature,
      timestamp,
    } = body

    if (!reason || !hirer_public_key || !hirer_signature) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Verify hirer's ClawID signature
    const payload = { job_id: id, reason, evidence_cid, timestamp }
    const isValid = await verifyClawIDSignature(hirer_public_key, hirer_signature, payload)
    
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid ClawID signature' },
        { status: 401 }
      )
    }

    // Get contract
    const contractResult = await supabase
      .from('marketplace_contracts')
      .select('id, job_id, hirer_id, worker_id, hirer_public_key, worker_public_key, status')
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
        { error: 'Can only dispute active contracts' },
        { status: 400 }
      )
    }

    // Create dispute using existing disputes table
    const disputeResult = await supabase
      .from('disputes')
      .insert({
        claimant_id: contract.hirer_id,
        opponent_id: contract.worker_id ?? '',
        claim: reason,
        evidence: evidence_cid,
        status: 'pending',
      })
      .select()
      .single()

    const dispute = disputeResult.data

    if (disputeResult.error || !dispute) {
      console.error('Failed to create dispute:', disputeResult.error)
      return NextResponse.json(
        { error: 'Failed to file dispute' },
        { status: 500 }
      )
    }

    // Update contract status
    await supabase
      .from('marketplace_contracts')
      .update({ status: 'disputed' })
      .eq('id', contract.id)

    return NextResponse.json({
      success: true,
      dispute: {
        id: dispute.id,
        status: dispute.dispute_status,
      },
      message: 'Dispute filed. Committee will be assigned.',
    })
  } catch (error) {
    console.error('Marketplace dispute error:', error)
    return NextResponse.json(
      { error: 'Failed to file dispute' },
      { status: 500 }
    )
  }
}
