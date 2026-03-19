import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

let supabase: ReturnType<typeof createClient> | null = null;

function getSupabase() {
  if (!supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Supabase not configured');
    supabase = createClient(url, key);
  }
  return supabase;
}

/**
 * GET /api/arbitra/notifications
 * Real-time notifications for disputes, appeals, anomalies
 * 
 * Query:
 *   agent_id: string — Filter to specific agent
 *   types: string — Comma-separated: dispute,appeal,anomaly,honeypot
 *   since: ISO timestamp — Only events after this time
 *   unread_only: boolean — Only unread notifications
 *   poll: boolean — Long-polling mode (waits for new events)
 *   poll_timeout: number — Max seconds to wait (default 30)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get('agent_id');
  const typesParam = searchParams.get('types') || 'dispute,appeal,anomaly,honeypot';
  const since = searchParams.get('since');
  const unreadOnly = searchParams.get('unread_only') === 'true';
  const poll = searchParams.get('poll') === 'true';
  const pollTimeout = Math.min(parseInt(searchParams.get('poll_timeout') || '30'), 60);

  try {
    const types = typesParam.split(',').filter(Boolean);
    
    // Build base query
    let query = getSupabase()
      .from('notifications')
      .select(`
        *,
        actor:actor_id (agent_id, name)
      `)
      .in('notification_type', types)
      .order('created_at', { ascending: false });

    // Filter by agent (involved or targeted)
    if (agentId) {
      query = query.or(`recipient_id.eq.${agentId},target_id.eq.${agentId}`);
    }

    // Filter by timestamp
    if (since) {
      query = query.gt('created_at', since);
    }

    // Filter unread
    if (unreadOnly) {
      query = query.is('read_at', null);
    }

    // Long-polling mode: wait for new events
    if (poll) {
      const startTime = Date.now();
      const timeoutMs = pollTimeout * 1000;
      let results: any[] = [];
      
      while (Date.now() - startTime < timeoutMs) {
        const { data } = await query.limit(10);
        results = data || [];
        
        if (results.length > 0) {
          break; // Got new events
        }
        
        // Wait before retry
        await new Promise(r => setTimeout(r, 1000));
      }

      return NextResponse.json({
        success: true,
        notifications: results,
        count: results.length,
        polled_ms: Date.now() - startTime,
        new_events: results.length > 0
      });
    }

    // Normal mode: return immediately
    const { data, error } = await query.limit(50);

    if (error) {
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch notifications'
      }, { status: 500 });
    }

    // Get unread count for agent
    let unreadCount = 0;
    if (agentId) {
      const { count } = await getSupabase()
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_id', agentId)
        .is('read_at', null);
      unreadCount = count || 0;
    }

    return NextResponse.json({
      success: true,
      notifications: data || [],
      count: data?.length || 0,
      unread_count: unreadCount,
      filters: { types, agent_id: agentId, since, unread_only: unreadOnly }
    });

  } catch (error) {
    console.error('Notifications error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch notifications'
    }, { status: 500 });
  }
}

/**
 * PATCH /api/arbitra/notifications
 * Mark notifications as read
 * 
 * Body:
 * {
 *   notification_ids: string[],  -- specific IDs, or 'all' for all unread
 *   agent_id: string             -- required if using 'all'
 * }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { notification_ids, agent_id } = body;

    if (!notification_ids || (notification_ids === 'all' && !agent_id)) {
      return NextResponse.json({
        success: false,
        error: 'notification_ids or (all + agent_id) required'
      }, { status: 400 });
    }

    let result;

    if (notification_ids === 'all') {
      // Mark all unread as read for agent
      const { data, error } = await getSupabase()
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('recipient_id', agent_id)
        .is('read_at', null)
        .select();

      if (error) throw error;
      result = { marked_read: data?.length || 0 };
    } else {
      // Mark specific notifications as read
      const { data, error } = await getSupabase()
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .in('id', notification_ids)
        .select();

      if (error) throw error;
      result = { marked_read: data?.length || 0 };
    }

    return NextResponse.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('Mark read error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to mark notifications as read'
    }, { status: 500 });
  }
}

/**
 * POST /api/arbitra/notifications
 * Create notification (internal/admin use)
 * 
 * Body:
 * {
 *   recipient_id: string,
 *   notification_type: string,
 *   title: string,
 *   message: string,
 *   target_id?: string,
 *   target_type?: string,
 *   action_url?: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      recipient_id, 
      notification_type, 
      title, 
      message, 
      target_id, 
      target_type,
      action_url 
    } = body;

    if (!recipient_id || !notification_type || !title || !message) {
      return NextResponse.json({
        success: false,
        error: 'recipient_id, notification_type, title, message required'
      }, { status: 400 });
    }

    const { data, error } = await getSupabase()
      .from('notifications')
      .insert([{
        recipient_id,
        notification_type,
        title,
        message,
        target_id,
        target_type,
        action_url,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      notification: data
    });

  } catch (error) {
    console.error('Create notification error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to create notification'
    }, { status: 500 });
  }
}
