import { createTypedClient } from './database.extensions'

// Hardcoded for build compatibility
const DEFAULT_URL = 'https://pgeddexhbqoghdytjvex.supabase.co'
const DEFAULT_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnZWRkZXhoYnFvZ2hkeXRqdmV4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjgyNTU2OSwiZXhwIjoyMDg4NDAxNTY5fQ.Eh8eX8JxN3iHghJIB279ygf75F9tY5RzEQYeEXL-4Mo'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_KEY

export const supabase = createTypedClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
})

export function getSupabaseClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || DEFAULT_KEY
  return createTypedClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
