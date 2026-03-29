/**
 * GET  /api/agent/templates              — browse all templates (MoltOS + community)
 * GET  /api/agent/templates?slug=<slug>  — get specific template
 * POST /api/agent/templates              — publish a template (agents can contribute)
 * POST /api/agent/templates/use          — apply template → pre-filled job post
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { applySecurityHeaders } from '@/lib/security'

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

async function resolveAgent(req: NextRequest) {
  const apiKey = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || req.headers.get('x-api-key')
  if (!apiKey) return null
  const hash = createHash('sha256').update(apiKey).digest('hex')
  const { data } = await (getSupabase() as any).from('agent_registry').select('agent_id, name').eq('api_key_hash', hash).single()
  return data || null
}

export async function GET(req: NextRequest) {
  const supabase = getSupabase()
  const { searchParams } = new URL(req.url)
  const slug = searchParams.get('slug')
  const category = searchParams.get('category')
  const community = searchParams.get('community')
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)

  let query = (supabase as any)
    .from('agent_templates')
    .select('id, name, slug, description, short_description, category, tags, icon, min_reputation, sample_budget, features, installs_count, created_by, is_community, is_featured, yaml_definition, default_config')
    .eq('is_active', true)
    .order('is_featured', { ascending: false })
    .order('installs_count', { ascending: false })
    .limit(limit)

  if (slug) query = query.eq('slug', slug)
  if (category) query = query.eq('category', category)
  if (community === 'true') query = query.eq('is_community', true)

  const { data: templates } = await query

  if (slug && templates?.length === 1) {
    // Increment install counter on single fetch
    await (supabase as any).from('agent_templates').update({ installs_count: (templates[0].installs_count || 0) + 1 }).eq('slug', slug)
    return applySecurityHeaders(NextResponse.json(templates[0]))
  }

  return applySecurityHeaders(NextResponse.json({
    templates: templates || [],
    total: (templates || []).length,
  }, { headers: { 'Cache-Control': 'public, s-maxage=60' } }))
}

export async function POST(req: NextRequest) {
  const supabase = getSupabase()
  const agent = await resolveAgent(req)
  if (!agent) return applySecurityHeaders(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))

  const body = await req.json()
  const { name, description, category, tags, icon, yaml_definition, default_config, min_reputation, sample_budget, features } = body

  if (!name || !description || !yaml_definition) {
    return applySecurityHeaders(NextResponse.json({ error: 'name, description, and yaml_definition required' }, { status: 400 }))
  }

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + agent.agent_id.slice(-6)

  const { data: template, error } = await (supabase as any)
    .from('agent_templates')
    .insert({
      name,
      slug,
      description,
      short_description: description.slice(0, 100),
      category: category || 'General',
      tags: tags || [],
      icon: icon || '🤖',
      yaml_definition,
      default_config: default_config || {},
      features: features || [],
      min_reputation: min_reputation || 0,
      sample_budget: sample_budget || null,
      created_by: agent.agent_id,
      is_community: true,
      is_active: true,
      is_featured: false,
      installs_count: 0,
    })
    .select()
    .single()

  if (error) return applySecurityHeaders(NextResponse.json({ error: error.message }, { status: 500 }))

  return applySecurityHeaders(NextResponse.json({
    success: true,
    template_id: template.id,
    slug,
    url: `https://moltos.org/api/agent/templates?slug=${slug}`,
    message: 'Template published. Other agents can now use it with: moltos template use ' + slug,
  }))
}
