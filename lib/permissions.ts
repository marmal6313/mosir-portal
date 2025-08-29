

// Typy uprawnień
export type Permission = 
  // Zadania
  | 'tasks.create'
  | 'tasks.read'
  | 'tasks.update'
  | 'tasks.delete'
  | 'tasks.assign'
  | 'tasks.complete'
  
  // Użytkownicy
  | 'users.read'
  | 'users.create'
  | 'users.update'
  | 'users.delete'
  | 'users.manage'
  
  // Działy
  | 'departments.read'
  | 'departments.create'
  | 'departments.update'
  | 'departments.delete'
  
  // Raporty
  | 'reports.read'
  | 'reports.export'
  
  // Ustawienia systemu
  | 'settings.read'
  | 'settings.update'
  | 'settings.system'

// Typy ról
export type UserRole = 'superadmin' | 'dyrektor' | 'kierownik' | 'pracownik'

// Typy zasobów
export type Resource = 'tasks' | 'users' | 'departments' | 'reports' | 'settings'

// Typy działań
export type Action = 'create' | 'read' | 'update' | 'delete' | 'assign' | 'complete' | 'manage' | 'export'

// Interfejs uprawnienia
export interface PermissionConfig {
  permission: Permission
  resource: Resource
  action: Action
  roles: UserRole[]
  scope: 'global' | 'department' | 'own' | 'none'
  description: string
}

// Konfiguracja uprawnień
export const PERMISSIONS: PermissionConfig[] = [
  // Zadania
  {
    permission: 'tasks.create',
    resource: 'tasks',
    action: 'create',
    roles: ['superadmin', 'dyrektor', 'kierownik', 'pracownik'],
    scope: 'own',
    description: 'Tworzenie zadań'
  },
  {
    permission: 'tasks.read',
    resource: 'tasks',
    action: 'read',
    roles: ['superadmin', 'dyrektor', 'kierownik', 'pracownik'],
    scope: 'own',
    description: 'Odczyt zadań'
  },
  {
    permission: 'tasks.update',
    resource: 'tasks',
    action: 'update',
    roles: ['superadmin', 'dyrektor', 'kierownik', 'pracownik'],
    scope: 'own',
    description: 'Aktualizacja zadań'
  },
  {
    permission: 'tasks.delete',
    resource: 'tasks',
    action: 'delete',
    roles: ['superadmin', 'dyrektor'],
    scope: 'global',
    description: 'Usuwanie zadań'
  },
  {
    permission: 'tasks.assign',
    resource: 'tasks',
    action: 'assign',
    roles: ['superadmin', 'dyrektor', 'kierownik'],
    scope: 'department',
    description: 'Przydzielanie zadań'
  },
  {
    permission: 'tasks.complete',
    resource: 'tasks',
    action: 'complete',
    roles: ['superadmin', 'dyrektor', 'kierownik', 'pracownik'],
    scope: 'own',
    description: 'Zakończenie zadań'
  },

  // Użytkownicy
  {
    permission: 'users.read',
    resource: 'users',
    action: 'read',
    roles: ['superadmin', 'dyrektor', 'kierownik'],
    scope: 'department',
    description: 'Odczyt użytkowników'
  },
  {
    permission: 'users.create',
    resource: 'users',
    action: 'create',
    roles: ['superadmin', 'dyrektor'],
    scope: 'global',
    description: 'Tworzenie użytkowników'
  },
  {
    permission: 'users.update',
    resource: 'users',
    action: 'update',
    roles: ['superadmin', 'dyrektor', 'kierownik'],
    scope: 'department',
    description: 'Aktualizacja użytkowników'
  },
  {
    permission: 'users.delete',
    resource: 'users',
    action: 'delete',
    roles: ['superadmin', 'dyrektor'],
    scope: 'global',
    description: 'Usuwanie użytkowników'
  },
  {
    permission: 'users.manage',
    resource: 'users',
    action: 'manage',
    roles: ['superadmin', 'dyrektor'],
    scope: 'global',
    description: 'Zarządzanie użytkownikami'
  },

  // Działy
  {
    permission: 'departments.read',
    resource: 'departments',
    action: 'read',
    roles: ['superadmin', 'dyrektor', 'kierownik', 'pracownik'],
    scope: 'global',
    description: 'Odczyt działów'
  },
  {
    permission: 'departments.create',
    resource: 'departments',
    action: 'create',
    roles: ['superadmin', 'dyrektor'],
    scope: 'global',
    description: 'Tworzenie działów'
  },
  {
    permission: 'departments.update',
    resource: 'departments',
    action: 'update',
    roles: ['superadmin', 'dyrektor'],
    scope: 'global',
    description: 'Aktualizacja działów'
  },
  {
    permission: 'departments.delete',
    resource: 'departments',
    action: 'delete',
    roles: ['superadmin', 'dyrektor'],
    scope: 'global',
    description: 'Usuwanie działów'
  },

  // Raporty
  {
    permission: 'reports.read',
    resource: 'reports',
    action: 'read',
    roles: ['superadmin', 'dyrektor', 'kierownik'],
    scope: 'department',
    description: 'Odczyt raportów'
  },
  {
    permission: 'reports.export',
    resource: 'reports',
    action: 'export',
    roles: ['superadmin', 'dyrektor'],
    scope: 'global',
    description: 'Eksport raportów'
  },

  // Ustawienia
  {
    permission: 'settings.read',
    resource: 'settings',
    action: 'read',
    roles: ['superadmin', 'dyrektor'],
    scope: 'global',
    description: 'Odczyt ustawień'
  },
  {
    permission: 'settings.update',
    resource: 'settings',
    action: 'update',
    roles: ['superadmin', 'dyrektor'],
    scope: 'global',
    description: 'Aktualizacja ustawień'
  },
  {
    permission: 'settings.system',
    resource: 'settings',
    action: 'manage',
    roles: ['superadmin'],
    scope: 'global',
    description: 'Zarządzanie ustawieniami systemu'
  }
]

