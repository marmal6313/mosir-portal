import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { 
  Shield, 
  FileText, 
  User, 
  Building2, 
  BarChart3, 
  Settings,
  Save,
  RefreshCw
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { PERMISSIONS, type Permission, type Resource } from '@/lib/permissions'
import type { Database } from '@/types/database'

type Role = Database['public']['Tables']['roles']['Row']

interface PermissionMatrix {
  [roleName: string]: {
    [permission: string]: boolean
  }
}

const RESOURCE_ICONS = {
  tasks: FileText,
  users: User,
  departments: Building2,
  reports: BarChart3,
  settings: Settings
}

const RESOURCE_LABELS = {
  tasks: 'Zadania',
  users: 'Użytkownicy',
  departments: 'Działy',
  reports: 'Raporty',
  settings: 'Ustawienia'
}



export function PermissionManager() {
  const [roles, setRoles] = useState<Role[]>([])
  const [permissionMatrix, setPermissionMatrix] = useState<PermissionMatrix>({})
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    loadRoles()
  }, [])

  const loadRoles = async () => {
    try {
      setLoading(true)
      
      // Pobierz role z tabeli roles
      const { data: rolesData, error } = await supabase
        .from('roles')
        .select('*')
        .order('name')

      if (error) {
        throw error
      }

      if (rolesData) {
        setRoles(rolesData)
        
        // Utwórz macierz uprawnień
        const matrix: PermissionMatrix = {}
        rolesData.forEach(role => {
          matrix[role.name] = {}
          PERMISSIONS.forEach(permission => {
                      matrix[role.name][permission.permission] = 
            (role.permissions && role.permissions.includes(permission.permission)) || 
            (role.permissions && role.permissions.includes('*')) ||
            (role.permissions && role.permissions.includes(`${permission.resource}.*`)) || false
          })
        })
        setPermissionMatrix(matrix)
      }
      
    } catch (error) {
      console.error('Błąd podczas ładowania ról:', error)
      setMessage({ type: 'error', text: 'Błąd podczas ładowania ról' })
    } finally {
      setLoading(false)
    }
  }

  const togglePermission = (roleName: string, permission: string) => {
    setPermissionMatrix(prev => ({
      ...prev,
      [roleName]: {
        ...prev[roleName],
        [permission]: !prev[roleName]?.[permission]
      }
    }))
  }

  const savePermissions = async () => {
    try {
      setLoading(true)
      
      // Zapisz uprawnienia do tabeli roles
      for (const [roleName, permissions] of Object.entries(permissionMatrix)) {
        const role = roles.find(r => r.name === roleName)
        if (role) {
          const permissionList = Object.entries(permissions)
            .filter(([, hasPermission]) => hasPermission)
            .map(([permission]) => permission)

          const { error } = await supabase
            .from('roles')
            .update({ 
              permissions: permissionList,
              updated_at: new Date().toISOString()
            })
            .eq('id', role.id)

          if (error) {
            throw error
          }
        }
      }
      
      setMessage({ type: 'success', text: 'Uprawnienia zostały zapisane pomyślnie!' })
      
    } catch (error) {
      console.error('Błąd podczas zapisywania uprawnień:', error)
      setMessage({ type: 'error', text: 'Błąd podczas zapisywania uprawnień' })
    } finally {
      setLoading(false)
    }
  }

  const resetToDefaults = async () => {
    if (!confirm('Czy na pewno chcesz zresetować wszystkie uprawnienia do domyślnych?')) return
    
    try {
      setLoading(true)
      
      // Zresetuj uprawnienia w bazie danych
      const { error } = await supabase
        .from('roles')
        .update({ 
          permissions: [],
          updated_at: new Date().toISOString()
        })

      if (error) {
        throw error
      }

      // Przeładuj role
      await loadRoles()
      setMessage({ type: 'success', text: 'Zresetowano do domyślnych uprawnień' })
      
    } catch (error) {
      console.error('Błąd podczas resetowania uprawnień:', error)
      setMessage({ type: 'error', text: 'Błąd podczas resetowania uprawnień' })
    } finally {
      setLoading(false)
    }
  }



  const getResourcePermissions = (resource: Resource) => {
    return PERMISSIONS.filter(p => p.resource === resource)
  }

  const getRolePermissions = (roleName: string) => {
    const role = roles.find(r => r.name === roleName)
    return role?.permissions || []
  }

  const getRoleDisplayName = (roleName: string) => {
    const role = roles.find(r => r.name === roleName)
    return role?.display_name || roleName
  }

  const getPermissionDescription = (permission: Permission) => {
    const perm = PERMISSIONS.find(p => p.permission === permission)
    return perm?.description || permission
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Zarządzanie uprawnieniami
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
              onClick={savePermissions}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700"
            >
              <Save className="h-4 w-4 mr-2" />
              Zapisz uprawnienia
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

          {/* Macierz uprawnień */}
          <div className="space-y-6">
            {(['tasks', 'users', 'departments', 'reports', 'settings'] as Resource[]).map(resource => {
              const Icon = RESOURCE_ICONS[resource]
              const resourcePermissions = getResourcePermissions(resource)
              
              return (
                <div key={resource} className="border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Icon className="h-5 w-5 text-blue-600" />
                    <h3 className="text-lg font-semibold">{RESOURCE_LABELS[resource]}</h3>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2 font-medium">Uprawnienie</th>
                          {roles.map(role => (
                            <th key={role.name} className="text-center p-2 font-medium">
                              <div className="flex flex-col items-center gap-1">
                                <Badge variant="secondary" className="text-xs">
                                  {getRoleDisplayName(role.name)}
                                </Badge>
                                <span className="text-xs text-gray-500">
                                  {getRolePermissions(role.name).length}
                                </span>
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {resourcePermissions.map(permission => (
                          <tr key={permission.permission} className="border-b hover:bg-gray-50">
                            <td className="p-2">
                              <div className="flex flex-col">
                                <span className="font-medium">{permission.permission}</span>
                                <span className="text-xs text-gray-500">
                                  {getPermissionDescription(permission.permission)}
                                </span>
                              </div>
                            </td>
                            {roles.map(role => (
                              <td key={role.name} className="text-center p-2">
                                <Checkbox
                                  checked={permissionMatrix[role.name]?.[permission.permission] || false}
                                  onCheckedChange={() => togglePermission(role.name, permission.permission)}
                                  className="h-4 w-4"
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Podsumowanie uprawnień */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {roles.map(role => {
              const enabledPermissions = Object.values(permissionMatrix[role.name] || {}).filter(Boolean).length
              const totalPermissions = PERMISSIONS.length
              
              return (
                <div key={role.name} className="p-4 bg-gray-50 rounded-lg border">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="h-4 w-4 text-blue-600" />
                    <span className="font-medium">{getRoleDisplayName(role.name)}</span>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Aktywne:</span>
                      <Badge variant="secondary" className="text-xs">
                        {enabledPermissions}
                      </Badge>
                    </div>
                    
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${(enabledPermissions / totalPermissions) * 100}%` }}
                      ></div>
                    </div>
                    
                    <p className="text-xs text-gray-500">
                      {enabledPermissions} z {totalPermissions} uprawnień
                    </p>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Informacje o uprawnieniach */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">Informacje o uprawnieniach:</h4>
            <div className="text-sm text-blue-800 space-y-1">
              <p>• <strong>Zaznacz checkbox</strong> aby przyznać uprawnienie roli</p>
              <p>• <strong>Odznacz checkbox</strong> aby odebrać uprawnienie</p>
              <p>• <strong>Zapisz uprawnienia</strong> aby zastosować zmiany</p>
              <p>• <strong>Resetuj do domyślnych</strong> aby przywrócić standardowe ustawienia</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}


