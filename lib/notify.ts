/**
 * Trigger email/WhatsApp delivery for notification IDs.
 * Fire-and-forget: does not block the caller. Call this after inserting into `notifications`.
 *
 * @example
 *   const { data } = await admin.from('notifications').insert(payload).select('id')
 *   if (data) triggerNotificationDelivery(data.map(n => n.id))
 */
export function triggerNotificationDelivery(notificationIds: string[]): void {
  if (!notificationIds.length) return

  const port = process.env.PORT || '3000'
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : `http://localhost:${port}`)

  console.log(`[notify] Triggering delivery for ${notificationIds.length} notification(s) via ${baseUrl}`)

  fetch(`${baseUrl}/api/notifications/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notification_ids: notificationIds }),
  }).catch((err) => {
    console.error('[notify] delivery trigger failed:', err)
  })
}
