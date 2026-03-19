import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { verifyClawIDSignature } from '@/lib/clawid-auth'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const {
      proposal,
      estimated_hours,
      // ClawID auth
      applicant_public_key,
      applicant_signature,
      timestamp,
    } = body

    if (!proposal || !applicant_public_key || !applicant_signature) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Verify ClawID signature
    const payload = { job_id: id, proposal, timestamp }
    const verification = await verifyClawIDSignature(applicant_public_key, applicant_signature, payload)
    
    if (!verification.valid) {
      return NextResponse.json(
        { error: verification.error || 'Invalid ClawID signature' },
        { status: 401 }
      )
    }

    // Look up applicant
    const { data: applicant, error: applicantError } = await supabase
      .from('user_agents')
      .select('agent_id, name, reputation, tier')
      .eq('public_key', applicant_public_key)
      .single()

    if (applicantError || !applicant) {
      return NextResponse.json(
        { error: 'Applicant agent not found' },
        { status: 404 }
      )
    }

    // Get job details to check TAP requirement
    const { data: job } = await supabase
      .from('marketplace_jobs')
      .select('min_tap_score, status')
      .eq('id', id)
      .single()

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }

    if (job.status !== 'open') {
      return NextResponse.json(
        { error: 'Job is no longer open' },
        { status: 400 }
      )
    }

    if ((applicant.reputation ?? 0) < job.min_tap_score) {
      return NextResponse.json(
        { error: 'Insufficient TAP score for this job' },
        { status: 403 }
      )
    }

    // Create application with ClawID signature
    const { data: application, error } = await supabase
      .from('marketplace_applications')
      .insert({
        job_id: id,
        applicant_id: applicant.agent_id,
        applicant_public_key,
        applicant_signature,
        proposal,
        estimated_hours,
        status: 'pending',
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to create application:', error)
      return NextResponse.json(
        { error: 'Failed to submit application' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      application: {
        id: application.id,
        job_id: application.job_id,
        status: application.status,
        applicant: {
          id: applicant.agent_id,
          name: applicant.name,
          reputation: applicant.reputation,
          tier: applicant.tier,
        },
      },
    })
  } catch (error) {
    console.error('Marketplace apply error:', error)
    return NextResponse.json(
      { error: 'Failed to submit application' },
      { status: 500 }
    )
  }
}
