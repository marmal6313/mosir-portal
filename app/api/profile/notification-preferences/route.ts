import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'

const payloadSchema = z.object({
  email_enabled: z.boolean(),
  whatsapp_enabled: z.boolean(),
  email_address: z.string().nullable(),
  whatsapp_number: z.string().nullable(),
  notify_task_assigned: z.boolean(),
  notify_task_completed: z.boolean(),
  notify_task_overdue: z.boolean(),
  notify_mentions: z.boolean(),
  notify_channel_messages: z.boolean().default(true),
  notify_dm_messages: z.boolean().default(true),
  sound_enabled: z.boolean().default(true),
  quiet_hours_start: z.string().nullable(),
  quiet_hours_end: z.string().nullable(),
})

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient(req)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const parsed = payloadSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const p = parsed.data

    const payload = {
      user_id: user.id,
      email_enabled: p.email_enabled,
      whatsapp_enabled: p.whatsapp_enabled,
      email_address: p.email_address || null,
      whatsapp_number: p.whatsapp_number || null,
      notify_task_assigned: p.notify_task_assigned,
      notify_task_completed: p.notify_task_completed,
      notify_task_overdue: p.notify_task_overdue,
      notify_mentions: p.notify_mentions,
      notify_channel_messages: p.notify_channel_messages,
      notify_dm_messages: p.notify_dm_messages,
      sound_enabled: p.sound_enabled,
      quiet_hours_start:
        p.quiet_hours_start && p.quiet_hours_start.trim() ? p.quiet_hours_start.trim() : null,
      quiet_hours_end:
        p.quiet_hours_end && p.quiet_hours_end.trim() ? p.quiet_hours_end.trim() : null,
    }

    const admin = createSupabaseAdminClient()
    const { error } = await admin
      .from('notification_preferences')
      .upsert(payload, { onConflict: 'user_id' })

    if (error) {
      console.error('[notification-preferences] Upsert failed:', error)
      return NextResponse.json(
        { error: 'Failed to save preferences', details: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({ ok: true, message: 'Preferencje powiadomień zostały zapisane.' })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[notification-preferences] Error:', err)
    return NextResponse.json({ error: 'Server error', details: message }, { status: 500 })
  }
}
