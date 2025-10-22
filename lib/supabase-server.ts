import { cookies } from 'next/headers'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { createClient, type User } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'
import { Database } from '@/types/database'

export async function createSupabaseServerClient(req?: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  const authHeader = req?.headers.get('authorization')
  if (authHeader) {
    return createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    })
  }

  const cookieStore = await cookies()

  return createServerComponentClient<Database>({
    cookies: () => cookieStore,
  }, {
    supabaseUrl,
    supabaseKey: supabaseAnonKey,
  })
}

type UserProfileRow = Database['public']['Views']['users_with_details']['Row']

type CurrentUserWithRole = {
  user: User | null
  profile: UserProfileRow | null
}

export async function getCurrentUserWithRole(): Promise<CurrentUserWithRole> {
  const supabase = await createSupabaseServerClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { user: null, profile: null }

  const { data: profile, error: profileError } = await supabase
    .from('users_with_details')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) return { user, profile: null }

  return { user, profile }
}

export type UserRole = Database['public']['Views']['users_with_details']['Row']['role']
