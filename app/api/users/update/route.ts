import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { isUserRole, USER_ROLES, type UserRole } from '@/lib/userRoles'

const payloadSchema = z.object({
  id: z.string().min(1),
  first_name: z.string().optional().nullable(),
  last_name: z.string().optional().nullable(),
  position: z.string().optional().nullable(),
  role: z.enum(USER_ROLES).optional(),
  department_id: z.number().int().nullable().optional(),
  department_ids: z.array(z.number().int()).optional(),
  phone: z.string().optional().nullable(),
  whatsapp: z.string().optional().nullable(),
  active: z.boolean().optional(),
})

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient(req)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: requester } = await supabase
      .from('users_with_details')
      .select('*')
      .eq('id', user.id)
      .single()

    const requesterRole = isUserRole(requester?.role) ? requester.role : null
    const requesterDeptId =
      typeof requester?.department_id === 'number' ? requester.department_id : null

    const { getRolePermissions } = await import('@/lib/permissions')
    const rolePerms = requesterRole ? getRolePermissions(requesterRole) : []
    const hasUsersUpdate = requesterRole === 'superadmin' || rolePerms.some(p => p.permission === 'users.update')
    if (!hasUsersUpdate) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    const parsed = payloadSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 })
    }

    const { id, first_name, last_name, position, role, department_id, department_ids, phone, whatsapp, active } = parsed.data
    console.log('users.update: parsed payload', parsed.data)

    // Fetch target user to enforce scope/constraints
    const { data: target } = await supabase
      .from('users_with_details')
      .select('*')
      .eq('id', id)
      .single()

    if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    // Scope enforcement for kierownik: can update only users in their department; cannot escalate roles
    if (requesterRole === 'kierownik') {
      if (!requesterDeptId || target.department_id !== requesterDeptId) {
        return NextResponse.json({ error: 'Forbidden: different department' }, { status: 403 })
      }
      if (role && role !== 'pracownik') {
        return NextResponse.json({ error: 'Forbidden: cannot set role above pracownik' }, { status: 403 })
      }
    }

    // Dyrektor cannot assign superadmin role
    if (requesterRole === 'dyrektor' && role === 'superadmin') {
      return NextResponse.json({ error: 'Forbidden: cannot assign superadmin' }, { status: 403 })
    }

    const admin = createSupabaseAdminClient()

    type UserUpdateFields = {
      first_name?: string | null
      last_name?: string | null
      position?: string | null
      phone?: string | null
      whatsapp?: string | null
      active?: boolean
      role?: UserRole
      department_id?: number | null
    }

    const updates: UserUpdateFields = {}
    if (first_name !== undefined) updates.first_name = first_name
    if (last_name !== undefined) updates.last_name = last_name
    if (position !== undefined) updates.position = position
    if (phone !== undefined) updates.phone = phone
    if (whatsapp !== undefined) updates.whatsapp = whatsapp
    if (active !== undefined) updates.active = active
    if (role !== undefined) updates.role = role
    if (department_id !== undefined) updates.department_id = department_id

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ ok: true, message: 'Nothing to update' })
    }

    console.log('users.update: applying updates', { id, updates })

    const { data: updated, error } = await admin
      .from('users')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      console.error('users.update: Update failed', error)
      return NextResponse.json({ error: 'Update failed', details: error.message }, { status: 400 })
    }

    // Aktualizuj powiązania z działami w user_departments
    if (department_ids !== undefined) {
      // Usuń istniejące powiązania
      await admin.from('user_departments').delete().eq('user_id', id)

      if (department_ids.length > 0) {
        const deptRows = department_ids.map((deptId, index) => ({
          user_id: id,
          department_id: deptId,
          is_primary: index === 0,
        }))

        const { error: deptError } = await admin.from('user_departments').insert(deptRows)
        if (deptError) {
          console.error('users.update: user_departments update failed', deptError)
          // Nie zwracamy błędu - profil został zaktualizowany
        }
      }

      // Ustaw primary department_id w users
      if (department_ids.length > 0) {
        await admin.from('users').update({ department_id: department_ids[0] }).eq('id', id)
      }
    }

    return NextResponse.json({ ok: true, profile: updated })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: 'Server error', details: message }, { status: 500 })
  }
}
