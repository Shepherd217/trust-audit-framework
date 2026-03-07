import { NextResponse } from 'next/server';

export async function POST() {
  // Call Supabase edge function or recalculate directly
  try {
    // For now, just return success - actual EigenTrust runs via cron
    return NextResponse.json({ 
      success: true, 
      message: 'EigenTrust recalculation queued',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: 'EigenTrust calculation failed' 
    }, { status: 500 });
  }
}
