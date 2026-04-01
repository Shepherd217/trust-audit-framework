import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase as Database } from '@/lib/database.extensions';
import { applyRateLimit, applySecurityHeaders } from '@/lib/security';

const MAX_TEMPLATES_LIMIT = 100;

// GET /api/agent-templates - Get available agent templates
export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResult = await applyRateLimit(request, 'standard');
  if (rateLimitResult.response) {
    return rateLimitResult.response;
  }
  
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');
    const category = searchParams.get('category');
    const limit = Math.min(MAX_TEMPLATES_LIMIT, Math.max(1, parseInt(searchParams.get('limit') || '50')));

    const supabase = createTypedClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );

    let query = supabase
      .from('agent_templates')
      .select('*')
      .eq('is_active', true)
      .order('is_featured', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);

    if (slug) {
      query = query.eq('slug', slug);
    }

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching agent templates:', error);
      return applySecurityHeaders(NextResponse.json(
        { error: 'Failed to fetch agent templates' },
        { status: 500 }
      ));
    }

    // If slug was specified, return single agent
    if (slug) {
      const agent = data?.[0];
      if (!agent) {
        return applySecurityHeaders(NextResponse.json(
          { error: 'Agent not found' },
          { status: 404 }
        ));
      }
      return applySecurityHeaders(NextResponse.json({ agent }));
    }

    return applySecurityHeaders(NextResponse.json({ agents: data }));
  } catch (error) {
    console.error('Unexpected error:', error);
    return applySecurityHeaders(NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    ));
  }
}
