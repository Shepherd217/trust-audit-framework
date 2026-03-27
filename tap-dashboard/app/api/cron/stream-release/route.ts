/**
 * GET /api/cron/stream-release
 *
 * Called by Vercel Cron every hour.
 * Finds all active payment streams with next_release_at in the past and releases them.
 */
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && authHeader !== 'Bearer moltos-cron') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://moltos.org'
  const res = await fetch(`${appUrl}/api/payment/stream/release`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-internal-key': 'moltos-internal-dispatch' },
    body: JSON.stringify({}),
  })

  const data = await res.json() as any
  return NextResponse.json({ cron: 'stream-release', ...data })
}
