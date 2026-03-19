import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import Stripe from 'stripe'
import { verifyClawIDSignature } from '@/lib/clawid-auth'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
})

// POST /api/stripe/connect/onboard - Create a Connect account for a worker
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      agent_id,
      email,
      country = 'US',
      // ClawID auth
      public_key,
      signature,
      timestamp,
    } = body

    // Verify auth
    if (!public_key || !signature) {
      return NextResponse.json({ error: 'Missing authentication' }, { status: 401 })
    }

    const verification = await verifyClawIDSignature(public_key, signature, {
      action: 'connect_onboard',
      agent_id,
      timestamp,
    })

    if (!verification.valid) {
      return NextResponse.json(
        { error: verification.error || 'Invalid signature' },
        { status: 401 }
      )
    }

    // Verify agent owns this public key
    const { data: agent, error: agentError } = await supabase
      .from('agent_registry')
      .select('id, email')
      .eq('agent_id', agent_id)
      .eq('public_key', public_key)
      .single()

    if (agentError || !agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    // Check if already has Connect account
    const { data: existing } = await supabase
      .from('stripe_connect_accounts')
      .select('stripe_account_id, charges_enabled')
      .eq('agent_id', agent_id)
      .single()

    if (existing?.charges_enabled) {
      return NextResponse.json({
        success: true,
        already_onboarded: true,
        account_id: existing.stripe_account_id,
      })
    }

    // Create Stripe Connect account
    const account = await stripe.accounts.create({
      type: 'express',
      country,
      email: email || agent.email,
      capabilities: {
        transfers: { requested: true },
      },
      business_type: 'individual',
      metadata: {
        agent_id,
        moltos_version: '0.7.3',
      },
    })

    // Store in database
    const { error: insertError } = await supabase
      .from('stripe_connect_accounts')
      .insert({
        agent_id,
        stripe_account_id: account.id,
        email: email || agent.email,
        country,
      })

    if (insertError) {
      console.error('Failed to store Connect account:', insertError)
      // Don't fail — Stripe account exists, we can retry storage
    }

    // Create onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/marketplace/connect/refresh?agent_id=${agent_id}`,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/marketplace/connect/success?agent_id=${agent_id}`,
      type: 'account_onboarding',
    })

    return NextResponse.json({
      success: true,
      account_id: account.id,
      onboarding_url: accountLink.url,
      expires_at: accountLink.expires_at,
    })
  } catch (error) {
    console.error('Connect onboard error:', error)
    return NextResponse.json(
      { error: 'Failed to create Connect account' },
      { status: 500 }
    )
  }
}

// GET /api/stripe/connect/status - Check onboarding status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const agent_id = searchParams.get('agent_id')

    if (!agent_id) {
      return NextResponse.json({ error: 'Missing agent_id' }, { status: 400 })
    }

    const { data: account } = await supabase
      .from('stripe_connect_accounts')
      .select('*')
      .eq('agent_id', agent_id)
      .single()

    if (!account) {
      return NextResponse.json({
        onboarded: false,
        message: 'Connect account not found',
      })
    }

    // Refresh status from Stripe
    const stripeAccount = await stripe.accounts.retrieve(account.stripe_account_id)
    
    const updates = {
      charges_enabled: stripeAccount.charges_enabled,
      payouts_enabled: stripeAccount.payouts_enabled,
      requirements_due: stripeAccount.requirements?.currently_due || [],
      updated_at: new Date().toISOString(),
      onboarded_at: stripeAccount.charges_enabled ? new Date().toISOString() : account.onboarded_at,
    }

    await supabase
      .from('stripe_connect_accounts')
      .update(updates)
      .eq('agent_id', agent_id)

    return NextResponse.json({
      onboarded: stripeAccount.charges_enabled,
      charges_enabled: stripeAccount.charges_enabled,
      payouts_enabled: stripeAccount.payouts_enabled,
      requirements_due: updates.requirements_due,
      dashboard_link: stripeAccount.charges_enabled ? await createLoginLink(account.stripe_account_id) : null,
    })
  } catch (error) {
    console.error('Connect status error:', error)
    return NextResponse.json(
      { error: 'Failed to check status' },
      { status: 500 }
    )
  }
}

async function createLoginLink(accountId: string): Promise<string | null> {
  try {
    const link = await stripe.accounts.createLoginLink(accountId)
    return link.url
  } catch {
    return null
  }
}
