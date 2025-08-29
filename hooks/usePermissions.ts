import { useState, useEffect, useCallback } from 'react'
import { useAuthContext } from './useAuth'
import { 
  permissionService, 
  type Permission, 
  type Resource, 
  type Action,
  type UserRole 
} from '@/lib/permissions'

export function usePermissions() {
  const { user, profile } = useAuthContext()
  const [permissions, setPermissions] = useState<Set<Permission>>(new Set())
  const [scopes, setScopes] = useState<Map<Resource, string>>(new Map())
  const [loading, setLoading] = useState(true)

  // Załaduj uprawnienia użytkownika
  const loadPermissions = useCallback(async () => {
    if (!user?.id || !profile?.role) {
      setPermissions(new Set())
      setScopes(new Map())
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      
      // Załaduj uprawnienia do serwisu
      await permissionService.loadUserPermissions(
        user.id, 
        profile.role as UserRole, 
        profile.department_id || undefined
      )

      // Pobierz uprawnienia i scope'y
      const userPermissions = permissionService.getUserPermissions(user.id)
      const userScopes = new Map<Resource, string>()
      
      // Pobierz scope dla każdego zasobu
      ;(['tasks', 'users', 'departments', 'reports', 'settings'] as Resource[]).forEach(resource => {
        userScopes.set(resource, permissionService.getUserResourceScope(user.id, resource))
      })

      setPermissions(userPermissions)
      setScopes(userScopes)
    } catch (error) {
      console.error('Błąd podczas ładowania uprawnień:', error)
      setPermissions(new Set())
      setScopes(new Map())
    } finally {
      setLoading(false)
    }
  }, [user?.id, profile?.role, profile?.department_id])

  // Załaduj uprawnienia przy zmianie użytkownika
  useEffect(() => {
    loadPermissions()
  }, [loadPermissions])

  // Sprawdź czy użytkownik ma uprawnienie
  const hasPermission = useCallback((permission: Permission): boolean => {
    return permissions.has(permission)
  }, [permissions])

  // Sprawdź czy użytkownik ma dostęp do zasobu
  const canAccess = useCallback((resource: Resource, action: Action): boolean => {
    const permission = `${resource}.${action}` as Permission
    return permissions.has(permission)
  }, [permissions])

  // Sprawdź scope dostępu do zasobu
  const getAccessScope = useCallback((resource: Resource): string => {
    return scopes.get(resource) || 'none'
  }, [scopes])

  // Sprawdź czy użytkownik ma globalny dostęp
  const hasGlobalAccess = useCallback((resource: Resource): boolean => {
    return scopes.get(resource) === 'global'
  }, [scopes])

  // Sprawdź czy użytkownik ma dostęp do działu
  const hasDepartmentAccess = useCallback((resource: Resource): boolean => {
    const scope = scopes.get(resource)
    return scope === 'global' || scope === 'department'
  }, [scopes])

  // Sprawdź czy użytkownik ma dostęp tylko do siebie
  const hasOwnAccess = useCallback((resource: Resource): boolean => {
    const scope = scopes.get(resource)
    return scope === 'global' || scope === 'department' || scope === 'own'
  }, [scopes])

  // Sprawdź czy użytkownik może zarządzać innymi
  const canManageOthers = useCallback((resource: Resource): boolean => {
    const scope = scopes.get(resource)
    return scope === 'global' || scope === 'department'
  }, [scopes])

  // Sprawdź czy użytkownik jest superadminem
  const isSuperAdmin = useCallback((): boolean => {
    return profile?.role === 'superadmin'
  }, [profile?.role])

  // Sprawdź czy użytkownik jest dyrektorem
  const isDirector = useCallback((): boolean => {
    return profile?.role === 'dyrektor'
  }, [profile?.role])

  // Sprawdź czy użytkownik jest kierownikiem
  const isManager = useCallback((): boolean => {
    return profile?.role === 'kierownik'
  }, [profile?.role])

  // Sprawdź czy użytkownik jest pracownikiem
  const isEmployee = useCallback((): boolean => {
    return profile?.role === 'pracownik'
  }, [profile?.role])

  // Sprawdź czy użytkownik ma rolę
  const hasRole = useCallback((role: UserRole): boolean => {
    return profile?.role === role
  }, [profile?.role])

  // Sprawdź czy użytkownik ma jedną z ról
  const hasAnyRole = useCallback((roles: UserRole[]): boolean => {
    return profile?.role ? roles.includes(profile.role as UserRole) : false
  }, [profile?.role])

  // Sprawdź czy użytkownik ma wszystkie role
  const hasAllRoles = useCallback((roles: UserRole[]): boolean => {
    return profile?.role ? roles.includes(profile.role as UserRole) : false
  }, [profile?.role])

  // Pobierz wszystkie uprawnienia użytkownika
  const getAllPermissions = useCallback((): Set<Permission> => {
    return new Set(permissions)
  }, [permissions])

  // Pobierz uprawnienia dla zasobu
  const getResourcePermissions = useCallback((resource: Resource): Permission[] => {
    return Array.from(permissions).filter(permission => permission.startsWith(`${resource}.`))
  }, [permissions])

  // Pobierz uprawnienia dla akcji
  const getActionPermissions = useCallback((action: Action): Permission[] => {
    return Array.from(permissions).filter(permission => permission.endsWith(`.${action}`))
  }, [permissions])

  return {
    // Stan
    permissions,
    scopes,
    loading,
    
    // Podstawowe sprawdzanie
    hasPermission,
    canAccess,
    getAccessScope,
    
    // Sprawdzanie scope'ów
    hasGlobalAccess,
    hasDepartmentAccess,
    hasOwnAccess,
    canManageOthers,
    
    // Sprawdzanie ról
    isSuperAdmin,
    isDirector,
    isManager,
    isEmployee,
    hasRole,
    hasAnyRole,
    hasAllRoles,
    
    // Pobieranie uprawnień
    getAllPermissions,
    getResourcePermissions,
    getActionPermissions,
    
    // Reload
    reloadPermissions: loadPermissions
  }
}


