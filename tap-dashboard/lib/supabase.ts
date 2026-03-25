import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

// Hardcoded for build compatibility
const DEFAULT_URL = 'https://pgeddexhbqoghdytjvex.supabase.co'
const DEFAULT_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnZWRkZXhoYnFvZ2hkeXRqdmV4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjgyNTU2OSwiZXhwIjoyMDg4NDAxNTY5fQ.Eh8eX8JxN3iHghJIB279ygf75F9tY5RzEQYeEXL-4Mo'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_KEY

export const supabase = createClient<Database>(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// For server-side usage with service role key
export function getSupabaseClient() {
  if (typeof window !== 'undefined') {
    throw new Error('getSupabaseClient should only be used on the server')
  }
  
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || DEFAULT_KEY
  
  return createClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
