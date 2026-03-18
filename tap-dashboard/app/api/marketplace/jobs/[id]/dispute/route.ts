import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

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
      reason,
      evidence_cid, // ClawFS CID containing evidence
      // ClawID auth
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
    const { data: contract, error: contractError } = await supabase
      .from('marketplace_contracts')
      .select('*, hirer:hirer_id(agent_id), worker:worker_id(agent_id, public_key)')
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
        { error: 'Can only dispute active contracts' },
        { status: 400 }
      )
    }

    // Create dispute with Arbitra
    const { data: dispute, error: disputeError } = await supabase
      .from('arbitra_disputes')
      .insert({
        contract_id: contract.id,
        job_id: id,
        initiator_id: contract.hirer.agent_id,
        initiator_public_key: hirer_public_key,
        initiator_signature: hirer_signature,
        respondent_id: contract.worker.agent_id,
        respondent_public_key: contract.worker.public_key,
        reason,
        evidence_cid,
        status: 'pending',
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (disputeError) {
      console.error('Failed to create dispute:', disputeError)
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

    // Select Arbitra committee based on TAP scores
    const { data: committee } = await supabase
      .from('agents')
      .select('agent_id, public_key, reputation, tier')
      .eq('status', 'active')
      .gte('reputation', 500) // High reputation agents only
      .limit(3)

    // Assign committee members
    if (committee && committee.length > 0) {
      await supabase
        .from('arbitra_committee')
        .insert(
          committee.map((member, idx) => ({
            dispute_id: dispute.id,
            member_id: member.agent_id,
            member_public_key: member.public_key,
            position: idx + 1,
          }))
        )
    }

    return NextResponse.json({
      success: true,
      dispute: {
        id: dispute.id,
        status: dispute.status,
        committee_size: committee?.length || 0,
      },
      message: 'Dispute filed. Arbitra committee assigned.',
    })
  } catch (error) {
    console.error('Marketplace dispute error:', error)
    return NextResponse.json(
      { error: 'Failed to file dispute' },
      { status: 500 }
    )
  }
}
