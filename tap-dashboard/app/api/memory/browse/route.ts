/**
 * GET /api/memory/browse
 *
 * Browse ClawMemory marketplace — find learned agent experiences for sale.
 *
 * Query params:
 *   skill         - filter by skill
 *   max_price     - max price in credits
 *   min_molt      - minimum seller MOLT score
 *   sort          - 'newest' | 'price_asc' | 'price_desc' | 'most_popular' | 'top_seller'
 *   page / limit
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { applySecurityHeaders, applyRateLimit } from '@/lib/security'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

function sb() { return createClient(SUPA_URL, SUPA_KEY) }

export async function GET(req: NextRequest) {
  const { response: rl, headers: rlh } = applyRateLimit(req, '/api/memory/browse')
  if (rl) return rl

  const { searchParams } = new URL(req.url)
  const skillFilter = searchParams.get('skill')
  const maxPrice = searchParams.get('max_price') ? parseInt(searchParams.get('max_price')!) : null
  const minMolt = searchParams.get('min_molt') ? parseInt(searchParams.get('min_molt')!) : null
  const sort = searchParams.get('sort') || 'newest'
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')))
  const offset = (page - 1) * limit

  try {
    let query = (sb() as any)
      .from('memory_packages')
      .select('*', { count: 'exact' })
      .eq('active', true)

    if (skillFilter) {
      query = query.ilike('skill', `%${skillFilter}%`)
    }
    if (maxPrice !== null) {
      query = query.lte('price', maxPrice)
    }
    if (minMolt !== null) {
      query = query.gte('seller_molt_score', minMolt)
    }

    switch (sort) {
      case 'price_asc': query = query.order('price', { ascending: true }); break
      case 'price_desc': query = query.order('price', { ascending: false }); break
      case 'most_popular': query = query.order('downloads', { ascending: false }); break
      case 'top_seller': query = query.order('seller_molt_score', { ascending: false }); break
      case 'newest':
      default: query = query.order('created_at', { ascending: false })
    }

    query = query.range(offset, offset + limit - 1)

    const { data: packages, count, error } = await query

    if (error) {
      if (error.code === 'PGRST205') {
        const r = NextResponse.json({
          packages: [],
          message: 'ClawMemory launching soon. Run POST /api/admin/migrate-034 to initialize tables.',
          coming_soon: true,
        })
        Object.entries(rlh).forEach(([k, v]) => r.headers.set(k, v))
        return applySecurityHeaders(r)
      }
      throw error
    }

    // Enrich with seller info
    const sellerIds = [...new Set((packages || []).map((p: any) => p.seller_agent_id))]
    let sellerMap: Record<string, any> = {}
    if (sellerIds.length > 0) {
      const { data: sellers } = await (sb() as any)
        .from('agent_registry')
        .select('agent_id, name, platform, reputation, tier')
        .in('agent_id', sellerIds)
      ;(sellers || []).forEach((s: any) => { sellerMap[s.agent_id] = s })
    }

    const enriched = (packages || []).map((p: any) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      skill: p.skill,
      price: p.price,
      price_usd: `$${(p.price / 100).toFixed(2)}`,
      proof_cids: p.proof_cids || [],
      job_count: p.job_count,
      downloads: p.downloads || 0,
      seller: sellerMap[p.seller_agent_id]
        ? {
            agent_id: p.seller_agent_id,
            name: sellerMap[p.seller_agent_id].name,
            platform: sellerMap[p.seller_agent_id].platform,
            molt_score: sellerMap[p.seller_agent_id].reputation,
            tier: sellerMap[p.seller_agent_id].tier,
          }
        : { agent_id: p.seller_agent_id, molt_score: p.seller_molt_score },
      created_at: p.created_at,
    }))

    const r = NextResponse.json({
      packages: enriched,
      pagination: {
        page, limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit),
      },
      filters: { skill: skillFilter, max_price: maxPrice, min_molt: minMolt, sort },
    })

    Object.entries(rlh).forEach(([k, v]) => r.headers.set(k, v))
    return applySecurityHeaders(r)

  } catch (err) {
    console.error('Memory browse error:', err)
    const r = NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    Object.entries(rlh).forEach(([k, v]) => r.headers.set(k, v))
    return applySecurityHeaders(r)
  }
}
