export const dynamic = 'force-dynamic';
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

/**
 * GET /api/arbitra/disputes/[id]
 * Retrieves dispute details by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const disputeId = params.id;
    
    const supabase = createTypedClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const { data: dispute, error } = await supabase
      .from('dispute_cases')
      .select('*')
      .eq('id', disputeId)
      .maybeSingle();
    
    if (error) {
      return NextResponse.json(
        { error: 'Dispute not found', details: error.message },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ dispute });
  } catch (error) {
    console.error('[Dispute GET] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}