import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { verifyClawIDSignature } from '@/lib/clawid-auth'
import { applyRateLimit, applySecurityHeaders, validateBodySize } from '@/lib/security'

// Rate limits: GET 30/min, POST 10/min
const MAX_BODY_SIZE_KB = 100;
const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 5000;
const MAX_BUDGET = 100000000; // $1M max budget (in cents)

// GET /api/marketplace/jobs - List jobs
export async function GET(request: NextRequest) {
  const path = '/api/marketplace/jobs';
  
  const { response: rateLimitResponse, headers: rateLimitHeaders } = applyRateLimit(request, path);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }
  
  try {
    const { searchParams } = new URL(request.url)
    const applicantPublicKey = searchParams.get('public_key')
    const category = searchParams.get('category')
    const status = searchParams.get('status') || 'open'

    // Validate status
    const validStatuses = ['open', 'in_progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      const response = NextResponse.json(
        { error: 'Invalid status' },
        { status: 400 }
      );
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }

    let query = supabase
      .from('marketplace_jobs')
      .select("*")
      .eq('status', status)

    if (category) {
      query = query.eq('category', category.slice(0, 50))
    }

    if (applicantPublicKey) {
      const { data: applicant } = await supabase
        .from('agents')
        .select('reputation')
        .eq('public_key', applicantPublicKey.slice(0, 200))
        .single()

      if (applicant) {
        query = query.lte('min_tap_score', applicant.reputation)
      }
    }

    const { data: jobs, error } = await query
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Failed to fetch jobs:', error)
      const response = NextResponse.json(
        { error: 'Failed to fetch jobs' },
        { status: 500 }
      );
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }

    // Enrich with hirer info — check agent_registry first, then legacy agents table
    const hirerIds = [...new Set((jobs || []).map((j: any) => j.hirer_id).filter(Boolean))]
    let hirerMap: Record<string, any> = {}
    if (hirerIds.length > 0) {
      const { data: regHirers } = await (supabase as any)
        .from('agent_registry')
        .select('agent_id, name, reputation, tier')
        .in('agent_id', hirerIds)
      if (regHirers) regHirers.forEach((h: any) => { hirerMap[h.agent_id] = h })
      // Fill in any still missing from legacy agents table
      const missing = hirerIds.filter((id: string) => !hirerMap[id])
      if (missing.length > 0) {
        const { data: legacyHirers } = await (supabase as any)
          .from('agents')
          .select('agent_id, name, reputation, tier')
          .in('agent_id', missing)
        if (legacyHirers) legacyHirers.forEach((h: any) => { hirerMap[h.agent_id] = h })
      }
    }
    const enrichedJobs = (jobs || []).map((j: any) => ({
      ...j,
      hirer: hirerMap[j.hirer_id] || { agent_id: j.hirer_id, name: 'Unknown', reputation: 0, tier: 'BRONZE' },
    }))

    const response = NextResponse.json({
      jobs: enrichedJobs,
      count: enrichedJobs.length,
    });
    
    Object.entries(rateLimitHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    
    return applySecurityHeaders(response);
    
  } catch (error) {
    console.error('Marketplace list jobs error:', error)
    const response = NextResponse.json(
      { error: 'Failed to fetch jobs' },
      { status: 500 }
    );
    Object.entries(rateLimitHeaders || {}).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return applySecurityHeaders(response);
  }
}

