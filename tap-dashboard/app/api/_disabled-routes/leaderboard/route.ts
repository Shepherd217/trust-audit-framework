import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('waitlist')
      .select('agent_id, referral_count, id')
      .order('referral_count', { ascending: false })
      .limit(10);

    if (error) throw error;

    // Calculate boosted positions
    const withBoost = (data || []).map((item: any, index: number) => ({
      agent_id: item.agent_id,
      referral_count: item.referral_count || 0,
      position: index + 1,
      boosted: Math.max(1, index + 1 - Math.floor((item.referral_count || 0) / 3) * 5)
    }));

    return NextResponse.json(withBoost);
  } catch (error) {
    return NextResponse.json([]);
  }
}
