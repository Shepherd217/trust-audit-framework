import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { sendConfirmationEmail } from '@/lib/email';
import { v4 as uuidv4 } from 'uuid';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

// Reserved/squatted names
const RESERVED_NAMES = new Set([
  'admin', 'root', 'system', 'moltos', 'support', 'help', 'api',
  'www', 'mail', 'ftp', 'localhost', 'nate', 'shepherd', 'exitliquidity'
]);

// Lazy initialization of Supabase client
let supabase: ReturnType<typeof createTypedClient> | null = null;

function getSupabase() {
  if (!supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!url || !key) {
      throw new Error('Supabase environment variables not configured');
    }
    
    supabase = createTypedClient(url, key);
  }
  return supabase;
}

// Lazy initialization of rate limiter
let ratelimit: Ratelimit | null = null;

function getRatelimit() {
  if (!ratelimit) {
    ratelimit = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(5, '10 s'),
    });
  }
  return ratelimit;
}

const schema = z.object({
  email: z.string().email().transform(e => e.toLowerCase().trim()),
  // Option A: User provides agent_id (with validation)
  agent_id: z.string()
    .min(3).max(50)
    .regex(/^[a-zA-Z0-9_-]+$/)
    .transform(s => s.toLowerCase().trim())
    .refine(
      s => !RESERVED_NAMES.has(s),
      { message: 'That Agent ID is reserved' }
    ),
  // Option B: Auto-generate if not provided
  // agent_id: z.string().optional(),
  public_key: z.string().min(20).max(500),
  turnstileToken: z.string().min(10),
  referrer_agent_id: z.string().optional(),
});

async function verifyTurnstile(token: string) {
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      secret: process.env.TURNSTILE_SECRET_KEY,
      response: token,
    }),
  });
  
  const data = await response.json();
  return data.success;
}

// Generate a unique agent_id with prefix
function generateAgentId(): string {
  const prefix = 'agent';
  const suffix = uuidv4().replace(/-/g, '').substring(0, 8);
  return `${prefix}_${suffix}`;
}

export async function POST(request: Request) {
  // Get IP for rate limiting
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  
  // Rate limit check
  try {
    const { success: rateLimitSuccess } = await getRatelimit().limit(ip);
    if (!rateLimitSuccess) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }
  } catch (e) {
    console.log('Rate limiter error:', e);
  }

  try {
    const body = await request.json();
    let { email, agent_id, public_key, turnstileToken, referrer_agent_id } = schema.parse(body);

    // Verify Turnstile
    const turnstileValid = await verifyTurnstile(turnstileToken);
    if (!turnstileValid) {
      return NextResponse.json({ error: 'CAPTCHA verification failed' }, { status: 400 });
    }

    // Option B: Auto-generate agent_id if not provided
    // if (!agent_id) {
    //   agent_id = generateAgentId();
    // }

    // Pre-check for existing agent_id (reduces race conditions)
    const { data: existing } = await getSupabase()
      .from('waitlist')
      .select('agent_id')
      .eq('agent_id', agent_id)
      .maybeSingle();
    
    if (existing) {
      return NextResponse.json({ error: 'Agent ID already taken' }, { status: 409 });
    }

    // Also check email uniqueness
    const { data: existingEmail } = await getSupabase()
      .from('waitlist')
      .select('email')
      .eq('email', email)
      .maybeSingle();
    
    if (existingEmail) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
    }

    // Validate referrer exists and is not self
    let validReferrer = null;
    if (referrer_agent_id) {
      const { data: ref } = await getSupabase()
        .from('waitlist')
        .select('agent_id')
        .eq('agent_id', referrer_agent_id)
        .single();
      
      if (ref && (ref as any).agent_id !== agent_id) {
        validReferrer = referrer_agent_id;
      }
    }

    // Generate confirmation token
    const token = uuidv4();

    // Insert with conflict handling
    const { error: insertError } = await getSupabase()
      .from('waitlist')
      .upsert([{
        email,
        agent_id,
        public_key,
        referrer_agent_id: validReferrer,
        confirmation_token: token,
        confirmed: false
      }], { onConflict: 'agent_id' }); // Explicit conflict target

    if (insertError?.code === '23505') {
      return NextResponse.json({ error: 'Agent ID already taken' }, { status: 409 });
    }

    if (insertError) {
      console.error('Insert error:', insertError);
      return NextResponse.json({ error: 'Failed to join waitlist' }, { status: 500 });
    }

    // Get position
    const { count } = await getSupabase()
      .from('waitlist')
      .select('*', { count: 'exact', head: true });
    
    const rawPosition = count || 1;

    // Send confirmation email
    try {
      await sendConfirmationEmail(email, agent_id, rawPosition, token);
    } catch (emailError) {
      console.error('Email error:', emailError);
    }

    return NextResponse.json({
      message: 'Check your email to confirm your Agent ID!',
      position: rawPosition,
      agent_id,
      referral_link: `https://moltos.org/waitlist?ref=${agent_id}`
    });

  } catch (error: any) {
    console.error('API Error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || 'Validation error' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
