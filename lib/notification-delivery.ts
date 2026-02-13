import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { sendEmail } from '@/lib/email'
import { notificationEmail } from '@/lib/email-templates'

const N8N_WHATSAPP_WEBHOOK = process.env.N8N_WHATSAPP_WEBHOOK_URL || ''

interface NotificationRow {
  id: string
  user_id: string | null
  title: string
  message: string
  type: string
  action_url: string | null
  task_id: string | null
}

interface PreferencesRow {
  email_enabled: boolean
  whatsapp_enabled: boolean
  email_address: string | null
  whatsapp_number: string | null
  notify_task_assigned: boolean
  notify_task_completed: boolean
  notify_task_overdue: boolean
  notify_mentions: boolean
  quiet_hours_start: string | null
  quiet_hours_end: string | null
}

export interface DeliveryResult {
  id: string
  email: boolean
  whatsapp: boolean
}

/**
 * Process and deliver notifications (email/WhatsApp) for given notification IDs.
 * Call this directly from server-side code — no HTTP round-trip needed.
 */
export async function deliverNotifications(notificationIds: string[]): Promise<DeliveryResult[]> {
  if (!notificationIds.length) return []

  const admin = createSupabaseAdminClient()

  // Fetch notifications
  const { data: notifications, error: notifError } = await admin
    .from('notifications')
    .select('id, user_id, title, message, type, action_url, task_id')
    .in('id', notificationIds)

  if (notifError || !notifications) {
    console.error('[notification-delivery] fetch error:', notifError)
    return []
  }

  const results: DeliveryResult[] = []

  for (const notif of notifications as NotificationRow[]) {
    if (!notif.user_id) continue

    // Get user preferences (uses SQL function with fallbacks)
    const { data: prefsData, error: prefsError } = await admin
      .rpc('get_notification_preferences', { p_user_id: notif.user_id })

    const prefs = prefsData as PreferencesRow[] | null

    if (prefsError || !prefs || prefs.length === 0) {
      console.log(`[notification-delivery] No preferences for user ${notif.user_id}, skipping`)
      results.push({ id: notif.id, email: false, whatsapp: false })
      continue
    }

    const pref = prefs[0]
    let emailSent = false
    let whatsappSent = false

    console.log(`[notification-delivery] User ${notif.user_id}: email_enabled=${pref.email_enabled}, email_address=${pref.email_address}, type=${notif.type}`)

    // Check notification type against preferences
    const shouldSend = shouldSendNotificationType(notif.type, pref)
    if (!shouldSend) {
      console.log(`[notification-delivery] Notification type "${notif.type}" disabled for user, skipping`)
      results.push({ id: notif.id, email: false, whatsapp: false })
      continue
    }

    // Check quiet hours
    if (isQuietHours(pref.quiet_hours_start, pref.quiet_hours_end)) {
      console.log(`[notification-delivery] Quiet hours active, skipping`)
      results.push({ id: notif.id, email: false, whatsapp: false })
      continue
    }

    // Send email
    if (pref.email_enabled && pref.email_address) {
      console.log(`[notification-delivery] Sending email to ${pref.email_address}...`)
      const template = notificationEmail({
        title: notif.title,
        message: notif.message,
        type: notif.type,
        actionUrl: notif.action_url || undefined,
        taskId: notif.task_id || undefined,
      })

      const result = await sendEmail({
        to: pref.email_address,
        subject: template.subject,
        html: template.html,
        text: template.text,
      })

      emailSent = result.success
      if (!result.success) {
        console.error(`[notification-delivery] Email failed:`, result.error)
      }
    } else {
      console.log(`[notification-delivery] Email not enabled or no address, skipping email`)
    }

    // Send WhatsApp via n8n webhook
    if (pref.whatsapp_enabled && pref.whatsapp_number && N8N_WHATSAPP_WEBHOOK) {
      try {
        const taskUrl = notif.action_url
          ? `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.e-mosir.pl'}${notif.action_url}`
          : notif.task_id
            ? `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.e-mosir.pl'}/dashboard/tasks/${notif.task_id}`
            : undefined

        const webhookResponse = await fetch(N8N_WHATSAPP_WEBHOOK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: pref.whatsapp_number,
            title: notif.title,
            message: notif.message,
            task_url: taskUrl,
          }),
        })

        whatsappSent = webhookResponse.ok
        if (!webhookResponse.ok) {
          console.error('[notification-delivery] n8n webhook failed:', webhookResponse.status)
        }
      } catch (err) {
        console.error('[notification-delivery] n8n webhook error:', err)
      }
    }

    // Update notification flags
    const updateData: Record<string, boolean> = {}
    if (emailSent) updateData.sent_email = true
    if (whatsappSent) updateData.sent_whatsapp = true

    if (Object.keys(updateData).length > 0) {
      await admin
        .from('notifications')
        .update(updateData)
        .eq('id', notif.id)
    }

    results.push({ id: notif.id, email: emailSent, whatsapp: whatsappSent })
  }

  return results
}

// ── Helpers ─────────────────────────────────────────────

function shouldSendNotificationType(type: string, pref: PreferencesRow): boolean {
  switch (type) {
    case 'task_assigned':
      return pref.notify_task_assigned
    case 'task_completed':
      return pref.notify_task_completed
    case 'task_overdue':
      return pref.notify_task_overdue
    case 'mention':
    case 'info':
      return pref.notify_mentions
    default:
      return true
  }
}

function isQuietHours(start: string | null, end: string | null): boolean {
  if (!start || !end) return false

  const now = new Date()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()

  const [startH, startM] = start.split(':').map(Number)
  const [endH, endM] = end.split(':').map(Number)
  const startMinutes = startH * 60 + startM
  const endMinutes = endH * 60 + endM

  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes
  } else {
    return currentMinutes >= startMinutes || currentMinutes < endMinutes
  }
}
