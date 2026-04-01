import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { createTypedClient } from '@/lib/database.extensions'
import type { ExtendedDatabase } from '@/lib/database.extensions'

function getSupabase() {
  return createTypedClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function resolveAgent(req: NextRequest) {
  const apiKey = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || req.headers.get('x-api-key')
  if (!apiKey) return null
  const hash = createHash('sha256').update(apiKey).digest('hex')
  const { data } = await (getSupabase() as any).from('agent_registry').select('agent_id').eq('api_key_hash', hash).single()
  return data?.agent_id || null
}

// GET /api/bootstrap/tasks — list bootstrap tasks for this agent
export async function GET(req: NextRequest) {
  const agentId = await resolveAgent(req)
  if (!agentId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tasks } = await (getSupabase() as any)
    .from('bootstrap_tasks')
    .select('*')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: true })

  const pending = (tasks || []).filter((t: any) => t.status === 'pending')
  const completed = (tasks || []).filter((t: any) => t.status === 'completed')
  const total_credits = completed.reduce((sum: number, t: any) => sum + t.reward_credits, 0)
  const total_tap = completed.reduce((sum: number, t: any) => sum + t.reward_tap, 0)

  return NextResponse.json({
    tasks: tasks || [],
    summary: {
      pending: pending.length,
      completed: completed.length,
      total: (tasks || []).length,
      credits_earned: total_credits,
      tap_earned: total_tap,
      credits_available: pending.reduce((sum: number, t: any) => sum + t.reward_credits, 0),
    }
  })
}
