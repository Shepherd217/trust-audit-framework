import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

let supabaseClient: SupabaseClient<Database> | null = null

function getClient(): SupabaseClient<Database> {
  if (!supabaseClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) {
      throw new Error('Supabase not configured')
    }
    supabaseClient = createClient<Database>(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  }
  return supabaseClient
}

// Lazy wrapper that delegates all property access to the actual client
class LazySupabaseClient {
  private get client() {
    return getClient()
  }
  
  // Delegate all methods/properties to the real client
  get auth() { return this.client.auth }
  get from() { return this.client.from.bind(this.client) }
  get rpc() { return this.client.rpc.bind(this.client) }
  get channel() { return this.client.channel.bind(this.client) }
  get removeChannel() { return this.client.removeChannel.bind(this.client) }
  get removeAllChannels() { return this.client.removeAllChannels.bind(this.client) }
}

export const supabase = new LazySupabaseClient() as SupabaseClient<Database>

export function getSupabaseClient() {
  if (typeof window !== 'undefined') {
    throw new Error('getSupabaseClient should only be used on the server')
  }
  return getClient()
}