// Klasa PermissionService
export class PermissionService {
  private static instance: PermissionService
  private userPermissions: Map<string, Set<Permission>> = new Map()
  private userScopes: Map<string, Map<Resource, 'global' | 'department' | 'own' | 'none'>> = new Map()

  static getInstance(): PermissionService {
    if (!PermissionService.instance) {
      PermissionService.instance = new PermissionService()
    }
    return PermissionService.instance
  }

  // Sprawdź czy użytkownik ma uprawnienie
  hasPermission(
    userId: string,
    permission: Permission,
    resourceId?: string,
    departmentId?: number
  ): boolean {
    const userPerms = this.userPermissions.get(userId)
    if (!userPerms) return false

    return userPerms.has(permission)
  }

  // Sprawdź czy użytkownik ma dostęp do zasobu
  canAccess(
    userId: string,
    resource: Resource,
    action: Action,
    resourceId?: string,
    departmentId?: number
  ): boolean {
    const permission = `${resource}.${action}` as Permission
    return this.hasPermission(userId, permission, resourceId, departmentId)
  }

  // Sprawdź scope dostępu
  getAccessScope(
    userId: string,
    resource: Resource
  ): 'global' | 'department' | 'own' | 'none' {
    const userScopes = this.userScopes.get(userId)
    if (!userScopes) return 'none'

    const scope = userScopes.get(resource)
    return scope || 'none'
  }

  // Załaduj uprawnienia użytkownika
  async loadUserPermissions(userId: string, userRole: UserRole, userDepartmentId?: number) {
    const permissions = new Set<Permission>()
    const scopes = new Map<Resource, 'global' | 'department' | 'own' | 'none'>()

    // Pobierz uprawnienia dla roli
    PERMISSIONS.forEach(perm => {
      if (perm.roles.includes(userRole)) {
        permissions.add(perm.permission)
        
        // Ustaw scope na podstawie roli i działu
        if (userRole === 'superadmin') {
          scopes.set(perm.resource, 'global')
        } else if (userRole === 'dyrektor') {
          scopes.set(perm.resource, 'global')
        } else if (userRole === 'kierownik' && userDepartmentId) {
          scopes.set(perm.resource, 'department')
        } else if (userRole === 'pracownik') {
          scopes.set(perm.resource, 'own')
        } else {
          scopes.set(perm.resource, 'none')
        }
      }
    })

    this.userPermissions.set(userId, permissions)
    this.userScopes.set(userId, scopes)
  }

  // Wyczyść uprawnienia użytkownika
  clearUserPermissions(userId: string) {
    this.userPermissions.delete(userId)
    this.userScopes.delete(userId)
  }

  // Pobierz wszystkie uprawnienia użytkownika
  getUserPermissions(userId: string): Set<Permission> {
    return this.userPermissions.get(userId) || new Set()
  }

  // Pobierz scope dla zasobu
  getUserResourceScope(userId: string, resource: Resource): 'global' | 'department' | 'own' | 'none' {
    const userScopes = this.userScopes.get(userId)
    const scope = userScopes?.get(resource)
    return scope || 'none'
  }
}

// Funkcje pomocnicze
export const getPermissionConfig = (permission: Permission): PermissionConfig | undefined => {
  return PERMISSIONS.find(p => p.permission === permission)
}

export const getResourcePermissions = (resource: Resource): PermissionConfig[] => {
  return PERMISSIONS.filter(p => p.resource === resource)
}

export const getRolePermissions = (role: UserRole): PermissionConfig[] => {
  return PERMISSIONS.filter(p => p.roles.includes(role))
}

// Eksport instancji
export const permissionService = PermissionService.getInstance()


