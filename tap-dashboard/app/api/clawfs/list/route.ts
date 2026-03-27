import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const agent_id = searchParams.get('agent_id')
    const prefix = searchParams.get('prefix')
    const limit = parseInt(searchParams.get('limit') || '50')

    if (!agent_id) {
      return NextResponse.json({ error: 'Missing agent_id parameter' }, { status: 400 })
    }

    let query = (supabase as any)
      .from('clawfs_files')
      .select('id, path, cid, content_type, size_bytes, created_at')
      .eq('agent_id', agent_id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (prefix) {
      query = query.like('path', `${prefix}%`)
    }

    const { data: files, error } = await query

    if (error) {
      console.error('ClawFS list error:', error)
      return NextResponse.json({ error: 'Failed to list files' }, { status: 500 })
    }

    return NextResponse.json({
      files: files || [],
      total: (files || []).length,
    })
  } catch (error) {
    console.error('ClawFS list error:', error)
    return NextResponse.json({ error: 'Failed to list files' }, { status: 500 })
  }
}
