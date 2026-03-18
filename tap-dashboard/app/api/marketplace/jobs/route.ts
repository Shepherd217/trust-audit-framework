import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// ClawID verification helper
async function verifyClawIDSignature(
  publicKey: string,
  signature: string,
  payload: object
): Promise<boolean> {
  // TODO: Implement actual Ed25519 signature verification
  // For now, accept any non-empty signature
  return signature.length > 0 && publicKey.length > 0
}

// GET /api/marketplace/jobs - List jobs (filtered by applicant's TAP score)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const applicantPublicKey = searchParams.get('public_key')
    const category = searchParams.get('category')
    const status = searchParams.get('status') || 'open'

    // Build query
    let query = supabase
      .from('marketplace_jobs')
      .select(`
        *,
        hirer:hirer_id(agent_id, name, reputation, tier)
      `)
      .eq('status', status)

    // Filter by category if provided
    if (category) {
      query = query.eq('category', category)
    }

    // If applicant public key provided, filter by TAP score
    if (applicantPublicKey) {
      // Look up applicant's TAP score
      const { data: applicant } = await supabase
        .from('agents')
        .select('reputation')
        .eq('public_key', applicantPublicKey)
        .single()

      if (applicant) {
        // Only show jobs where applicant meets min TAP score
        query = query.lte('min_tap_score', applicant.reputation)
      }
    }

    const { data: jobs, error } = await query
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Failed to fetch jobs:', error)
      return NextResponse.json(
        { error: 'Failed to fetch jobs' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      jobs: jobs || [],
      count: jobs?.length || 0,
    })
  } catch (error) {
    console.error('Marketplace list jobs error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch jobs' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      title,
      description,
      budget,
      min_tap_score,
      category,
      skills_required,
      // ClawID auth
      hirer_public_key,
      hirer_signature,
      timestamp,
    } = body

    // Validate required fields
    if (!title || !description || !budget || !hirer_public_key || !hirer_signature) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Verify ClawID signature
    const payload = { title, description, budget, timestamp }
    const isValid = await verifyClawIDSignature(hirer_public_key, hirer_signature, payload)
    
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid ClawID signature' },
        { status: 401 }
      )
    }

    // Look up hirer agent by public key
    const { data: hirer, error: hirerError } = await supabase
      .from('agents')
      .select('agent_id, name, reputation, tier')
      .eq('public_key', hirer_public_key)
      .single()

    if (hirerError || !hirer) {
      return NextResponse.json(
        { error: 'Hirer agent not found. Please register your ClawID first.' },
        { status: 404 }
      )
    }

    // Create job with ClawID reference
    const { data: job, error } = await supabase
      .from('marketplace_jobs')
      .insert({
        title,
        description,
        budget,
        min_tap_score: min_tap_score || 0,
        category: category || 'General',
        skills_required: skills_required || [],
        hirer_id: hirer.agent_id,
        hirer_public_key,
        hirer_signature,
        status: 'open',
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to create job:', error)
      return NextResponse.json(
        { error: 'Failed to post job' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      job: {
        id: job.id,
        title: job.title,
        budget: job.budget,
        status: job.status,
        hirer: {
          id: hirer.agent_id,
          name: hirer.name,
          reputation: hirer.reputation,
          tier: hirer.tier,
        },
      },
    })
  } catch (error) {
    console.error('Marketplace post job error:', error)
    return NextResponse.json(
      { error: 'Failed to post job' },
      { status: 500 }
    )
  }
}
