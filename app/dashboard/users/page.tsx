'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Users, 
  Search, 
  Filter,
  Edit,
  Trash2,
  Eye,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  X,
  Phone,
  Mail,
  MessageCircle,
  Building
} from 'lucide-react'
import { useRouter } from 'next/navigation'

type User = Database['public']['Views']['users_with_details']['Row']

export default function UsersPage() {
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterRole, setFilterRole] = useState<string>('')
  const [filterDepartment, setFilterDepartment] = useState<string>('')
  const [filterActive, setFilterActive] = useState<string>('')
  const [userProfile, setUserProfile] = useState<User | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [showUserModal, setShowUserModal] = useState(false)

  const loadUsers = useCallback(async () => {
    try {
      console.log('🔍 Ładowanie listy użytkowników...')
      setLoading(true)
      
      let query = supabase
        .from('users_with_details')
        .select('*')
        .order('full_name')

      // Kierownicy widzą tylko użytkowników ze swojego działu
      if (userProfile?.role === 'kierownik' && userProfile?.department_name) {
        console.log('🔍 Kierownik - filtruję po departamencie:', userProfile.department_name)
        query = query.eq('department_name', userProfile.department_name)
      }

      const { data, error } = await query

      if (error) {
        console.error('❌ Błąd ładowania użytkowników:', error)
        throw error
      }

      if (data) {
        console.log('✅ Załadowano użytkowników:', data.length)
        setUsers(data)
      }
    } catch (error) {
      console.error('❌ Błąd podczas ładowania użytkowników:', error)
      setMessage({ type: 'error', text: 'Nie udało się załadować listy użytkowników' })
    } finally {
      setLoading(false)
    }
  }, [userProfile?.role, userProfile?.department_name])

  const checkAuthAndLoadProfile = useCallback(async () => {
    try {
      setLoading(true)
      console.log('🔍 Sprawdzam autoryzację...')
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.log('❌ Brak użytkownika - przekierowanie do logowania')
        router.push('/login')
        return
      }

      console.log('✅ Użytkownik zalogowany:', user.id)
      
      // Załaduj profil użytkownika
      const { data: profile, error } = await supabase
        .from('users_with_details')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error) {
        console.error('❌ Błąd ładowania profilu:', error)
        router.push('/login')
        return
      }

      if (!profile) {
        console.log('❌ Brak profilu - przekierowanie do logowania')
        router.push('/login')
        return
      }

      console.log('✅ Profil załadowany:', profile)
      setUserProfile(profile)

      // Sprawdź uprawnienia - superadmin, dyrektor i kierownik mogą zarządzać użytkownikami
      if (profile.role !== 'superadmin' && profile.role !== 'dyrektor' && profile.role !== 'kierownik') {
        console.log('❌ Brak uprawnień - rola:', profile.role, '- przekierowanie do dashboard')
        router.push('/dashboard')
        return
      }
      
      console.log('✅ Użytkownik ma uprawnienia - rola:', profile.role)
      
      // Załaduj listę użytkowników
      await loadUsers()
    } catch (error) {
      console.error('❌ Błąd autoryzacji:', error)
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }, [router, loadUsers])

  // Sprawdź autoryzację i załaduj profil użytkownika
  useEffect(() => {
    checkAuthAndLoadProfile()
  }, [checkAuthAndLoadProfile])

  // Filtrowanie użytkowników
  const filteredUsers = users.filter(user => {
    const matchesSearch = !searchTerm || 
      user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.position?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.department_name?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesRole = !filterRole || user.role === filterRole
    const matchesDepartment = !filterDepartment || user.department_name === filterDepartment
    const matchesActive = !filterActive || 
      (filterActive === 'active' && user.active) ||
      (filterActive === 'inactive' && !user.active)

    return matchesSearch && matchesRole && matchesDepartment && matchesActive
  })

  // Unikalne role i departamenty do filtrowania
  const uniqueRoles = [...new Set(users.map(u => u.role).filter(Boolean))]
  const uniqueDepartments = [...new Set(users.map(u => u.department_name).filter(Boolean))]

  const getRoleBadgeVariant = (role: string | null) => {
    switch (role) {
      case 'superadmin': return 'destructive'
      case 'dyrektor': return 'default'
      case 'kierownik': return 'secondary'
      case 'pracownik': return 'outline'
      default: return 'outline'
    }
  }

  const getActiveBadgeVariant = (active: boolean | null) => {
    return active ? 'default' : 'secondary'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-gray-100 p-4 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Ładowanie użytkowników...</p>
        </div>
      </div>
    )
  }

  if (!userProfile || (userProfile.role !== 'superadmin' && userProfile.role !== 'dyrektor' && userProfile.role !== 'kierownik')) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-gray-100 p-4 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 mx-auto mb-3 text-red-500" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Brak dostępu</h1>
          <p className="text-gray-600">Nie masz uprawnień do przeglądania tej strony.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-gray-100 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Nagłówek */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl">
                <Users className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Zarządzanie użytkownikami</h1>
                <p className="text-gray-600">
                  {(userProfile.role as string) === 'kierownik' 
                    ? `Lista użytkowników z działu: ${userProfile.department_name}`
                    : 'Lista wszystkich użytkowników systemu MOSiR Portal'
                  }
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Badge variant="secondary" className="text-sm">
                {userProfile.role === 'superadmin' ? 'Superadmin' : 
                 userProfile.role === 'dyrektor' ? 'Dyrektor' : 'Kierownik'}: {userProfile.full_name}
              </Badge>
              <Button
                onClick={loadUsers}
                variant="outline"
                size="sm"
                className="flex items-center space-x-2"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Odśwież</span>
              </Button>
            </div>
          </div>
          
          {/* Statystyki */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600">Wszyscy użytkownicy</p>
                  <p className="text-2xl font-bold text-blue-900">{users.length}</p>
                </div>
                <Users className="h-8 w-8 text-blue-400" />
              </div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-600">Aktywni</p>
                  <p className="text-2xl font-bold text-green-900">{users.filter(u => u.active).length}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-400" />
              </div>
            </div>
            <div className="bg-orange-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-orange-600">Kierownicy</p>
                  <p className="text-2xl font-bold text-orange-900">{users.filter(u => u.role === 'kierownik').length}</p>
                </div>
                <Building className="h-8 w-8 text-orange-400" />
              </div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-600">Departamenty</p>
                  <p className="text-2xl font-bold text-purple-900">{uniqueDepartments.length}</p>
                </div>
                <Building className="h-8 w-8 text-purple-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Wiadomości */}
        {message && (
          <div className={`p-4 rounded-lg border ${
            message.type === 'success' 
              ? 'bg-green-50 border-green-200 text-green-800' 
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            <div className="flex items-center space-x-2">
              {message.type === 'success' ? (
                <CheckCircle className="h-5 w-5" />
              ) : (
                <AlertTriangle className="h-5 w-5" />
              )}
              <span>{message.text}</span>
            </div>
          </div>
        )}

        {/* Filtry i wyszukiwanie */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Filter className="h-5 w-5" />
              <span>Filtry i wyszukiwanie</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Wyszukiwanie */}
              <div className="lg:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Wyszukaj</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Imię, nazwisko, email, stanowisko..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Filtry */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Rola</label>
                <select
                  value={filterRole}
                  onChange={(e) => setFilterRole(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Wszystkie role</option>
                  {uniqueRoles.map((role) => (
                    <option key={role} value={role as string}>{role}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Departament</label>
                <select
                  value={filterDepartment}
                  onChange={(e) => setFilterDepartment(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Wszystkie departamenty</option>
                  {uniqueDepartments.map((dept) => (
                    <option key={dept} value={dept as string}>{dept}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  value={filterActive}
                  onChange={(e) => setFilterActive(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Wszystkie</option>
                  <option value="active">Aktywni</option>
                  <option value="inactive">Nieaktywni</option>
                </select>
              </div>
            </div>

            {/* Przyciski resetowania filtrów */}
            {(searchTerm || filterRole || filterDepartment || filterActive) && (
              <div className="mt-4 flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchTerm('')
                    setFilterRole('')
                    setFilterDepartment('')
                    setFilterActive('')
                  }}
                  className="flex items-center space-x-2"
                >
                  <X className="h-4 w-4" />
                  <span>Wyczyść filtry</span>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Lista użytkowników */}
        <Card>
          <CardHeader>
            <CardTitle>Lista użytkowników ({filteredUsers.length})</CardTitle>
            <CardDescription>
              {filteredUsers.length === users.length 
                ? `Wyświetlono wszystkich ${users.length} użytkowników`
                : `Wyświetlono ${filteredUsers.length} z ${users.length} użytkowników`
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredUsers.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                <p className="text-gray-600">Nie znaleziono użytkowników spełniających kryteria</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-medium text-gray-900">Użytkownik</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900">Kontakt</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900">Stanowisko</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900">Departament</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900">Rola</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900">Status</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900">Akcje</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => (
                      <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
                              <span className="text-white font-medium text-sm">
                                {user.first_name?.[0]}{user.last_name?.[0]}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{user.full_name}</p>
                              <p className="text-sm text-gray-500">ID: {user.id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="space-y-1">
                            {user.email && (
                              <div className="flex items-center space-x-2 text-sm">
                                <Mail className="h-4 w-4 text-gray-400" />
                                <span className="text-gray-700">{user.email}</span>
                              </div>
                            )}
                            {user.phone && (
                              <div className="flex items-center space-x-2 text-sm">
                                <Phone className="h-4 w-4 text-gray-400" />
                                <span className="text-gray-700">{user.phone}</span>
                              </div>
                            )}
                            {user.whatsapp && (
                              <div className="flex items-center space-x-2 text-sm">
                                <MessageCircle className="h-4 w-4 text-gray-400" />
                                <span className="text-gray-700">{user.whatsapp}</span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-gray-700">{user.position || '-'}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-gray-700">{user.department_name || '-'}</span>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant={getRoleBadgeVariant(user.role)}>
                            {user.role || 'brak'}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant={getActiveBadgeVariant(user.active)}>
                            {user.active ? 'Aktywny' : 'Nieaktywny'}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedUser(user)
                                setShowUserModal(true)
                              }}
                              className="p-2"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {userProfile.role === 'superadmin' && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="p-2 text-blue-600 hover:text-blue-700"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="p-2 text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal szczegółów użytkownika */}
      {showUserModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl max-h-[90vh] overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Szczegóły użytkownika</h3>
              <button
                onClick={() => setShowUserModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-medium text-lg">
                    {selectedUser.first_name?.[0]}{selectedUser.last_name?.[0]}
                  </span>
                </div>
                <div>
                  <h4 className="text-xl font-semibold">{selectedUser.full_name}</h4>
                  <p className="text-gray-600">ID: {selectedUser.id}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h5 className="font-medium text-gray-900 mb-2">Informacje podstawowe</h5>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Imię:</span>
                      <span className="text-gray-900">{selectedUser.first_name || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Nazwisko:</span>
                      <span className="text-gray-900">{selectedUser.last_name || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Stanowisko:</span>
                      <span className="text-gray-900">{selectedUser.position || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Departament:</span>
                      <span className="text-gray-900">{selectedUser.department_name || '-'}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h5 className="font-medium text-gray-900 mb-2">Kontakt i uprawnienia</h5>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Email:</span>
                      <span className="text-gray-900">{selectedUser.email || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Telefon:</span>
                      <span className="text-gray-900">{selectedUser.phone || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">WhatsApp:</span>
                      <span className="text-gray-900">{selectedUser.whatsapp || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Rola:</span>
                      <Badge variant={getRoleBadgeVariant(selectedUser.role)}>
                        {selectedUser.role || 'brak'}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Status:</span>
                  <Badge variant={getActiveBadgeVariant(selectedUser.active)}>
                    {selectedUser.active ? 'Aktywny' : 'Nieaktywny'}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
