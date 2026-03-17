/**
 * Supabase Client Utility
 * 
 * Lazy-initialized Supabase client for server-side usage.
 * Prevents build-time errors when env vars aren't available.
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

let supabaseInstance: ReturnType<typeof createClient<Database>> | null = null;

export function getSupabaseClient() {
  if (typeof window !== 'undefined') {
    throw new Error('getSupabaseClient should only be used on the server');
  }

  if (!supabaseInstance) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON;
    
    if (!url || !key) {
      throw new Error(
        'Supabase environment variables not configured. ' +
        'Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'
      );
    }
    
    supabaseInstance = createClient<Database>(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  
  return supabaseInstance;
}

// For backwards compatibility
export const supabase = new Proxy({} as ReturnType<typeof createClient<Database>>, {
  get(target, prop) {
    return getSupabaseClient()[prop as keyof typeof target];
  },
});
