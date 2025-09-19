import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import type { Database } from '@/types/database'

const payloadSchema = z.object({
  id: z.string().min(1),
  mode: z.enum(['deactivate', 'hard']).default('deactivate')
})

export async function POST(req: NextRequest) {
  try {
    const supabase = createSupabaseServerClient(req)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: requester } = await supabase
      .from('users_with_details')
      .select('*')
      .eq('id', user.id)
      .single()

    const requesterRole = requester?.role
    const isKnownRole = requesterRole === 'superadmin' || requesterRole === 'dyrektor' || requesterRole === 'kierownik' || requesterRole === 'pracownik'
    const effectiveRole = isKnownRole ? requesterRole : null
    const { getRolePermissions } = await import('@/lib/permissions')
    const rolePerms = effectiveRole ? getRolePermissions(effectiveRole) : []
    const hasUsersDelete = effectiveRole === 'superadmin' || rolePerms.some(p => p.permission === 'users.delete')
    if (!hasUsersDelete) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    const parsed = payloadSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 })
    }
    const { id, mode } = parsed.data

    const admin = createSupabaseAdminClient()

    const { data: targetUser } = await admin
      .from('users')
      .select('first_name, last_name, email')
      .eq('id', id)
      .single()

    if (mode === 'deactivate') {
      const { error } = await admin
        .from('users')
        .update({ active: false })
        .eq('id', id)
      if (error) {
        console.error('users.delete: Deactivate failed', error)
        return NextResponse.json({ error: 'Deactivate failed', details: error.message }, { status: 400 })
      }
      return NextResponse.json({ ok: true, deactivated: true })
    }

    // hard delete only for superadmin
    if (effectiveRole !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden: hard delete allowed for superadmin only' }, { status: 403 })
    }

    const { data: assignedTasks, error: tasksSelectError } = await admin
      .from('tasks')
      .select('id')
      .eq('assigned_to', id)
    if (tasksSelectError) {
      console.error('users.delete: Fetch assigned tasks failed', tasksSelectError)
      return NextResponse.json({ error: 'Fetch assigned tasks failed', details: tasksSelectError.message }, { status: 400 })
    }

    if (assignedTasks && assignedTasks.length > 0) {
      const deletedUserLabel = [targetUser?.first_name, targetUser?.last_name]
        .filter(Boolean)
        .join(' ')
        .trim() || targetUser?.email || id
      const historyTimestamp = new Date().toISOString()
      const historyEntries: Database['public']['Tables']['task_changes']['Insert'][] = assignedTasks.map(taskItem => ({
        task_id: taskItem.id,
        user_id: user.id,
        old_description: `Przypisanie: ${deletedUserLabel}`,
        new_description: 'Przypisanie: brak (konto usunięte)',
        old_status: null,
        new_status: null,
        old_due_date: null,
        new_due_date: null,
        changed_at: historyTimestamp
      }))

      const { error: historyInsertError } = await admin
        .from('task_changes')
        .insert(historyEntries)

      if (historyInsertError) {
        console.error('users.delete: Assignment history insert failed', historyInsertError)
        return NextResponse.json({ error: 'Assignment history insert failed', details: historyInsertError.message }, { status: 400 })
      }
    }

    // Clean dependent relations before deleting the profile row
    const dependencyCleanups = [
      admin.from('tasks').update({ assigned_to: null }).eq('assigned_to', id),
      admin.from('tasks').update({ created_by: null }).eq('created_by', id),
      admin.from('task_comments').update({ user_id: null }).eq('user_id', id),
      admin.from('task_changes').update({ user_id: null }).eq('user_id', id),
      admin.from('notifications').delete().eq('user_id', id),
      admin.from('users').update({ manager_id: null }).eq('manager_id', id),
      admin.from('system_settings').update({ updated_by: null }).eq('updated_by', id)
    ]

    for (const cleanup of dependencyCleanups) {
      const { error } = await cleanup
      if (error) {
        console.error('users.delete: Dependency cleanup failed', error)
        return NextResponse.json({ error: 'Dependency cleanup failed', details: error.message }, { status: 400 })
      }
    }

    const { error: delProfileErr } = await admin
      .from('users')
      .delete()
      .eq('id', id)
    if (delProfileErr) {
      console.error('users.delete: Profile delete failed', delProfileErr)
      return NextResponse.json({ error: 'Profile delete failed', details: delProfileErr.message }, { status: 400 })
    }

    const authDeleteResult = await admin.auth.admin.deleteUser(id)
    const authDeleteError = authDeleteResult.error
    if (authDeleteError) {
      const status = (authDeleteError as { status?: number }).status
      if (status === 404) {
        console.warn('users.delete: Auth user already removed', { id })
      } else {
        console.error('users.delete: Auth delete failed', authDeleteError)
        return NextResponse.json({ error: 'Auth delete failed', details: authDeleteError.message ?? 'unknown error' }, { status: 400 })
      }
    }

    return NextResponse.json({ ok: true, deleted: true })
  } catch (error: unknown) {
    if (error instanceof Error) {
      return NextResponse.json({ error: 'Server error', details: error.message }, { status: 500 })
    }
    return NextResponse.json({ error: 'Server error', details: 'Unknown error' }, { status: 500 })
  }
}
