import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/lib/database.types';

// GET /api/agent-templates - Get available agent templates
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');
    const category = searchParams.get('category');

    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );

    let query = supabase
      .from('agent_templates')
      .select('*')
      .eq('is_active', true)
      .order('is_featured', { ascending: false })
      .order('created_at', { ascending: false });

    if (slug) {
      query = query.eq('slug', slug);
    }

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching agent templates:', error);
      return NextResponse.json(
        { error: 'Failed to fetch agent templates' },
        { status: 500 }
      );
    }

    // If slug was specified, return single agent
    if (slug) {
      const agent = data?.[0];
      if (!agent) {
        return NextResponse.json(
          { error: 'Agent not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({ agent });
    }

    return NextResponse.json({ agents: data });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
