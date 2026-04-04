export const dynamic = 'force-dynamic'
// ONE-SHOT cleanup route — deletes audit test agents by ID
// REMOVE THIS FILE after use
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const AGENT_IDS = [
  'agent_71dce4216668995d', // coldtest-1775312873
]
const NAME_PATTERNS = ['audit-verify-%', 'audit-check-%', 'audit-cleanup-%']

export async function GET(req: NextRequest) {
  const token = req.headers.get('x-cleanup-token') || new URL(req.url).searchParams.get('token')
  if (token !== process.env.GENESIS_TOKEN) {
    return NextResponse.json({ error: 'no' }, { status: 401 })
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const deleted: string[] = []
  const errors: string[] = []

  // Delete by explicit IDs first (cascade to related tables)
  for (const id of AGENT_IDS) {
    // Clean up related data
    await sb.from('clawfs_files').delete().eq('agent_id', id)
    await sb.from('bootstrap_tasks').delete().eq('agent_id', id)
    await sb.from('agent_wallets').delete().eq('agent_id', id)
    await sb.from('wallet_transactions').delete().eq('agent_id', id)
    await sb.from('marketplace_applications').delete().eq('applicant_id', id)
    await sb.from('webhooks').delete().eq('agent_id', id)
    await sb.from('clawbus_messages').delete().eq('from_agent', id)
    await sb.from('clawbus_messages').delete().eq('to_agent', id)

    const { error } = await sb.from('agent_registry').delete().eq('agent_id', id)
    if (error) errors.push(`${id}: ${error.message}`)
    else deleted.push(id)
  }

  // Delete by name patterns
  for (const pattern of NAME_PATTERNS) {
    const { data: matches } = await sb
      .from('agent_registry')
      .select('agent_id')
      .ilike('name', pattern)
    
    for (const agent of matches || []) {
      const id = agent.agent_id
      await sb.from('clawfs_files').delete().eq('agent_id', id)
      await sb.from('bootstrap_tasks').delete().eq('agent_id', id)
      await sb.from('agent_wallets').delete().eq('agent_id', id)
      await sb.from('wallet_transactions').delete().eq('agent_id', id)
      await sb.from('marketplace_applications').delete().eq('applicant_id', id)
      await sb.from('webhooks').delete().eq('agent_id', id)
      await sb.from('clawbus_messages').delete().eq('from_agent', id)
      await sb.from('clawbus_messages').delete().eq('to_agent', id)

      const { error } = await sb.from('agent_registry').delete().eq('agent_id', id)
      if (error) errors.push(`${id}: ${error.message}`)
      else deleted.push(id)
    }
  }

  return NextResponse.json({ deleted, errors, count: deleted.length })
}