// POST /api/marketplace/jobs - Create job
export async function POST(request: NextRequest) {
  const path = '/api/marketplace/jobs';
  
  const { response: rateLimitResponse, headers: rateLimitHeaders } = applyRateLimit(request, path);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }
  
  try {
    const bodyText = await request.text();
    const sizeCheck = validateBodySize(bodyText, MAX_BODY_SIZE_KB);
    if (!sizeCheck.valid) {
      const response = NextResponse.json(
        { error: sizeCheck.error },
        { status: 413 }
      );
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }
    
    let body;
    try {
      body = JSON.parse(bodyText);
    } catch {
      const response = NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }
    
    const {
      title,
      description,
      budget,
      min_tap_score,
      category,
      skills_required,
      hirer_public_key,
      hirer_signature,
      timestamp,
    } = body

    if (!title || !description || !budget || !hirer_public_key || !hirer_signature) {
      const response = NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }

    // Validate title
    if (typeof title !== 'string' || title.length > MAX_TITLE_LENGTH || title.length < 5) {
      const response = NextResponse.json(
        { error: `Title must be 5-${MAX_TITLE_LENGTH} characters` },
        { status: 400 }
      );
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }

    // Validate description
    if (typeof description !== 'string' || description.length > MAX_DESCRIPTION_LENGTH || description.length < 20) {
      const response = NextResponse.json(
        { error: `Description must be 20-${MAX_DESCRIPTION_LENGTH} characters` },
        { status: 400 }
      );
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }

    // Validate budget — minimum $5.00 (500 cents)
    const MIN_BUDGET = 500
    if (typeof budget !== 'number' || budget < MIN_BUDGET || budget > MAX_BUDGET) {
      const response = NextResponse.json(
        { error: `Budget must be between $5.00 and ${MAX_BUDGET / 100}` },
        { status: 400 }
      );
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }

    // Auth: accept either valid Ed25519 signature OR valid API key
    const apiKeyHeader = request.headers.get('x-api-key') || request.headers.get('authorization')?.replace('Bearer ', '')
    let verifiedAgentId: string | undefined

    if (apiKeyHeader) {
      // API key auth — verify key, get agent_id from registry
      const { createHash } = await import('crypto')
      const keyHash = createHash('sha256').update(apiKeyHeader).digest('hex')
      const { data: keyAgent } = await supabase
        .from('agent_registry')
        .select('agent_id')
        .eq('api_key_hash', keyHash)
        .single()
      if (!keyAgent) {
        const response = NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
        Object.entries(rateLimitHeaders).forEach(([key, value]) => { response.headers.set(key, value) })
        return applySecurityHeaders(response)
      }
      verifiedAgentId = keyAgent.agent_id
    } else {
      // Ed25519 signature auth
      const payload: import("@/lib/clawid-auth").ClawIDPayload = { title, description, budget, challenge: hirer_signature, timestamp }
      const verification = await verifyClawIDSignature(hirer_public_key, hirer_signature, payload)
      if (!verification.valid) {
        const response = NextResponse.json(
          { error: verification.error || 'Invalid ClawID signature' },
          { status: 401 }
        )
        Object.entries(rateLimitHeaders).forEach(([key, value]) => { response.headers.set(key, value) })
        return applySecurityHeaders(response)
      }
      verifiedAgentId = verification.agentId
    }

    // Look up hirer — check agent_registry first (API key auth), then agents table
    let hirerId = verifiedAgentId
    if (!hirerId) {
      const { data: hirerAgent } = await supabase
        .from('agents')
        .select('agent_id')
        .eq('public_key', hirer_public_key)
        .single()
      if (hirerAgent) hirerId = hirerAgent.agent_id
    }
    if (!hirerId) {
      const { data: regAgent } = await supabase
        .from('agent_registry')
        .select('agent_id')
        .eq('public_key', hirer_public_key)
        .single()
      if (regAgent) hirerId = regAgent.agent_id
    }
    if (!hirerId) {
      const response = NextResponse.json({ error: 'Hirer agent not found' }, { status: 404 })
      Object.entries(rateLimitHeaders).forEach(([key, value]) => { response.headers.set(key, value) })
      return applySecurityHeaders(response)
    }

    // Create job
    const { data: job, error } = await supabase
      .from('marketplace_jobs')
      .insert({
        title,
        description,
        budget,
        min_tap_score: Math.max(0, Math.min(100, min_tap_score || 0)),
        category: (category || 'General').slice(0, 50),
        skills_required: Array.isArray(skills_required) ? skills_required.slice(0, 20) : [],
        hirer_id: hirerId,
        hirer_public_key,
        hirer_signature,
        status: 'open',
        auto_hire: body.auto_hire === true,
        auto_hire_min_tap: body.auto_hire_min_tap || 0,
        bond_required: body.bond_required || 0,
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to create job:', error)
      const response = NextResponse.json(
        { error: 'Failed to post job' },
        { status: 500 }
      );
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }

    // Fire-and-forget dispatch to webhook agents — don't block job post response
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://moltos.org'
    fetch(`${appUrl}/api/webhook-agent/dispatch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-key': 'moltos-internal-dispatch',
      },
      body: JSON.stringify({ job_id: job.id }),
    }).catch(() => {}) // intentionally fire-and-forget

    const response = NextResponse.json({
      success: true,
      job: {
        id: job.id,
        title: job.title,
        budget: job.budget,
        status: job.status,
        hirer_id: hirerId,
      },
    });
    
    Object.entries(rateLimitHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    
    return applySecurityHeaders(response);
    
  } catch (error) {
    console.error('Marketplace post job error:', error)
    const response = NextResponse.json(
      { error: 'Failed to post job' },
      { status: 500 }
    );
    Object.entries(rateLimitHeaders || {}).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return applySecurityHeaders(response);
  }
}
