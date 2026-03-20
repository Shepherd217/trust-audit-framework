import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import Stripe from 'stripe'
import { verifyClawIDSignature } from '@/lib/clawid-auth'
import { applyRateLimit, applySecurityHeaders, validateBodySize, validateArrayLength } from '@/lib/security'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
})

// Rate limit: 10 escrow creations per minute per IP
const MAX_BODY_SIZE_KB = 500;
const MAX_MILESTONES = 20;
const MAX_MILESTONE_TITLE_LENGTH = 200;
const MAX_MILESTONE_DESC_LENGTH = 2000;

// POST /api/escrow/create - Create escrow and payment intent
export async function POST(request: NextRequest) {
  // Apply rate limiting - financial endpoint, strict limits
  const { response: rateLimitResponse, headers: rateLimitHeaders } = applyRateLimit(request, '/api/escrow/create');
  if (rateLimitResponse) {
    return rateLimitResponse;
  }
  
  try {
    // Read and validate body size
    const bodyText = await request.text();
    const sizeCheck = validateBodySize(bodyText, MAX_BODY_SIZE_KB);
    if (!sizeCheck.valid) {
      const response = NextResponse.json({ error: sizeCheck.error }, { status: 413 });
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }
    
    const body = JSON.parse(bodyText)
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
      const response = NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }
    
    // Validate array length
    const arrayCheck = validateArrayLength(milestones, MAX_MILESTONES, 'milestones');
    if (!arrayCheck.valid) {
      const response = NextResponse.json({ error: arrayCheck.error }, { status: 400 });
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }

    // Verify total amount
    const totalAmount = milestones.reduce((sum: number, m: { amount: number }) => sum + m.amount, 0)
    if (totalAmount < 500) { // $5 minimum
      const response = NextResponse.json({ error: 'Minimum escrow amount is $5.00' }, { status: 400 });
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }
    if (totalAmount > 100000) { // $1000 maximum
      const response = NextResponse.json({ error: 'Maximum escrow amount is $1000.00' }, { status: 400 });
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }

    // Validate milestone content
    for (const m of milestones) {
      if (m.title && m.title.length > MAX_MILESTONE_TITLE_LENGTH) {
        const response = NextResponse.json({ 
          error: `Milestone title exceeds ${MAX_MILESTONE_TITLE_LENGTH} characters` 
        }, { status: 400 });
        Object.entries(rateLimitHeaders).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
        return applySecurityHeaders(response);
      }
      if (m.description && m.description.length > MAX_MILESTONE_DESC_LENGTH) {
        const response = NextResponse.json({ 
          error: `Milestone description exceeds ${MAX_MILESTONE_DESC_LENGTH} characters` 
        }, { status: 400 });
        Object.entries(rateLimitHeaders).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
        return applySecurityHeaders(response);
      }
    }

    // Verify hirer signature
    const verification = await verifyClawIDSignature(hirer_public_key, hirer_signature, {
      action: 'create_escrow',
      job_id,
      milestones,
      timestamp,
    })

    if (!verification.valid) {
      const response = NextResponse.json(
        { error: verification.error || 'Invalid signature' },
        { status: 401 }
      );
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }

    // Get hirer agent
    const { data: hirer, error: hirerError } = await supabase
      .from('agent_registry')
      .select('agent_id, name')
      .eq('public_key', hirer_public_key)
      .single()

    if (hirerError || !hirer) {
      const response = NextResponse.json({ error: 'Hirer not found' }, { status: 404 });
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }

    // Get job details
    const { data: job, error: jobError } = await supabase
      .from('marketplace_jobs')
      .select('id, title, budget, worker_id, status')
      .eq('id', job_id)
      .single()

    if (jobError || !job) {
      const response = NextResponse.json({ error: 'Job not found' }, { status: 404 });
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }

    if (job.status !== 'open' && job.status !== 'filled') {
      const response = NextResponse.json({ error: 'Job is not available for escrow' }, { status: 400 });
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }

    // Check if escrow already exists
    const { data: existing } = await supabase
      .from('payment_escrows')
      .select('id, status')
      .eq('job_id', job_id)
      .single()

    if (existing && existing.status !== 'cancelled') {
      const response = NextResponse.json(
        { error: 'Escrow already exists for this job', escrow_id: existing.id },
        { status: 409 }
      );
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }

    // Calculate platform fee (2.5%)
    const platformFee = Math.round(totalAmount * 0.025)

    // Generate idempotency key from job_id + timestamp + hirer signature hash
    // This ensures retries of the same request don't create duplicate charges
    const idempotencyKey = `escrow_${job_id}_${timestamp}_${Buffer.from(hirer_signature).toString('base64').slice(0, 20)}`

    // Create Stripe Payment Intent with idempotency key
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
    }, {
      idempotencyKey,
    })

    // Use database transaction to ensure atomicity
    // All operations succeed or all fail together
    const { data: result, error: txError } = await supabase.rpc('create_escrow_with_milestones', {
      p_job_id: job_id,
      p_hirer_id: hirer.agent_id,
      p_worker_id: job.worker_id,
      p_amount_total: totalAmount,
      p_platform_fee: platformFee,
      p_stripe_payment_intent_id: paymentIntent.id,
      p_milestones: milestones,
      p_created_by: hirer.agent_id,
    })

    if (txError) {
      console.error('Failed to create escrow (transaction rolled back):', txError)
      // Cancel the payment intent since DB transaction failed
      try {
        await stripe.paymentIntents.cancel(paymentIntent.id)
      } catch (cancelError) {
        console.error('Failed to cancel payment intent after escrow failure:', cancelError)
        // Non-fatal: payment intent will expire automatically
      }
      const response = NextResponse.json({ error: 'Failed to create escrow' }, { status: 500 });
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return applySecurityHeaders(response);
    }

    const escrow = result as any;

    const response = NextResponse.json({
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
    });
    
    Object.entries(rateLimitHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return applySecurityHeaders(response);
    
  } catch (error) {
    console.error('Escrow create error:', error)
    const response = NextResponse.json(
      { error: 'Failed to create escrow' },
      { status: 500 }
    );
    Object.entries(rateLimitHeaders || {}).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return applySecurityHeaders(response);
  }
}
