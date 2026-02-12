'server-only'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type KeepAliveState = {
  timer: NodeJS.Timeout
}

const globalAny = globalThis as Record<string, unknown>
const STATE_KEY = '__mosirSupabaseKeepAliveState'

function parseInterval(value: string | undefined, fallback: number) {
  if (!value) return fallback
  const parsed = Number.parseInt(value, 10)
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed
  }
  return fallback
}

async function pingSupabase(client: SupabaseClient<Database>) {
  try {
    await client
      .from('system_settings')
      .select('key')
      .limit(1)
  } catch (error) {
    console.error('[Supabase keep-alive] Ping failed', error)
  }
}

if (typeof window === 'undefined' && !globalAny[STATE_KEY]) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (supabaseUrl && supabaseAnonKey) {
    const client = createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })

    const intervalMs = parseInterval(
      process.env.SUPABASE_KEEPALIVE_INTERVAL_MS,
      5 * 60 * 1000
    )

    pingSupabase(client).catch((error) => {
      console.error('[Supabase keep-alive] Initial ping failed', error)
    })

    const timer = setInterval(() => {
      pingSupabase(client).catch((error) => {
        console.error('[Supabase keep-alive] Scheduled ping failed', error)
      })
    }, intervalMs)

    globalAny[STATE_KEY] = { timer } satisfies KeepAliveState
  } else {
    console.warn(
      '[Supabase keep-alive] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    )
  }
}
