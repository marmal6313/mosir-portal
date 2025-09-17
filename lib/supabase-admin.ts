import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// Server-only: uses SUPABASE_SERVICE_ROLE_KEY. Do not import in client components.
export function createSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing SUPABASE config: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }
  return createClient<Database>(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
}

