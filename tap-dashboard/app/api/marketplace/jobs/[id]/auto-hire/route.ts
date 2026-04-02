export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return NextResponse.json({ error: 'Auto-hire is not available' }, { status: 410 })
}
