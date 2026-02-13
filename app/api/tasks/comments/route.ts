import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import type { Database } from '@/types/database'

const payloadSchema = z.object({
  taskId: z.string().min(1),
  comment: z.string().min(1),
  mentions: z.array(z.string().uuid()).optional()
})

type TaskCommentRow = Database['public']['Tables']['task_comments']['Row'] & {
  users?: { first_name: string | null; last_name: string | null } | null
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient(req)
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => null)
    const parsed = payloadSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { taskId, comment, mentions = [] } = parsed.data
    const trimmedComment = comment.trim()

    if (!trimmedComment) {
      return NextResponse.json({ error: 'Comment cannot be empty' }, { status: 400 })
    }

    const admin = createSupabaseAdminClient()

    const { data: insertedComment, error: insertError } = await admin
      .from('task_comments')
      .insert({
        comment: trimmedComment,
        task_id: taskId,
        user_id: user.id,
      })
      .select(
        `
          id,
          comment,
          created_at,
          task_id,
          user_id,
          users:user_id(first_name, last_name)
        `
      )
      .single()

    if (insertError || !insertedComment) {
      console.error('tasks.comments: insert failed', insertError)
      return NextResponse.json(
        { error: 'Insert failed', details: insertError?.message ?? 'unknown error' },
        { status: 400 }
      )
    }

    const uniqueMentions = Array.from(new Set(mentions)).filter(
      (mentionId) => mentionId !== user.id
    )

    if (uniqueMentions.length > 0) {
      try {
        const { data: mentionableUsers, error: mentionsFetchError } = await admin
          .from('users')
          .select('id')
          .in('id', uniqueMentions)

        if (mentionsFetchError) {
          console.error('tasks.comments: mention lookup failed', mentionsFetchError)
        }

        const validMentionIds = (mentionableUsers ?? [])
          .map((row) => row.id)
          .filter((id): id is string => Boolean(id))

        if (validMentionIds.length > 0) {
          const [
            { data: taskRow, error: taskFetchError },
            { data: authorRow, error: authorFetchError },
          ] = await Promise.all([
            admin
              .from('tasks')
              .select('title')
              .eq('id', taskId)
              .single(),
            admin
              .from('users')
              .select('first_name, last_name')
              .eq('id', user.id)
              .single(),
          ])

          if (taskFetchError) {
            console.error('tasks.comments: task lookup failed', taskFetchError)
          }
          if (authorFetchError) {
            console.error('tasks.comments: author lookup failed', authorFetchError)
          }

          const authorName = [authorRow?.first_name, authorRow?.last_name]
            .filter((value): value is string => Boolean(value))
            .join(' ')
            .trim() || 'Ktoś'

          const snippet = trimmedComment.length > 140
            ? `${trimmedComment.slice(0, 137)}...`
            : trimmedComment

          const notificationPayload = validMentionIds.map((mentionId) => ({
            user_id: mentionId,
            title: 'Oznaczono Cię w komentarzu',
            message: `${authorName} wspomniał(a) Cię w zadaniu "${taskRow?.title ?? 'zadaniu'}". Treść: ${snippet}`,
            type: 'info',
            action_url: `/dashboard/tasks/${taskId}`,
            task_id: taskId,
          }))

          const { data: insertedNotifs, error: notificationError } = await admin
            .from('notifications')
            .insert(notificationPayload)
            .select('id')

          if (notificationError) {
            console.error('tasks.comments: notification insert failed', notificationError)
          }

          // Trigger email/WhatsApp delivery (fire-and-forget)
          if (insertedNotifs && insertedNotifs.length > 0) {
            const { triggerNotificationDelivery } = await import('@/lib/notify')
            triggerNotificationDelivery(insertedNotifs.map((n: { id: string }) => n.id))
          }
        }
      } catch (notificationError) {
        console.error('tasks.comments: mention notification error', notificationError)
      }
    }

    return NextResponse.json({ ok: true, comment: insertedComment as TaskCommentRow })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('tasks.comments: server error', error)
    return NextResponse.json({ error: 'Server error', details: message }, { status: 500 })
  }
}
