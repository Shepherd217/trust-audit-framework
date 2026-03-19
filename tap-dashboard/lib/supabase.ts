import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

let supabaseClient: ReturnType<typeof createClient<Database>> | null = null
let serviceClient: ReturnType<typeof createClient<Database>> | null = null

export const supabase = new Proxy({} as ReturnType<typeof createClient<Database>>, {
  get(target, prop) {
    if (!supabaseClient) {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
      if (!url || !key) throw new Error('Supabase not configured')
      supabaseClient = createClient<Database>(url, key, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    }
    return supabaseClient[prop as keyof typeof supabaseClient]
  }
})

// For server-side usage with service role key
export function getSupabaseClient() {
  if (typeof window !== 'undefined') {
    throw new Error('getSupabaseClient should only be used on the server')
  }
  
  if (!serviceClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured')
    
    serviceClient = createClient<Database>(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  }
  
  return serviceClient
}
