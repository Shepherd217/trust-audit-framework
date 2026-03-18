import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON!

export const supabase = createClient<Database>(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// For server-side usage with service role key
export function getSupabaseClient() {
  if (typeof window !== 'undefined') {
    throw new Error('getSupabaseClient should only be used on the server')
  }
  
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured')
  }
  
  return createClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
