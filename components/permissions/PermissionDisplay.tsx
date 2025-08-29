import React from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  Shield, 
  User, 
  Building2, 
  FileText, 
  BarChart3, 
  Settings,
  CheckCircle,
  XCircle
} from 'lucide-react'

export function PermissionDisplay() {
  const { 
    scopes, 
    loading, 
    isSuperAdmin, 
    isDirector, 
    isManager, 
    isEmployee,
    getAllPermissions,
    getResourcePermissions,
    getAccessScope
  } = usePermissions()

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Uprawnienia użytkownika
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="ml-2">Ładowanie uprawnień...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  const allPermissions = getAllPermissions()
  const resourceIcons = {
    tasks: FileText,
    users: User,
    departments: Building2,
    reports: BarChart3,
    settings: Settings
  }

  const scopeColors = {
    global: 'bg-green-100 text-green-800 border-green-200',
    department: 'bg-blue-100 text-blue-800 border-blue-200',
    own: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    none: 'bg-gray-100 text-gray-600 border-gray-200'
  } as const

  const scopeLabels = {
    global: 'Globalny',
    department: 'Dział',
    own: 'Własny',
    none: 'Brak'
  } as const

  type ScopeType = keyof typeof scopeColors

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Uprawnienia użytkownika
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Rola użytkownika */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Rola:</span>
            <Badge variant="secondary" className="text-sm">
              {isSuperAdmin() ? 'Super Administrator' :
               isDirector() ? 'Dyrektor' :
               isManager() ? 'Kierownik' :
               isEmployee() ? 'Pracownik' : 'Nieznana'}
            </Badge>
          </div>

          {/* Uprawnienia według zasobów */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-700">Uprawnienia według zasobów:</h4>
            
            {(['tasks', 'users', 'departments', 'reports', 'settings'] as const).map(resource => {
              const Icon = resourceIcons[resource]
              const scope = getAccessScope(resource)
              const resourcePermissions = getResourcePermissions(resource)
              
              return (
                <div key={resource} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-gray-600" />
                    <span className="text-sm font-medium capitalize">{resource}</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Badge className={`text-xs ${scopeColors[scope as ScopeType] || scopeColors.none}`}>
                      {scopeLabels[scope as ScopeType] || scopeLabels.none}
                    </Badge>
                    
                    <span className="text-xs text-gray-500">
                      {resourcePermissions.length} uprawnień
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Szczegółowe uprawnienia */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-700">Szczegółowe uprawnienia:</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {Array.from(allPermissions).map(permission => {
                const [resource, action] = permission.split('.')
                const Icon = resourceIcons[resource as keyof typeof resourceIcons]
                
                return (
                  <div key={permission} className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded text-xs">
                    <CheckCircle className="h-3 w-3 text-green-600" />
                    <Icon className="h-3 w-3 text-gray-600" />
                    <span className="font-medium capitalize">{resource}</span>
                    <span className="text-gray-500">•</span>
                    <span className="capitalize">{action}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Brak uprawnień */}
          {allPermissions.size === 0 && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <XCircle className="h-4 w-4 text-red-600" />
              <span className="text-sm text-red-700">Brak uprawnień</span>
            </div>
          )}

          {/* Podsumowanie */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Podsumowanie:</p>
              <p>• Łącznie uprawnień: {allPermissions.size}</p>
              <p>• Zasoby z dostępem: {Array.from(scopes.values()).filter(scope => scope !== 'none').length}</p>
              <p>• Poziom dostępu: {isSuperAdmin() ? 'Pełny' : isDirector() ? 'Globalny' : isManager() ? 'Działowy' : 'Ograniczony'}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}


