import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import type { Database } from '@/types/database'

const payloadSchema = z.object({
  taskId: z.string().min(1),
  comment: z.string().min(1)
})

type TaskCommentRow = Database['public']['Tables']['task_comments']['Row'] & {
  users?: { first_name: string | null; last_name: string | null } | null
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createSupabaseServerClient(req)
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

    const { taskId, comment } = parsed.data
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

    return NextResponse.json({ ok: true, comment: insertedComment as TaskCommentRow })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('tasks.comments: server error', error)
    return NextResponse.json({ error: 'Server error', details: message }, { status: 500 })
  }
}
