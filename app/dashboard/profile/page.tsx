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
import { Switch } from '@/components/ui/switch'
import { 
  Building2, 
  Calendar,
  Edit3,
  X,
  CheckCircle,
  AlertCircle,
  Info,
  KeyRound,
  Lock,
  Bell,
  Mail,
  MessageCircle,
  Moon,
  Save
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
  const [changingPassword, setChangingPassword] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [passwordForm, setPasswordForm] = useState({
    current: '',
    next: '',
    confirm: ''
  })

  // Notification preferences state
  const [notifPrefs, setNotifPrefs] = useState({
    email_enabled: false,
    whatsapp_enabled: false,
    email_address: '',
    whatsapp_number: '',
    notify_task_assigned: true,
    notify_task_completed: true,
    notify_task_overdue: true,
    notify_mentions: true,
    quiet_hours_start: '',
    quiet_hours_end: '',
  })
  const [notifLoading, setNotifLoading] = useState(false)
  const [notifSaving, setNotifSaving] = useState(false)
  const [notifMessage, setNotifMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  
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

  // Load notification preferences
  const loadNotifPrefs = useCallback(async (userId: string, userEmail: string, userWhatsapp: string) => {
    try {
      setNotifLoading(true)
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()

      if (error) {
        console.error('Error loading notification preferences:', error)
        return
      }

      if (data) {
        setNotifPrefs({
          email_enabled: data.email_enabled ?? false,
          whatsapp_enabled: data.whatsapp_enabled ?? false,
          email_address: data.email_address || userEmail || '',
          whatsapp_number: data.whatsapp_number || userWhatsapp || '',
          notify_task_assigned: data.notify_task_assigned ?? true,
          notify_task_completed: data.notify_task_completed ?? true,
          notify_task_overdue: data.notify_task_overdue ?? true,
          notify_mentions: data.notify_mentions ?? true,
          quiet_hours_start: data.quiet_hours_start || '',
          quiet_hours_end: data.quiet_hours_end || '',
        })
      } else {
        // No preferences yet — use defaults with user's email/whatsapp
        setNotifPrefs(prev => ({
          ...prev,
          email_address: userEmail || '',
          whatsapp_number: userWhatsapp || '',
        }))
      }
    } catch (err) {
      console.error('Error loading notification preferences:', err)
    } finally {
      setNotifLoading(false)
    }
  }, [])

  const handleNotifSave = async () => {
    if (!user) return
    setNotifSaving(true)
    setNotifMessage(null)

    try {
      const payload = {
        email_enabled: notifPrefs.email_enabled,
        whatsapp_enabled: notifPrefs.whatsapp_enabled,
        email_address: notifPrefs.email_address || null,
        whatsapp_number: notifPrefs.whatsapp_number || null,
        notify_task_assigned: notifPrefs.notify_task_assigned,
        notify_task_completed: notifPrefs.notify_task_completed,
        notify_task_overdue: notifPrefs.notify_task_overdue,
        notify_mentions: notifPrefs.notify_mentions,
        quiet_hours_start: notifPrefs.quiet_hours_start || null,
        quiet_hours_end: notifPrefs.quiet_hours_end || null,
      }

      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Brak sesji – zaloguj się ponownie.')

      const res = await fetch('/api/profile/notification-preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.details || data.error || 'Unknown error')
      }

      setNotifMessage({ type: 'success', text: 'Preferencje powiadomień zostały zapisane.' })
    } catch (err) {
      console.error('Error saving notification preferences:', err)
      setNotifMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Nie udało się zapisać preferencji.',
      })
    } finally {
      setNotifSaving(false)
    }
  }

  useEffect(() => {
    checkAuthAndLoadProfile()
  }, [checkAuthAndLoadProfile])

  // Load notification preferences after profile is loaded
  useEffect(() => {
    if (user && profile) {
      loadNotifPrefs(user.id, user.email || '', profile.whatsapp || '')
    }
  }, [user, profile, loadNotifPrefs])

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

  const resetPasswordForm = () => {
    setPasswordForm({ current: '', next: '', confirm: '' })
  }

  const handlePasswordChange = async () => {
    if (!user?.email) {
      setPasswordMessage({ type: 'error', text: 'Brak adresu e-mail użytkownika. Spróbuj ponownie po odświeżeniu.' })
      return
    }

    if (!passwordForm.current.trim() || !passwordForm.next.trim() || !passwordForm.confirm.trim()) {
      setPasswordMessage({ type: 'error', text: 'Uzupełnij wszystkie pola formularza.' })
      return
    }

    if (passwordForm.next !== passwordForm.confirm) {
      setPasswordMessage({ type: 'error', text: 'Nowe hasło i potwierdzenie muszą być identyczne.' })
      return
    }

    if (passwordForm.next.length < 8) {
      setPasswordMessage({ type: 'error', text: 'Nowe hasło musi mieć co najmniej 8 znaków.' })
      return
    }

    try {
      setChangingPassword(true)
      setPasswordMessage(null)

      const reauth = await supabase.auth.signInWithPassword({
        email: user.email,
        password: passwordForm.current
      })

      if (reauth.error) {
        setPasswordMessage({ type: 'error', text: 'Aktualne hasło jest nieprawidłowe.' })
        return
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: passwordForm.next
      })

      if (updateError) {
        setPasswordMessage({ type: 'error', text: updateError.message || 'Nie udało się zaktualizować hasła.' })
        return
      }

      setPasswordMessage({ type: 'success', text: 'Hasło zostało pomyślnie zmienione.' })
      resetPasswordForm()
    } catch (error) {
      console.error('Błąd zmiany hasła:', error)
      setPasswordMessage({ type: 'error', text: 'Wystąpił nieoczekiwany błąd podczas zmiany hasła.' })
    } finally {
      setChangingPassword(false)
    }
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

      {/* Notification Preferences */}
      <div className="mt-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-blue-600" />
                  Powiadomienia
                </CardTitle>
                <CardDescription>Wybierz kanały i typy powiadomień, które chcesz otrzymywać</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {notifMessage && (
              <div
                className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm mb-4 ${
                  notifMessage.type === 'success'
                    ? 'border-green-200 bg-green-50 text-green-700'
                    : 'border-red-200 bg-red-50 text-red-700'
                }`}
              >
                {notifMessage.type === 'success' ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <span>{notifMessage.text}</span>
              </div>
            )}

            <div className="space-y-6">
              {/* Channels */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Kanały dostarczania</h3>
                <div className="space-y-4">
                  {/* Email */}
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Mail className="h-5 w-5 text-blue-600" />
                      <div>
                        <p className="font-medium text-sm">Email</p>
                        <p className="text-xs text-gray-500">Powiadomienia na adres email</p>
                      </div>
                    </div>
                    <Switch
                      checked={notifPrefs.email_enabled}
                      onCheckedChange={(checked) =>
                        setNotifPrefs(prev => ({ ...prev, email_enabled: checked }))
                      }
                    />
                  </div>

                  {notifPrefs.email_enabled && (
                    <div className="ml-8 space-y-2">
                      <Label htmlFor="notif-email">Adres email</Label>
                      <Input
                        id="notif-email"
                        type="email"
                        value={notifPrefs.email_address}
                        onChange={(e) =>
                          setNotifPrefs(prev => ({ ...prev, email_address: e.target.value }))
                        }
                        placeholder="twoj@email.pl"
                      />
                    </div>
                  )}

                  {/* WhatsApp */}
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <MessageCircle className="h-5 w-5 text-green-600" />
                      <div>
                        <p className="font-medium text-sm">WhatsApp</p>
                        <p className="text-xs text-gray-500">Wiadomości przez WhatsApp</p>
                      </div>
                    </div>
                    <Switch
                      checked={notifPrefs.whatsapp_enabled}
                      onCheckedChange={(checked) =>
                        setNotifPrefs(prev => ({ ...prev, whatsapp_enabled: checked }))
                      }
                    />
                  </div>

                  {notifPrefs.whatsapp_enabled && (
                    <div className="ml-8 space-y-2">
                      <Label htmlFor="notif-whatsapp">Numer WhatsApp</Label>
                      <Input
                        id="notif-whatsapp"
                        type="tel"
                        value={notifPrefs.whatsapp_number}
                        onChange={(e) =>
                          setNotifPrefs(prev => ({ ...prev, whatsapp_number: e.target.value }))
                        }
                        placeholder="+48 123 456 789"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Notification Types */}
              {(notifPrefs.email_enabled || notifPrefs.whatsapp_enabled) && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Typy powiadomień</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="notif-assigned" className="cursor-pointer">Przypisanie zadania</Label>
                      <Switch
                        id="notif-assigned"
                        checked={notifPrefs.notify_task_assigned}
                        onCheckedChange={(checked) =>
                          setNotifPrefs(prev => ({ ...prev, notify_task_assigned: checked }))
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="notif-completed" className="cursor-pointer">Ukończenie zadania</Label>
                      <Switch
                        id="notif-completed"
                        checked={notifPrefs.notify_task_completed}
                        onCheckedChange={(checked) =>
                          setNotifPrefs(prev => ({ ...prev, notify_task_completed: checked }))
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="notif-overdue" className="cursor-pointer">Zadanie po terminie</Label>
                      <Switch
                        id="notif-overdue"
                        checked={notifPrefs.notify_task_overdue}
                        onCheckedChange={(checked) =>
                          setNotifPrefs(prev => ({ ...prev, notify_task_overdue: checked }))
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="notif-mentions" className="cursor-pointer">Wzmianki (@mention)</Label>
                      <Switch
                        id="notif-mentions"
                        checked={notifPrefs.notify_mentions}
                        onCheckedChange={(checked) =>
                          setNotifPrefs(prev => ({ ...prev, notify_mentions: checked }))
                        }
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Quiet Hours */}
              {(notifPrefs.email_enabled || notifPrefs.whatsapp_enabled) && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-1 flex items-center gap-2">
                    <Moon className="h-4 w-4" />
                    Godziny ciszy
                  </h3>
                  <p className="text-xs text-gray-500 mb-3">Powiadomienia nie będą wysyłane w tym przedziale</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="quiet-start">Od</Label>
                      <Input
                        id="quiet-start"
                        type="time"
                        value={notifPrefs.quiet_hours_start}
                        onChange={(e) =>
                          setNotifPrefs(prev => ({ ...prev, quiet_hours_start: e.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="quiet-end">Do</Label>
                      <Input
                        id="quiet-end"
                        type="time"
                        value={notifPrefs.quiet_hours_end}
                        onChange={(e) =>
                          setNotifPrefs(prev => ({ ...prev, quiet_hours_end: e.target.value }))
                        }
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Save button */}
              <div className="flex justify-end pt-2">
                <Button onClick={handleNotifSave} disabled={notifSaving}>
                  {notifSaving ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Zapisuję...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Save className="h-4 w-4" />
                      Zapisz preferencje
                    </span>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Zmiana hasła</CardTitle>
                <CardDescription>Zadbaj o bezpieczeństwo swojego konta ustawiając nowe hasło.</CardDescription>
              </div>
              <div className="hidden md:flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                <KeyRound className="h-5 w-5" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {passwordMessage && (
                <div
                  className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${passwordMessage.type === 'success'
                    ? 'border-green-200 bg-green-50 text-green-700'
                    : 'border-red-200 bg-red-50 text-red-700'
                  }`}
                >
                  {passwordMessage.type === 'success' ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <AlertCircle className="h-4 w-4" />
                  )}
                  <span>{passwordMessage.text}</span>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="current-password">Aktualne hasło</Label>
                  <Input
                    id="current-password"
                    type="password"
                    value={passwordForm.current}
                    onChange={(event) => setPasswordForm(prev => ({ ...prev, current: event.target.value }))}
                    placeholder="Wprowadź aktualne hasło"
                    autoComplete="current-password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password">Nowe hasło</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={passwordForm.next}
                    onChange={(event) => setPasswordForm(prev => ({ ...prev, next: event.target.value }))}
                    placeholder="Minimum 8 znaków"
                    autoComplete="new-password"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="confirm-password">Potwierdź nowe hasło</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={passwordForm.confirm}
                    onChange={(event) => setPasswordForm(prev => ({ ...prev, confirm: event.target.value }))}
                    placeholder="Powtórz nowe hasło"
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Lock className="h-4 w-4" />
                  <span>Hasło powinno zawierać co najmniej 8 znaków.</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={resetPasswordForm}
                    disabled={changingPassword}
                  >
                    Wyczyść
                  </Button>
                  <Button
                    onClick={handlePasswordChange}
                    disabled={changingPassword}
                  >
                    {changingPassword ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Zmieniam hasło...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <KeyRound className="h-4 w-4" />
                        Zmień hasło
                      </span>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
