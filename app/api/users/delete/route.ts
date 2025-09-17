import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'

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

    const requesterRole = requester?.role as any
    const { getRolePermissions } = await import('@/lib/permissions')
    const rolePerms = requesterRole ? getRolePermissions(requesterRole) : []
    const hasUsersDelete = requesterRole === 'superadmin' || rolePerms.some(p => p.permission === 'users.delete')
    if (!hasUsersDelete) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    const parsed = payloadSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 })
    }
    const { id, mode } = parsed.data

    const admin = createSupabaseAdminClient()

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
    if (requesterRole !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden: hard delete allowed for superadmin only' }, { status: 403 })
    }

    // Remove profile row first (FKs may depend on it). Consider soft-delete in production.
    const { error: delProfileErr } = await admin
      .from('users')
      .delete()
      .eq('id', id)
    if (delProfileErr) {
      console.error('users.delete: Profile delete failed', delProfileErr)
      return NextResponse.json({ error: 'Profile delete failed', details: delProfileErr.message }, { status: 400 })
    }

    // Optionally, disable auth user
    // Note: Supabase does not expose a direct hard delete for auth via API without retention; skipping for safety.

    return NextResponse.json({ ok: true, deleted: true })
  } catch (e: any) {
    return NextResponse.json({ error: 'Server error', details: e?.message ?? String(e) }, { status: 500 })
  }
}
