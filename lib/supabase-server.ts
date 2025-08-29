import { cookies } from 'next/headers'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { Database } from '@/types/database'

export function createSupabaseServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createServerComponentClient<Database>({
    cookies: () => cookies()
  }, {
    supabaseUrl,
    supabaseKey: supabaseAnonKey
  })
}

export async function getCurrentUserWithRole() {
  const supabase = createSupabaseServerClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { user: null, profile: null as any }

  const { data: profile, error: profileError } = await supabase
    .from('users_with_details')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) return { user, profile: null as any }

  return { user, profile }
}

export type UserRole = Database['public']['Views']['users_with_details']['Row']['role']
