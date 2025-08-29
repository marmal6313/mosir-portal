import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Shield, 
  Globe,
  Building2,
  User,
  Save,
  RefreshCw,
  Info
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { type Resource } from '@/lib/permissions'

interface ScopeConfig {
  [roleName: string]: {
    [resource: string]: 'global' | 'department' | 'own' | 'none'
  }
}

interface Role {
  id: string
  name: string
  display_name: string
}

const RESOURCE_ICONS = {
  tasks: '📋',
  users: '👥',
  departments: '🏢',
  reports: '📊',
  settings: '⚙️'
}

const RESOURCE_LABELS = {
  tasks: 'Zadania',
  users: 'Użytkownicy',
  departments: 'Działy',
  reports: 'Raporty',
  settings: 'Ustawienia'
}

const SCOPE_OPTIONS = [
  { value: 'global', label: 'Globalny', description: 'Dostęp do wszystkich zasobów', color: 'bg-green-100 text-green-800 border-green-200' },
  { value: 'department', label: 'Działowy', description: 'Dostęp tylko do swojego działu', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { value: 'own', label: 'Własny', description: 'Dostęp tylko do własnych zasobów', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  { value: 'none', label: 'Brak', description: 'Brak dostępu', color: 'bg-gray-100 text-gray-600 border-gray-200' }
]

const DEFAULT_SCOPES: ScopeConfig = {
  superadmin: {
    tasks: 'global',
    users: 'global',
    departments: 'global',
    reports: 'global',
    settings: 'global'
  },
  dyrektor: {
    tasks: 'global',
    users: 'global',
    departments: 'global',
    reports: 'global',
    settings: 'none'
  },
  kierownik: {
    tasks: 'department',
    users: 'department',
    departments: 'own',
    reports: 'department',
    settings: 'none'
  },
  pracownik: {
    tasks: 'own',
    users: 'own',
    departments: 'own',
    reports: 'none',
    settings: 'none'
  }
}

export function ScopeManager() {
  const [roles, setRoles] = useState<Role[]>([])
  const [scopeConfig, setScopeConfig] = useState<ScopeConfig>({})
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    loadRoles()
  }, [])

  const loadRoles = async () => {
    try {
      setLoading(true)
      
      const { data: dbRoles, error } = await supabase
        .from('roles')
        .select('*')
        .order('created_at')

      if (error) {
        console.error('Błąd podczas ładowania ról:', error)
        return
      }

      if (dbRoles) {
        setRoles(dbRoles)
        
        // Załaduj scope'y z bazy danych
        const { data: scopesData, error: scopesError } = await supabase
          .from('role_scopes')
          .select('*')

        if (scopesError) {
          console.error('Błąd podczas ładowania scope\'ów:', scopesError)
          return
        }

        // Przekształć dane scope'ów na format ScopeConfig
        const scopes: ScopeConfig = {}
        dbRoles.forEach(role => {
          scopes[role.name] = {
            tasks: 'own',
            users: 'own',
            departments: 'own',
            reports: 'none',
            settings: 'none'
          }
        })

        // Zastąp domyślne wartości wartościami z bazy
        scopesData?.forEach(scope => {
          const role = dbRoles.find(r => r.id === scope.role_id)
          if (role && scope.resource in scopes[role.name]) {
            scopes[role.name][scope.resource as keyof typeof scopes[typeof role.name]] = scope.scope as 'global' | 'department' | 'own' | 'none'
          }
        })
        
        setScopeConfig(scopes)
      }
    } catch (error) {
      console.error('Błąd podczas ładowania ról:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateScope = (roleName: string, resource: Resource, scope: string) => {
    setScopeConfig(prev => ({
      ...prev,
      [roleName]: {
        ...prev[roleName],
        [resource]: scope as 'global' | 'department' | 'own' | 'none'
      }
    }))
  }

  const saveScopes = async () => {
    try {
      setLoading(true)
      
      // Zapisz scope'y do bazy danych
      for (const roleName in scopeConfig) {
        const role = roles.find(r => r.name === roleName)
        if (!role) continue

        // Usuń istniejące scope'y dla tej roli
        await supabase
          .from('role_scopes')
          .delete()
          .eq('role_id', role.id)

        // Wstaw nowe scope'y
        const scopesToInsert = Object.entries(scopeConfig[roleName]).map(([resource, scope]) => ({
          role_id: role.id,
          resource,
          scope
        }))

        const { error } = await supabase
          .from('role_scopes')
          .insert(scopesToInsert)

        if (error) throw error
      }

      setMessage({ type: 'success', text: 'Scope\'y zostały zapisane' })
    } catch (error) {
      console.error('Błąd podczas zapisywania scope\'ów:', error)
      setMessage({ type: 'error', text: 'Błąd podczas zapisywania scope\'ów' })
    } finally {
      setLoading(false)
    }
  }

  const resetToDefaults = () => {
    if (!confirm('Czy na pewno chcesz zresetować wszystkie scope\'y do domyślnych?')) return
    setScopeConfig(DEFAULT_SCOPES)
    setMessage({ type: 'success', text: 'Zresetowano do domyślnych scope\'ów' })
  }



  const getRoleDisplayName = (roleName: string) => {
    const role = roles.find(r => r.name === roleName)
    return role?.display_name || roleName
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Zarządzanie scope&apos;ami uprawnień
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Wiadomości */}
          {message && (
            <div className={`p-3 rounded-lg border ${
              message.type === 'success' 
                ? 'bg-green-50 border-green-200 text-green-800' 
                : 'bg-red-50 border-red-200 text-red-800'
            }`}>
              {message.text}
            </div>
          )}

          {/* Akcje */}
          <div className="flex items-center gap-3">
            <Button 
              onClick={saveScopes}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700"
            >
              <Save className="h-4 w-4 mr-2" />
              Zapisz scope&apos;y
            </Button>
            
            <Button 
              variant="outline"
              onClick={resetToDefaults}
              disabled={loading}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Resetuj do domyślnych
            </Button>
          </div>

          {/* Opis scope&apos;ów */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {SCOPE_OPTIONS.map(option => (
              <div key={option.value} className={`p-3 rounded-lg border ${option.color}`}>
                <div className="flex items-center gap-2 mb-1">
                  {option.value === 'global' && <Globe className="h-4 w-4" />}
                  {option.value === 'department' && <Building2 className="h-4 w-4" />}
                  {option.value === 'own' && <User className="h-4 w-4" />}
                  {option.value === 'none' && <Shield className="h-4 w-4" />}
                  <span className="font-medium text-sm">{option.label}</span>
                </div>
                <p className="text-xs">{option.description}</p>
              </div>
            ))}
          </div>

          {/* Macierz scope&apos;ów */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm border rounded-lg">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left p-3 font-medium border-b">Zasób</th>
                  {roles.map(role => (
                    <th key={role.name} className="text-center p-3 font-medium border-b">
                      <div className="flex flex-col items-center gap-1">
                        <Badge variant="secondary" className="text-xs">
                          {getRoleDisplayName(role.name)}
                        </Badge>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(['tasks', 'users', 'departments', 'reports', 'settings'] as Resource[]).map(resource => (
                  <tr key={resource} className="hover:bg-gray-50">
                    <td className="p-3 border-b">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{RESOURCE_ICONS[resource]}</span>
                        <div>
                          <span className="font-medium">{RESOURCE_LABELS[resource]}</span>
                        </div>
                      </div>
                    </td>
                    {roles.map(role => (
                      <td key={role.name} className="p-3 border-b text-center">
                        <select
                          value={scopeConfig[role.name]?.[resource] || 'own'}
                          onChange={(e) => updateScope(role.name, resource, e.target.value)}
                          className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          {SCOPE_OPTIONS.map(option => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Podsumowanie scope&apos;ów */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {roles.map(role => {
              const roleScopes = scopeConfig[role.name] || {}
              const globalCount = Object.values(roleScopes).filter(scope => scope === 'global').length
              const departmentCount = Object.values(roleScopes).filter(scope => scope === 'department').length
              const ownCount = Object.values(roleScopes).filter(scope => scope === 'own').length
              const noneCount = Object.values(roleScopes).filter(scope => scope === 'none').length
              
              return (
                <div key={role.name} className="p-4 bg-gray-50 rounded-lg border">
                  <div className="flex items-center gap-2 mb-3">
                    <Shield className="h-4 w-4 text-blue-600" />
                    <span className="font-medium">{getRoleDisplayName(role.name)}</span>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600">Globalny:</span>
                      <Badge className="bg-green-100 text-green-800 text-xs">{globalCount}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600">Działowy:</span>
                      <Badge className="bg-blue-100 text-blue-800 text-xs">{departmentCount}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600">Własny:</span>
                      <Badge className="bg-yellow-100 text-yellow-800 text-xs">{ownCount}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600">Brak:</span>
                      <Badge className="bg-gray-100 text-gray-600 text-xs">{noneCount}</Badge>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Informacje o scope&apos;ach */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-2">
              <Info className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-blue-900 mb-2">Informacje o scope&apos;ach:</h4>
                <div className="text-sm text-blue-800 space-y-1">
                  <p>• <strong>Globalny:</strong> Dostęp do wszystkich zasobów w systemie</p>
                  <p>• <strong>Działowy:</strong> Dostęp tylko do zasobów z własnego działu</p>
                  <p>• <strong>Własny:</strong> Dostęp tylko do własnych zasobów</p>
                  <p>• <strong>Brak:</strong> Brak dostępu do zasobu</p>
                  <p>• <strong>Scope&apos;y</strong> określają poziom dostępu do zasobów dla każdej roli</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
