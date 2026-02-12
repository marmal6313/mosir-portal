import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { isUserRole, USER_ROLES, type UserRole } from '@/lib/userRoles'

const payloadSchema = z.object({
  email: z.string().email(),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  position: z.string().min(1),
  role: z.enum(USER_ROLES).default('pracownik'),
  department_id: z.number().int().optional().nullable(),
  department_ids: z.array(z.number().int()).optional(),
  phone: z.string().optional().nullable(),
  whatsapp: z.string().optional().nullable(),
  invite: z.boolean().optional().default(true),
})

export async function POST(req: NextRequest) {
  try {
    // Authn/Authz of requester
    const supabase = await createSupabaseServerClient(req)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('users_with_details')
      .select('*')
      .eq('id', user.id)
      .single()

    const requesterRole = isUserRole(profile?.role) ? profile.role : null
    // Only superadmin or roles explicitly allowed to create users via permissions
    // Importing permission config to verify 'users.create'
    const { getRolePermissions } = await import('@/lib/permissions')
    const rolePerms = requesterRole ? getRolePermissions(requesterRole) : []
    const hasUsersCreate = requesterRole === 'superadmin' || rolePerms.some(p => p.permission === 'users.create')
    if (!hasUsersCreate) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = payloadSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 })
    }
    const { email, first_name, last_name, position, role, department_id, department_ids, phone, whatsapp, invite } = parsed.data

    // Kierownik może dodawać tylko do własnego działu i tylko rolę pracownik
    let finalRole: UserRole = role
    let finalDepartmentId = department_id ?? null
    if (requesterRole === 'kierownik') {
      finalRole = 'pracownik'
      // enforce department to manager's department
      // profile may have department_id in users_with_details view
      // fallback: keep provided department if not available
      const managerDepartmentId =
        typeof profile?.department_id === 'number' ? profile.department_id : null
      finalDepartmentId = managerDepartmentId ?? finalDepartmentId
    }

    const admin = createSupabaseAdminClient()

    // Create or invite auth user
    let authUserId: string | null = null
    // Try to find existing by email (no direct find API; use admin.listUsers filter by email) – fallback: try create/invite and handle conflict
    // Prefer invite flow if requested
    if (invite) {
      const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email)
      if (inviteError && inviteError.message && !inviteError.message.includes('already registered')) {
        return NextResponse.json({ error: 'Invite failed', details: inviteError.message }, { status: 400 })
      }
      authUserId = inviteData?.user?.id ?? authUserId
    }

    if (!authUserId) {
      const { data: createData, error: createError } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { full_name: `${first_name} ${last_name}` },
      })
      if (createError && createError.message && !createError.message.includes('already registered')) {
        return NextResponse.json({ error: 'Create user failed', details: createError.message }, { status: 400 })
      }
      authUserId = createData?.user?.id ?? authUserId
    }

    if (!authUserId) {
      return NextResponse.json({ error: 'Could not resolve auth user id' }, { status: 500 })
    }

    // Upsert into public.users
    const { data: upserted, error: upsertError } = await admin
      .from('users')
      .upsert({
        id: authUserId,
        email,
        first_name,
        last_name,
        position,
        role: finalRole,
        department_id: finalDepartmentId,
        phone: phone ?? null,
        whatsapp: whatsapp ?? null,
        active: true,
      }, { onConflict: 'id' })
      .select('*')
      .single()

    if (upsertError) {
      console.error('users.create: Profile upsert failed', upsertError)
      return NextResponse.json({ error: 'Profile upsert failed', details: upsertError.message }, { status: 400 })
    }

    // Wstaw powiązania z działami do user_departments
    const deptIdsToInsert = department_ids && department_ids.length > 0
      ? department_ids
      : (finalDepartmentId ? [finalDepartmentId] : [])

    if (deptIdsToInsert.length > 0) {
      // Usuń istniejące powiązania
      await admin.from('user_departments').delete().eq('user_id', authUserId)
      
      // Wstaw nowe
      const deptRows = deptIdsToInsert.map((deptId, index) => ({
        user_id: authUserId!,
        department_id: deptId,
        is_primary: index === 0,
      }))
      
      const { error: deptError } = await admin.from('user_departments').insert(deptRows)
      if (deptError) {
        console.error('users.create: user_departments insert failed', deptError)
        // Nie zwracamy błędu - profil został utworzony
      }
    }

    return NextResponse.json({ ok: true, user_id: authUserId, profile: upserted }, { status: 200 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: 'Server error', details: message }, { status: 500 })
  }
}
