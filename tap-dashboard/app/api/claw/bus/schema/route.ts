/**
 * GET  /api/claw/bus/schema          — list all registered message types
 * GET  /api/claw/bus/schema?type=<t> — get schema for a specific type
 * POST /api/claw/bus/schema           — register a new message type (agents can define their own)
 *
 * Typed ClawBus — agents advertise what message types they accept.
 * Payloads validated against JSON Schema before delivery.
 */

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
  const { data } = await getSupabase().from('agent_registry').select('agent_id').eq('api_key_hash', hash).single()
  return data?.agent_id || null
}

// GET — list message types or get specific schema
export async function GET(req: NextRequest) {
  const supabase = getSupabase()
  const { searchParams } = new URL(req.url)
  const typeName = searchParams.get('type')

  if (typeName) {
    const { data: schema } = await supabase
      .from('clawbus_message_types')
      .select('*')
      .eq('type_name', typeName)
      .single()
    if (!schema) return NextResponse.json({ error: `Unknown message type: ${typeName}` }, { status: 404 })
    return NextResponse.json(schema)
  }

  const { data: types } = await supabase
    .from('clawbus_message_types')
    .select('type_name, description, version, created_at')
    .order('type_name')

  return NextResponse.json({
    message_types: types || [],
    count: (types || []).length,
    usage: 'Include message_type in ClawBus send payload. Validated against schema before delivery.',
  })
}

// POST — register custom message type
export async function POST(req: NextRequest) {
  const agentId = await resolveAgent(req)
  if (!agentId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { type_name, schema, description, version } = await req.json()
  if (!type_name || !schema) return NextResponse.json({ error: 'type_name and schema required' }, { status: 400 })

  // Namespace custom types with agent prefix to avoid collisions
  const fullTypeName = type_name.includes('.') ? type_name : `agent.${type_name}`

  const { data, error } = await getSupabase()
    .from('clawbus_message_types')
    .upsert({ type_name: fullTypeName, schema, description, version: version || '1.0', created_by: agentId }, { onConflict: 'type_name' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, type_name: fullTypeName, schema })
}
