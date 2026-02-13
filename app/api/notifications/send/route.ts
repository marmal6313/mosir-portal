import { NextRequest, NextResponse } from 'next/server'
import { deliverNotifications } from '@/lib/notification-delivery'

// POST /api/notifications/send
// Body: { notification_ids: string[] }
// Called after inserting notifications to dispatch email/WhatsApp based on user preferences.

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const notificationIds: string[] = body.notification_ids

    if (!notificationIds || notificationIds.length === 0) {
      return NextResponse.json({ error: 'notification_ids required' }, { status: 400 })
    }

    const results = await deliverNotifications(notificationIds)

    return NextResponse.json({ ok: true, results })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[notifications/send] server error:', error)
    return NextResponse.json({ error: 'Server error', details: message }, { status: 500 })
  }
}
