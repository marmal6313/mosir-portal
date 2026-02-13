import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'

const payloadSchema = z.object({
  task_id: z.string().min(1),
  old_status: z.string(),
  new_status: z.string(),
})

const STATUS_LABELS: Record<string, string> = {
  pending: 'Oczekujące',
  in_progress: 'W trakcie',
  completed: 'Zakończone',
  cancelled: 'Anulowane',
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient(req)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const parsed = payloadSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const { task_id, old_status, new_status } = parsed.data

    if (old_status === new_status) {
      return NextResponse.json({ ok: true, message: 'No status change' })
    }

    const admin = createSupabaseAdminClient()

    // Fetch task details
    const { data: task, error: taskError } = await admin
      .from('tasks')
      .select('id, title, assigned_to, created_by')
      .eq('id', task_id)
      .single()

    if (taskError || !task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Determine who changed the status (current user)
    const { data: changer } = await admin
      .from('users')
      .select('first_name, last_name')
      .eq('id', user.id)
      .single()

    const changerName = changer
      ? `${changer.first_name || ''} ${changer.last_name || ''}`.trim() || 'Ktoś'
      : 'Ktoś'

    const oldLabel = STATUS_LABELS[old_status] || old_status
    const newLabel = STATUS_LABELS[new_status] || new_status

    // Determine notification type
    const notifType = new_status === 'completed' ? 'task_completed' : 'info'

    // Collect users to notify (assignee + creator)
    const usersToNotify = new Set<string>()
    if (task.assigned_to) {
      usersToNotify.add(task.assigned_to)
    }
    if (task.created_by) {
      usersToNotify.add(task.created_by)
    }

    if (usersToNotify.size === 0) {
      console.log('[notify-status] No assignee or creator to notify')
      return NextResponse.json({ ok: true, message: 'No users to notify' })
    }

    console.log(`[notify-status] Will notify ${usersToNotify.size} user(s):`, Array.from(usersToNotify))

    // Create notifications
    const notifPayloads = Array.from(usersToNotify).map(uid => ({
      user_id: uid,
      title: `Zmiana statusu: ${task.title}`,
      message: `${changerName} zmienił(a) status z "${oldLabel}" na "${newLabel}"`,
      type: notifType,
      task_id: task.id,
      action_url: `/dashboard/tasks/${task.id}`,
    }))

    const { data: insertedNotifs, error: insertError } = await admin
      .from('notifications')
      .insert(notifPayloads)
      .select('id')

    if (insertError) {
      console.error('[notify-status] Insert notifications failed:', insertError)
      return NextResponse.json({ error: 'Failed to create notifications' }, { status: 500 })
    }

    // Deliver email/WhatsApp directly (no HTTP round-trip)
    if (insertedNotifs && insertedNotifs.length > 0) {
      const { deliverNotifications } = await import('@/lib/notification-delivery')
      const deliveryResults = await deliverNotifications(
        insertedNotifs.map((n: { id: string }) => n.id)
      )
      console.log('[notify-status] Delivery results:', deliveryResults)
    }

    return NextResponse.json({ ok: true, notified: usersToNotify.size })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[notify-status] Error:', err)
    return NextResponse.json({ error: 'Server error', details: message }, { status: 500 })
  }
}
