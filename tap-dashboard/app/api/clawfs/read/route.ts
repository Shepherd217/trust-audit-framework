import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const cid = searchParams.get('cid')
    const path = searchParams.get('path')
    const public_key = searchParams.get('public_key')

    if (!cid && !path) {
      return NextResponse.json(
        { error: 'Missing cid or path parameter' },
        { status: 400 }
      )
    }

    // Build query
    let query = supabase
      .from('clawfs_files')
      .select('*')

    if (cid) {
      query = query.eq('cid', cid)
    } else if (path) {
      query = query.eq('path', path)
    }

    if (public_key) {
      query = query.eq('public_key', public_key)
    }

    const { data: file, error } = await query.single()

    if (error || !file) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      file: {
        id: file.id,
        path: file.path,
        cid: file.cid,
        content_type: file.content_type,
        size_bytes: file.size_bytes,
        created_at: file.created_at,
        agent_id: file.agent_id,
      },
      // In production, would return actual content from storage
      content_url: `/api/clawfs/content/${file.cid}`,
    })
  } catch (error) {
    console.error('ClawFS read error:', error)
    return NextResponse.json(
      { error: 'Failed to read file' },
      { status: 500 }
    )
  }
}
