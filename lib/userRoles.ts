export const USER_ROLES = ['superadmin', 'dyrektor', 'kierownik', 'pracownik'] as const

export type UserRole = (typeof USER_ROLES)[number]

export const isUserRole = (value: unknown): value is UserRole =>
  typeof value === 'string' && (USER_ROLES as readonly string[]).includes(value)
