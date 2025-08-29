'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { User } from '@supabase/supabase-js'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { 
  Building2, 
  Calendar,
  Edit3,
  X,
  CheckCircle,
  AlertCircle,
  Info
} from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import type { Database } from '@/types/database'

type UserProfile = Database["public"]["Views"]["users_with_details"]["Row"]
type Department = Database["public"]["Tables"]["departments"]["Row"]

export default function ProfilePage() {
  const router = useRouter()
  const { toast } = useToast()
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  
  // Form state
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    whatsapp: '',
    department_id: null as number | null
  })

  // Check authentication and load profile
  const checkAuthAndLoadProfile = useCallback(async () => {
    try {
      setLoading(true)
      console.log('🔍 Profile: Rozpoczynam ładowanie profilu...')
      
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError) throw userError
      if (!user) {
        console.log('❌ Profile: Brak użytkownika, przekierowuję do loginu')
        router.push('/login')
        return
      }
      
      console.log('✅ Profile: Użytkownik pobrany:', user.id, user.email)
      setUser(user)
      
      // Load user profile
      console.log('🔍 Profile: Pobieram profil z users_with_details dla ID:', user.id)
      const { data: profileData, error: profileError } = await supabase
        .from('users_with_details')
        .select('*')
        .eq('id', user.id)
        .single()
      
      if (profileError) {
        console.error('❌ Profile: Błąd pobierania profilu:', profileError)
        throw profileError
      }
      if (!profileData) {
        console.error('❌ Profile: Brak danych profilu')
        toast({
          title: "Błąd",
          description: "Nie udało się załadować profilu użytkownika",
          variant: "destructive"
        })
        return
      }
      
      console.log('✅ Profile: Profil pobrany:', profileData)
      console.log('🔍 Profile: Department ID:', profileData.department_id)
      console.log('🔍 Profile: Department Name:', profileData.department_name)
      
      setProfile(profileData)
      setFormData({
        first_name: profileData.first_name || '',
        last_name: profileData.last_name || '',
        phone: profileData.phone || '',
        whatsapp: profileData.whatsapp || '',
        department_id: profileData.department_id
      })
      
      console.log('✅ Profile: FormData ustawione:', {
        first_name: profileData.first_name || '',
        last_name: profileData.last_name || '',
        phone: profileData.phone || '',
        whatsapp: profileData.whatsapp || '',
        department_id: profileData.department_id
      })
      
      // Load departments
      console.log('🔍 Profile: Pobieram listę działów...')
      const { data: deps, error: depsError } = await supabase
        .from('departments')
        .select('*')
        .order('name')
      
      if (depsError) {
        console.error('❌ Profile: Błąd pobierania działów:', depsError)
        throw depsError
      }
      
      console.log('✅ Profile: Działy pobrane:', deps)
      setDepartments(deps || [])
      
    } catch (error) {
      console.error('Błąd podczas ładowania profilu:', error)
      toast({
        title: "Błąd",
        description: "Nie udało się załadować profilu",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }, [router, toast])

  useEffect(() => {
    checkAuthAndLoadProfile()
  }, [checkAuthAndLoadProfile])

  const handleSave = async () => {
    if (!user || !profile) return
    
    try {
      setSaving(true)
      
      console.log('🔍 Próba zapisania profilu:', {
        userId: user.id,
        formData,
        currentProfile: profile
      })
      
      const { error } = await supabase
        .from('users')
        .update({
          first_name: formData.first_name,
          last_name: formData.last_name,
          phone: formData.phone,
          whatsapp: formData.whatsapp,
          department_id: formData.department_id
        })
        .eq('id', user.id)
      
      if (error) throw error
      
      // Update local profile
      setProfile(prev => prev ? {
        ...prev,
        ...formData
      } : null)
      
      setIsEditing(false)
      
      toast({
        title: "Sukces",
        description: "Profil został zaktualizowany",
        variant: "default"
      })
      
    } catch (error) {
      console.error('Błąd podczas zapisywania profilu:', error)
      console.error('Szczegóły błędu:', JSON.stringify(error, null, 2))
      toast({
        title: "Błąd",
        description: `Nie udało się zapisać zmian: ${error instanceof Error ? error.message : 'Nieznany błąd'}`,
        variant: "destructive"
      })
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    if (profile) {
      setFormData({
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        phone: profile.phone || '',
        whatsapp: profile.whatsapp || '',
        department_id: profile.department_id
      })
    }
    setIsEditing(false)
  }

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'superadmin': return 'Super Administrator'
      case 'dyrektor': return 'Dyrektor'
      case 'kierownik': return 'Kierownik'
      case 'pracownik': return 'Pracownik'
      default: return role
    }
  }

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'superadmin': return 'destructive'
      case 'dyrektor': return 'default'
      case 'kierownik': return 'secondary'
      case 'pracownik': return 'outline'
      default: return 'outline'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Ładowanie profilu...</p>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Błąd</h2>
          <p className="text-gray-600">Nie udało się załadować profilu użytkownika</p>
          <Button onClick={() => checkAuthAndLoadProfile()} className="mt-4">
            Spróbuj ponownie
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Mój Profil</h1>
        <p className="text-gray-600">Zarządzaj swoimi danymi osobowymi i ustawieniami</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left Column - Profile Info */}
        <div className="md:col-span-1">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4">
                <Avatar className="h-24 w-24 ring-4 ring-blue-500">
                  <AvatarFallback className="bg-gradient-to-br from-blue-600 to-blue-700 text-white text-2xl font-bold">
                    {profile.first_name?.[0]}{profile.last_name?.[0]}
                  </AvatarFallback>
                </Avatar>
              </div>
              <CardTitle className="text-xl">
                {profile.first_name} {profile.last_name}
              </CardTitle>
              <CardDescription>{profile.email}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <Badge variant={getRoleBadgeVariant(profile.role || 'pracownik')} className="text-sm">
                  {getRoleDisplayName(profile.role || 'pracownik')}
                </Badge>
              </div>
              
              <hr className="border-gray-200" />
              
              <div className="space-y-3">
                <div className="flex items-center text-sm text-gray-600">
                  <Building2 className="w-4 h-4 mr-2" />
                  <span>{profile.department_name || 'Brak działu'}</span>
                </div>
                

              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Edit Form */}
        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Dane Osobowe</CardTitle>
                  <CardDescription>Edytuj swoje dane kontaktowe i informacje</CardDescription>
                </div>
                {!isEditing ? (
                  <Button onClick={() => setIsEditing(true)} variant="outline" size="sm">
                    <Edit3 className="w-4 h-4 mr-2" />
                    Edytuj
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button onClick={handleCancel} variant="outline" size="sm">
                      <X className="w-4 h-4 mr-2" />
                      Anuluj
                    </Button>
                    <Button onClick={handleSave} disabled={saving} size="sm">
                      {saving ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      ) : (
                        <CheckCircle className="w-4 h-4 mr-2" />
                      )}
                      Zapisz
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="first_name">Imię</Label>
                  <Input
                    id="first_name"
                    value={formData.first_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                    disabled={!isEditing}
                    placeholder="Wprowadź imię"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="last_name">Nazwisko</Label>
                  <Input
                    id="last_name"
                    value={formData.last_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                    disabled={!isEditing}
                    placeholder="Wprowadź nazwisko"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefon stacjonarny</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    disabled={!isEditing}
                    placeholder="+48 123 456 789"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="whatsapp">WhatsApp</Label>
                  <Input
                    id="whatsapp"
                    value={formData.whatsapp}
                    onChange={(e) => setFormData(prev => ({ ...prev, whatsapp: e.target.value }))}
                    disabled={!isEditing}
                    placeholder="+48 123 456 789"
                  />
                </div>
                
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="department">Dział</Label>
                  {(() => {
                    console.log('🔍 Profile: Renderuję select box z:', {
                      formDataDepartmentId: formData.department_id,
                      departments: departments,
                      selectedValue: formData.department_id ? formData.department_id.toString() : ''
                    })
                    return (
                      <select
                        id="department"
                        value={formData.department_id ? formData.department_id.toString() : ''}
                        onChange={(e) => setFormData(prev => ({ 
                          ...prev, 
                          department_id: e.target.value ? parseInt(e.target.value) : null 
                        }))}
                        disabled={!isEditing}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                      >
                        <option value="">Wybierz dział</option>
                        {departments.map((dept) => (
                          <option key={dept.id} value={dept.id}>
                            {dept.name}
                          </option>
                        ))}
                      </select>
                    )
                  })()}
                </div>
              </div>
              
              {!isEditing && (
                <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center text-blue-800">
                    <Info className="w-4 h-4 mr-2" />
                    <span className="text-sm">
                      Kliknij &quot;Edytuj&quot; aby zmodyfikować swoje dane osobowe
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
