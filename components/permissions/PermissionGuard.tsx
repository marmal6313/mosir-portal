import React from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import type { Permission, Resource, Action } from '@/lib/permissions'

interface PermissionGuardProps {
  children: React.ReactNode
  permission?: Permission
  resource?: Resource
  action?: Action
  fallback?: React.ReactNode
  loading?: React.ReactNode
}

export function PermissionGuard({
  children,
  permission,
  resource,
  action,
  fallback = null,
  loading = null
}: PermissionGuardProps) {
  const { hasPermission, canAccess, loading: permissionsLoading } = usePermissions()

  // Jeśli ładowanie uprawnień
  if (permissionsLoading) {
    return <>{loading}</>
  }

  // Sprawdź uprawnienie
  if (permission && !hasPermission(permission)) {
    return <>{fallback}</>
  }

  // Sprawdź dostęp do zasobu
  if (resource && action && !canAccess(resource, action)) {
    return <>{fallback}</>
  }

  // Użytkownik ma uprawnienia
  return <>{children}</>
}

// Komponenty dla konkretnych uprawnień
export function TasksGuard({ children, action = 'read', fallback, loading }: Omit<PermissionGuardProps, 'permission' | 'resource'>) {
  return (
    <PermissionGuard resource="tasks" action={action} fallback={fallback} loading={loading}>
      {children}
    </PermissionGuard>
  )
}

export function UsersGuard({ children, action = 'read', fallback, loading }: Omit<PermissionGuardProps, 'permission' | 'resource'>) {
  return (
    <PermissionGuard resource="users" action={action} fallback={fallback} loading={loading}>
      {children}
    </PermissionGuard>
  )
}

export function DepartmentsGuard({ children, action = 'read', fallback, loading }: Omit<PermissionGuardProps, 'permission' | 'resource'>) {
  return (
    <PermissionGuard resource="departments" action={action} fallback={fallback} loading={loading}>
      {children}
    </PermissionGuard>
  )
}

export function ReportsGuard({ children, action = 'read', fallback, loading }: Omit<PermissionGuardProps, 'permission' | 'resource'>) {
  return (
    <PermissionGuard resource="reports" action={action} fallback={fallback} loading={loading}>
      {children}
    </PermissionGuard>
  )
}

export function SettingsGuard({ children, action = 'read', fallback, loading }: Omit<PermissionGuardProps, 'permission' | 'resource'>) {
  return (
    <PermissionGuard resource="settings" action={action} fallback={fallback} loading={loading}>
      {children}
    </PermissionGuard>
  )
}

// Komponenty dla konkretnych akcji
export function CreateGuard({ children, resource, fallback, loading }: Omit<PermissionGuardProps, 'permission' | 'action'>) {
  return (
    <PermissionGuard resource={resource} action="create" fallback={fallback} loading={loading}>
      {children}
    </PermissionGuard>
  )
}

export function ReadGuard({ children, resource, fallback, loading }: Omit<PermissionGuardProps, 'permission' | 'action'>) {
  return (
    <PermissionGuard resource={resource} action="read" fallback={fallback} loading={loading}>
      {children}
    </PermissionGuard>
  )
}

export function UpdateGuard({ children, resource, fallback, loading }: Omit<PermissionGuardProps, 'permission' | 'action'>) {
  return (
    <PermissionGuard resource={resource} action="update" fallback={fallback} loading={loading}>
      {children}
    </PermissionGuard>
  )
}

export function DeleteGuard({ children, resource, fallback, loading }: Omit<PermissionGuardProps, 'permission' | 'action'>) {
  return (
    <PermissionGuard resource={resource} action="delete" fallback={fallback} loading={loading}>
      {children}
    </PermissionGuard>
  )
}

export function ManageGuard({ children, resource, fallback, loading }: Omit<PermissionGuardProps, 'permission' | 'action'>) {
  return (
    <PermissionGuard resource={resource} action="manage" fallback={fallback} loading={loading}>
      {children}
    </PermissionGuard>
  )
}





