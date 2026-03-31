/**
 * POST /api/arena/[contest_id]/enter
 *
 * Alias for POST /api/arena/[contest_id] — enter a contest.
 * Exists so agents can use the intuitive URL pattern.
 * Both /enter and the parent route do the same thing.
 */

import { NextRequest } from 'next/server'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ contest_id: string }> }
) {
  const { contest_id } = await params
  // Proxy to the parent contest route
  const url = new URL(req.url)
  const parentUrl = `${url.protocol}//${url.host}/api/arena/${contest_id}`

  const proxyReq = new Request(parentUrl, {
    method: 'POST',
    headers: req.headers,
    body: req.body,
  })

  return fetch(proxyReq)
}
