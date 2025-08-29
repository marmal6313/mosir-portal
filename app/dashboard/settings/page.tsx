'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Settings, 
  Image as ImageIcon, 
  Eye, 
  EyeOff,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Lock,
  Upload,
  X,
  Building2,
  Users
} from 'lucide-react'
import { PermissionDisplay } from '@/components/permissions/PermissionDisplay'
import { PermissionsDashboard } from '@/components/permissions/PermissionsDashboard'
import { useRouter } from 'next/navigation'

interface SystemSetting {
  id: string
  key: string
  value: string | null
  description: string | null
  updated_at: string | null
  updated_by: string | null
}

export default function SettingsPage() {
  const router = useRouter()
  const [settings, setSettings] = useState<SystemSetting[]>([])
  const [loadingSettings, setLoadingSettings] = useState(true)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [logoPreview, setLogoPreview] = useState<string>('')
  const [showLogoPreview, setShowLogoPreview] = useState(false)
  const [userProfile, setUserProfile] = useState<Database['public']['Views']['users_with_details']['Row'] | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)

  const [showIconSelector, setShowIconSelector] = useState<'building' | 'users' | 'check' | null>(null)
  const [isInitializing, setIsInitializing] = useState(false)

  // Sprawdź autoryzację i załaduj profil użytkownika
  useEffect(() => {
    checkAuthAndLoadProfile()
  }, [])

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

      // Sprawdź uprawnienia
      if (profile.role !== 'superadmin' && profile.role !== 'dyrektor') {
        console.log('❌ Brak uprawnień - rola:', profile.role, '- przekierowanie do dashboard')
        router.push('/dashboard')
        return
      }
      
      console.log('✅ Użytkownik ma uprawnienia - rola:', profile.role)
    } catch (error) {
      console.error('❌ Błąd autoryzacji:', error)
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }, [router])

  // Komponent wyboru ikon
  const IconSelector = ({ onSelect }: { onSelect: (path: string) => void }) => {
    const [icons, setIcons] = useState<Array<{ name: string; path: string; size: string }>>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')

    useEffect(() => {
      loadIcons()
    }, [])

    const loadIcons = async () => {
      try {
        setLoading(true)
        const response = await fetch('/api/files')
        if (response.ok) {
          const data = await response.json()
          // Filtruj tylko pliki obrazów
          const imageFiles = data.files?.filter((file: { name: string; path: string; size: string }) => 
            file.name.match(/\.(png|jpg|jpeg|gif|svg|webp)$/i)
          ) || []
          setIcons(imageFiles)
        }
      } catch (error) {
        console.error('Błąd podczas ładowania ikon:', error)
      } finally {
        setLoading(false)
      }
    }

    const filteredIcons = icons.filter(icon => 
      icon.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      icon.path.toLowerCase().includes(searchTerm.toLowerCase())
    )

    if (loading) {
      return (
        <div className="text-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-600" />
          <p className="text-gray-600">Ładowanie ikon...</p>
        </div>
      )
    }

    if (icons.length === 0) {
      return (
        <div className="text-center py-8">
          <ImageIcon className="h-8 w-8 mx-auto mb-2 text-gray-400" />
          <p className="text-gray-600">Brak dostępnych ikon</p>
          <p className="text-sm text-gray-500">Najpierw uploaduj pliki w sekcji &quot;Galeria plików&quot;</p>
        </div>
      )
    }

    return (
      <div className="space-y-4">
        {/* Wyszukiwarka */}
        <div>
          <Input
            type="text"
            placeholder="Wyszukaj ikonę..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
          />
        </div>

        {/* Siatka ikon */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-h-96 overflow-y-auto">
          {filteredIcons.map((icon) => (
            <div 
              key={icon.name}
              onClick={() => onSelect(icon.path)}
              className="cursor-pointer border border-gray-200 rounded-lg p-3 hover:border-blue-500 hover:shadow-md transition-all group"
            >
              <div className="aspect-square bg-gray-50 rounded-lg flex items-center justify-center overflow-hidden mb-2">
                <img 
                  src={icon.path} 
                  alt={icon.name} 
                  className="w-full h-full object-contain group-hover:scale-105 transition-transform"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.style.display = 'none'
                    const fallback = target.nextElementSibling as HTMLElement
                    if (fallback) fallback.style.display = 'flex'
                  }}
                />
                <div className="hidden w-full h-full items-center justify-center text-gray-400">
                  <ImageIcon className="h-8 w-8" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-900 truncate" title={icon.name}>
                  {icon.name}
                </p>
                <p className="text-xs text-gray-500">{icon.size}</p>
              </div>
            </div>
          ))}
        </div>

        {filteredIcons.length === 0 && searchTerm && (
          <div className="text-center py-4">
            <p className="text-gray-500">Nie znaleziono ikon pasujących do wyszukiwania</p>
          </div>
        )}
      </div>
    )
  }

  // Komponent galerii plików
  const FileGallery = () => {
    const [files, setFiles] = useState<Array<{ name: string; path: string; size: string; uploaded: string }>>([])
    const [loading, setLoading] = useState(true)
    const [selectedFile, setSelectedFile] = useState<string | null>(null)

    useEffect(() => {
      loadFiles()
    }, [])

    const loadFiles = async () => {
      try {
        setLoading(true)
        // Pobierz listę plików z katalogu public/img
        const response = await fetch('/api/files')
        if (response.ok) {
          const data = await response.json()
          setFiles(data.files || [])
        }
      } catch (error) {
        console.error('Błąd podczas ładowania plików:', error)
      } finally {
        setLoading(false)
      }
    }

    const deleteFile = async (fileName: string) => {
      if (!confirm(`Czy na pewno chcesz usunąć plik "${fileName}"?`)) return
      
      try {
        const response = await fetch('/api/files', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileName })
        })
        
        if (response.ok) {
          await loadFiles() // Przeładuj listę
        }
      } catch (error) {
        console.error('Błąd podczas usuwania pliku:', error)
      }
    }

    const copyPath = (path: string) => {
      navigator.clipboard.writeText(path)
      // Pokaż powiadomienie o skopiowaniu
      setMessage({ type: 'success', text: 'Ścieżka została skopiowana do schowka' })
      setTimeout(() => setMessage(null), 2000)
    }

    if (loading) {
      return (
        <div className="text-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-600" />
          <p className="text-gray-600">Ładowanie plików...</p>
        </div>
      )
    }

    if (files.length === 0) {
      return (
        <div className="text-center py-8">
          <ImageIcon className="h-8 w-8 mx-auto mb-2 text-gray-400" />
          <p className="text-gray-600">Brak uploadowanych plików</p>
        </div>
      )
    }

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {files.map((file) => (
            <div key={file.name} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-gray-900 truncate">{file.name}</h4>
                <div className="flex space-x-1">
                  <button
                    onClick={() => copyPath(file.path)}
                    className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                    title="Kopiuj ścieżkę"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => deleteFile(file.name)}
                    className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                    title="Usuń plik"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Rozmiar:</span>
                  <span className="text-gray-900">{file.size}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Upload:</span>
                  <span className="text-gray-900">{file.uploaded}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Ścieżka:</span>
                  <span className="text-gray-900 font-mono text-xs truncate">{file.path}</span>
                </div>
              </div>
              
              <div className="mt-3 flex space-x-2">
                <button
                  onClick={() => setSelectedFile(file.path)}
                  className="flex-1 bg-blue-50 text-blue-700 px-3 py-2 rounded-md text-sm hover:bg-blue-100 transition-colors"
                >
                  Podgląd
                </button>
                <a
                  href={file.path}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 bg-gray-50 text-gray-700 px-3 py-2 rounded-md text-sm hover:bg-gray-100 transition-colors text-center"
                >
                  Otwórz
                </a>
              </div>
            </div>
          ))}
        </div>
        
        {/* Modal podglądu */}
        {selectedFile && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-2xl max-h-[90vh] overflow-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Podgląd pliku</h3>
                <button
                  onClick={() => setSelectedFile(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              <div className="text-center">
                <img 
                  src={selectedFile} 
                  alt="Podgląd" 
                  className="max-w-full max-h-96 object-contain mx-auto"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.style.display = 'none'
                    const fallback = target.nextElementSibling as HTMLElement
                    if (fallback) fallback.style.display = 'block'
                  }}
                />
                <div className="hidden text-gray-500 mt-4">
                  <p>Nie można wyświetlić podglądu tego pliku</p>
                  <a 
                    href={selectedFile} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    Otwórz w nowej karcie
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Załaduj ustawienia systemu
  useEffect(() => {
            if (userProfile?.role === 'superadmin' || userProfile?.role === 'dyrektor') {
      console.log('✅ Rozpoczynam ładowanie ustawień systemu dla roli:', userProfile.role)
      loadSystemSettings()
    } else {
      console.log('❌ Brak uprawnień do ładowania ustawień - rola:', userProfile?.role)
    }
  }, [userProfile])

  const loadSystemSettings = useCallback(async () => {
    try {
      if (isInitializing) {
        console.log('⚠️ Ładowanie już w toku, pomijam...')
        return
      }
      
      console.log('🔍 Rozpoczynam ładowanie ustawień systemu...')
      setIsInitializing(true)
      setLoadingSettings(true)
      
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .order('key')

      console.log('📊 Wynik zapytania system_settings:', { data, error })

      if (error) {
        console.error('❌ Błąd Supabase:', error)
        throw error
      }

      if (data && data.length > 0) {
        console.log('✅ Załadowano ustawienia:', data)
        
        // Sprawdź czy wszystkie wymagane ustawienia istnieją
        const requiredSettings = [
          'mosir_logo', 'system_name', 'company_name', 'login_logo', 'city_name',
          'login_building_icon', 'login_users_icon', 'login_check_icon'
        ]
        
        const existingKeys = data.map(s => s.key)
        const missingSettings = requiredSettings.filter(key => !existingKeys.includes(key))
        
        if (missingSettings.length > 0) {
          console.log('⚠️ Brakujące ustawienia:', missingSettings)
          await createMissingSettings(missingSettings, data)
        } else {
          setSettings(data)
          // Ustaw podgląd logo
          const logoSetting = data.find(s => s.key === 'mosir_logo')
          if (logoSetting?.value) {
            setLogoPreview(logoSetting.value)
          }
        }
      } else {
        console.log('⚠️ Brak ustawień - tworzę domyślne')
        // Utwórz domyślne ustawienia
        await createDefaultSettings()
      }
    } catch (error) {
      console.error('❌ Błąd podczas ładowania ustawień:', error)
      setMessage({ type: 'error', text: 'Nie udało się załadować ustawień systemu' })
    } finally {
      setLoadingSettings(false)
      setIsInitializing(false)
    }
  }, [isInitializing, userProfile?.id])

  const createMissingSettings = async (missingKeys: string[], existingSettings: SystemSetting[]) => {
    try {
      console.log('🔧 Tworzę brakujące ustawienia:', missingKeys)
      
      const missingSettings = missingKeys.map(key => {
        const defaultValues: Record<string, { value: string; description: string }> = {
          'mosir_logo': { value: '/mosir-logo.svg', description: 'Ścieżka do logo MOSiR (SVG, PNG, JPG)' },
          'system_name': { value: 'MOSiR Portal', description: 'Nazwa systemu wyświetlana w interfejsie' },
          'company_name': { value: 'MOSiR', description: 'Nazwa firmy/organizacji' },
          'login_logo': { value: '/login-logo.svg', description: 'Logo wyświetlane na stronie logowania' },
          'city_name': { value: 'Ostrów Mazowiecka', description: 'Nazwa miasta wyświetlana w interfejsie' },
          'login_building_icon': { value: '', description: 'Ikona budynku na stronie logowania (opcjonalna)' },
          'login_users_icon': { value: '', description: 'Ikona użytkowników na stronie logowania (opcjonalna)' },
          'login_check_icon': { value: '', description: 'Ikona sprawdzenia na stronie logowania (opcjonalna)' }
        }
        
        return {
          key,
          value: defaultValues[key]?.value || '',
          description: defaultValues[key]?.description || `Ustawienie dla ${key}`,
          updated_by: userProfile?.id
        }
      })

      const { error } = await supabase
        .from('system_settings')
        .insert(missingSettings)

      if (error) throw error

      console.log('✅ Utworzono brakujące ustawienia')
      
      // Zaktualizuj lokalny stan zamiast przeładowywać
      const newSettingsWithIds = missingSettings.map(setting => ({
        ...setting,
        id: `temp-${setting.key}`, // Tymczasowe ID
        updated_at: new Date().toISOString()
      }))
      
      const newSettings = [...existingSettings, ...newSettingsWithIds] as SystemSetting[]
      setSettings(newSettings)
      
      // Ustaw podgląd logo
      const logoSetting = newSettings.find(s => s.key === 'mosir_logo')
      if (logoSetting?.value) {
        setLogoPreview(logoSetting.value)
      }
    } catch (error) {
      console.error('❌ Błąd podczas tworzenia brakujących ustawień:', error)
      setMessage({ type: 'error', text: 'Nie udało się utworzyć brakujących ustawień' })
    }
  }

  const createDefaultSettings = async () => {
    try {
      const defaultSettings = [
        {
          key: 'mosir_logo',
          value: '/mosir-logo.svg',
          description: 'Ścieżka do logo MOSiR (SVG, PNG, JPG)'
        },
        {
          key: 'system_name',
          value: 'MOSiR Portal',
          description: 'Nazwa systemu wyświetlana w interfejsie'
        },
        {
          key: 'company_name',
          value: 'MOSiR',
          description: 'Nazwa firmy/organizacji'
        },
        {
          key: 'login_logo',
          value: '/login-logo.svg',
          description: 'Logo wyświetlane na stronie logowania'
        },
        {
          key: 'city_name',
          value: 'Ostrów Mazowiecka',
          description: 'Nazwa miasta wyświetlana w interfejsie'
        },
        {
          key: 'login_building_icon',
          value: '',
          description: 'Ikona budynku na stronie logowania (opcjonalna)'
        },
        {
          key: 'login_users_icon',
          value: '',
          description: 'Ikona użytkowników na stronie logowania (opcjonalna)'
        },
        {
          key: 'login_check_icon',
          value: '',
          description: 'Ikona sprawdzenia na stronie logowania (opcjonalna)'
        },
        {
          key: 'task_creation_manager',
          value: 'own_department',
          description: 'Uprawnienia managera do tworzenia zadań (own_department/all_departments)'
        },
        {
          key: 'task_creation_employee',
          value: 'self_only',
          description: 'Uprawnienia pracownika do tworzenia zadań (self_only/own_department)'
        },
        {
          key: 'task_assignment_manager',
          value: 'own_department',
          description: 'Uprawnienia managera do przydzielania zadań (own_department/all_departments)'
        },
        {
          key: 'task_assignment_employee',
          value: 'self_only',
          description: 'Uprawnienia pracownika do przydzielania zadań (self_only/own_department)'
        },
        {
          key: 'user_management_manager',
          value: 'own_department',
          description: 'Uprawnienia managera do zarządzania użytkownikami (own_department/all_departments)'
        },
        {
          key: 'user_management_employee',
          value: 'none',
          description: 'Uprawnienia pracownika do zarządzania użytkownikami (none/self_only)'
        }
      ]

      const { error } = await supabase
        .from('system_settings')
        .insert(defaultSettings.map(setting => ({
          ...setting,
          updated_by: userProfile?.id
        })))

      if (error) throw error

      console.log('✅ Utworzono domyślne ustawienia')
      await loadSystemSettings()
    } catch (error) {
      console.error('Błąd podczas tworzenia domyślnych ustawień:', error)
      setMessage({ type: 'error', text: 'Nie udało się utworzyć domyślnych ustawień' })
    }
  }

  const updateSetting = async (key: string, value: string) => {
    try {
      const { error } = await supabase
        .from('system_settings')
        .update({ 
          value, 
          updated_at: new Date().toISOString(),
          updated_by: userProfile?.id || null 
        })
        .eq('key', key)

      if (error) throw error

      // Aktualizuj lokalny stan
      setSettings(prev => prev.map(s => 
        s.key === key ? { ...s, value, updated_at: new Date().toISOString(), updated_by: userProfile?.id || null } : s
      ))

      // Jeśli to logo, zaktualizuj podgląd
      if (key === 'mosir_logo') {
        setLogoPreview(value)
      }

      setMessage({ type: 'success', text: 'Ustawienie zostało zaktualizowane' })
      
      // Ukryj wiadomość po 3 sekundach
      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      console.error('Błąd podczas aktualizacji ustawienia:', error)
      setMessage({ type: 'error', text: 'Nie udało się zaktualizować ustawienia' })
    }
  }

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    updateSetting('mosir_logo', value)
  }

  const handleSystemNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    updateSetting('system_name', value)
  }

  const handleCompanyNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    updateSetting('company_name', value)
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, settingKey: string) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      setUploading(true)

      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Błąd uploadowania')
      }

      const result = await response.json()
      
      if (result.success) {
        // Aktualizuj ustawienie z nową ścieżką
        await updateSetting(settingKey, result.filePath)
        setMessage({ type: 'success', text: `Plik został pomyślnie uploadowany i zapisany` })
        setTimeout(() => setMessage(null), 3000)
      }
    } catch (error) {
      console.error('Błąd podczas uploadowania pliku:', error)
      setMessage({ type: 'error', text: `Błąd uploadowania: ${error instanceof Error ? error.message : 'Nieznany błąd'}` })
      setTimeout(() => setMessage(null), 5000)
    } finally {
      setUploading(false)
      // Resetuj input file
    }
  }

  if (loading || loadingSettings) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-gray-100 p-4 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Ładowanie ustawień...</p>
        </div>
      </div>
    )
  }

      if (!userProfile || (userProfile.role !== 'superadmin' && userProfile.role !== 'dyrektor')) {
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
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Nagłówek */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl">
              <Settings className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Ustawienia systemu</h1>
              <p className="text-gray-600">Konfiguracja systemu MOSiR Portal</p>
            </div>
          </div>
          <Badge variant="secondary" className="text-sm">
            {userProfile.role === 'superadmin' ? 'Superadmin' : 'Dyrektor'}: {userProfile.full_name}
          </Badge>
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

        {/* Ustawienia logo */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <ImageIcon className="h-5 w-5" />
              <span>Logo MOSiR</span>
            </CardTitle>
            <CardDescription>
              Konfiguracja logo wyświetlanego w lewym panelu nawigacyjnym
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="logo-path">Ścieżka do logo</Label>
                <div className="flex space-x-2 mt-2">
                  <Input
                    id="logo-path"
                    type="text"
                    placeholder="/mosir-logo.svg"
                    value={settings.find(s => s.key === 'mosir_logo')?.value || ''}
                    onChange={handleLogoChange}
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    onClick={() => setShowLogoPreview(!showLogoPreview)}
                    className="px-3"
                  >
                    {showLogoPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  Wprowadź ścieżkę do pliku logo (np. /mosir-logo.svg, /images/logo.png)
                </p>
                
                {/* Upload pliku */}
                <div className="mt-3">
                  <Label htmlFor="logo-upload" className="text-sm font-medium text-gray-700">
                    Lub wybierz plik z komputera:
                  </Label>
                  <div className="mt-2 flex items-center space-x-2">
                    <input
                      id="logo-upload"
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, 'mosir_logo')}
                      className="hidden"
                    />
                    <label
                      htmlFor="logo-upload"
                      className="cursor-pointer inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Wybierz plik
                    </label>
                    {uploading && (
                      <div className="flex items-center space-x-2 text-sm text-blue-600">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                        <span>Uploadowanie...</span>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Maksymalny rozmiar: 5MB. Dozwolone formaty: JPG, PNG, SVG, GIF
                  </p>
                </div>
              </div>
              
              {showLogoPreview && (
                <div>
                  <Label>Podgląd logo</Label>
                  <div className="mt-2 p-4 border border-gray-200 rounded-lg bg-gray-50 flex items-center justify-center">
                    {logoPreview ? (
                      <img 
                        src={logoPreview} 
                        alt="Logo preview" 
                        className="max-h-20 max-w-full object-contain"
                        onError={() => setLogoPreview('/mosir-logo.svg')}
                      />
                    ) : (
                      <div className="text-gray-400 text-center">
                        <ImageIcon className="h-8 w-8 mx-auto mb-2" />
                        <p className="text-sm">Brak logo</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Ustawienia strony logowania */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Lock className="h-5 w-5" />
              <span>Strona logowania</span>
            </CardTitle>
            <CardDescription>
              Konfiguracja wyglądu strony logowania
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="login-logo">Logo strony logowania</Label>
              <Input
                id="login-logo"
                type="text"
                placeholder="/login-logo.svg"
                value={settings.find(s => s.key === 'login_logo')?.value || ''}
                onChange={(e) => updateSetting('login_logo', e.target.value)}
                className="mt-2"
              />
              <p className="text-sm text-gray-500 mt-1">
                Ścieżka do dużego logo wyświetlanego na stronie logowania
              </p>
              
              {/* Upload pliku */}
              <div className="mt-3">
                <Label htmlFor="login-logo-upload" className="text-sm font-medium text-gray-700">
                  Lub wybierz plik z komputera:
                </Label>
                <div className="mt-2 flex items-center space-x-2">
                  <input
                    id="login-logo-upload"
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, 'login_logo')}
                    className="hidden"
                  />
                  <label
                    htmlFor="login-logo-upload"
                    className="cursor-pointer inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Wybierz plik
                  </label>
                  {uploading && (
                    <div className="flex items-center space-x-2 text-sm text-blue-600">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                      <span>Uploadowanie...</span>
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Maksymalny rozmiar: 5MB. Dozwolone formaty: JPG, PNG, SVG, GIF
                </p>
              </div>
            </div>
            
            <div>
              <Label htmlFor="city-name">Nazwa miasta</Label>
              <Input
                id="city-name"
                type="text"
                placeholder="Ostrów Mazowiecka"
                value={settings.find(s => s.key === 'city_name')?.value || ''}
                onChange={(e) => updateSetting('city_name', e.target.value)}
                className="mt-2"
              />
              <p className="text-sm text-gray-500 mt-1">
                Nazwa miasta wyświetlana na stronie logowania
              </p>
            </div>
            
            {/* Konfiguracja ikon na stronie logowania */}
            <div className="space-y-4 pt-4 border-t border-gray-200">
              <h4 className="font-medium text-gray-900">Ikony na stronie logowania</h4>
              
              {/* Ikona budynku */}
              <div>
                <Label htmlFor="building-icon">Ikona budynku</Label>
                <div className="mt-2 space-y-3">
                  <div className="flex space-x-2">
                    <Input
                      id="building-icon"
                      type="text"
                      placeholder="/img/building-icon.png"
                      value={settings.find(s => s.key === 'login_building_icon')?.value || ''}
                      onChange={(e) => updateSetting('login_building_icon', e.target.value)}
                      className="flex-1"
                    />
                    <input
                      id="building-icon-upload"
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, 'login_building_icon')}
                      className="hidden"
                    />
                    <label
                      htmlFor="building-icon-upload"
                      className="cursor-pointer inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Upload
                    </label>
                    <button
                      onClick={() => setShowIconSelector('building')}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <ImageIcon className="h-4 w-4 mr-2" />
                      Wybierz
                    </button>
                  </div>
                  
                  {/* Podgląd ikony budynku */}
                  {settings.find(s => s.key === 'login_building_icon')?.value && (
                    <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                      <div className="w-12 h-12 bg-white border border-gray-200 rounded-lg flex items-center justify-center overflow-hidden">
                        <img 
                          src={settings.find(s => s.key === 'login_building_icon')?.value || ''} 
                          alt="Building Icon Preview" 
                          className="w-8 h-8 object-contain"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement
                            target.style.display = 'none'
                            const fallback = target.nextElementSibling as HTMLElement
                            if (fallback) fallback.style.display = 'flex'
                          }}
                        />
                        <Building2 className="w-8 h-8 text-gray-400 hidden" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">Podgląd ikony</p>
                        <p className="text-xs text-gray-500">
                          {settings.find(s => s.key === 'login_building_icon')?.value}
                        </p>
                      </div>
                      <button
                        onClick={() => updateSetting('login_building_icon', '')}
                        className="text-red-500 hover:text-red-700 p-1"
                        title="Usuń ikonę"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                  
                  <p className="text-sm text-gray-500">
                    Ikona wyświetlana w głównym logo i sekcji obiektów sportowych
                  </p>
                </div>
              </div>
              
              {/* Ikona użytkowników */}
              <div>
                <Label htmlFor="users-icon">Ikona użytkowników</Label>
                <div className="mt-2 space-y-3">
                  <div className="flex space-x-2">
                    <Input
                      id="users-icon"
                      type="text"
                      placeholder="/img/users-icon.png"
                      value={settings.find(s => s.key === 'login_users_icon')?.value || ''}
                      onChange={(e) => updateSetting('login_users_icon', e.target.value)}
                      className="flex-1"
                    />
                    <input
                      id="users-icon-upload"
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, 'login_users_icon')}
                      className="hidden"
                    />
                    <label
                      htmlFor="users-icon-upload"
                      className="cursor-pointer inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Upload
                    </label>
                    <button
                      onClick={() => setShowIconSelector('users')}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <ImageIcon className="h-4 w-4 mr-2" />
                      Wybierz
                    </button>
                  </div>
                  
                  {/* Podgląd ikony użytkowników */}
                  {settings.find(s => s.key === 'login_users_icon')?.value && (
                    <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                      <div className="w-12 h-12 bg-white border border-gray-200 rounded-lg flex items-center justify-center overflow-hidden">
                        <img 
                          src={settings.find(s => s.key === 'login_users_icon')?.value || ''} 
                          alt="Users Icon Preview" 
                          className="w-8 h-8 object-contain"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement
                            target.style.display = 'none'
                            const fallback = target.nextElementSibling as HTMLElement
                            if (fallback) fallback.style.display = 'flex'
                          }}
                        />
                        <Users className="w-8 h-8 text-gray-400 hidden" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">Podgląd ikony</p>
                        <p className="text-xs text-gray-500">
                          {settings.find(s => s.key === 'login_users_icon')?.value}
                        </p>
                      </div>
                      <button
                        onClick={() => updateSetting('login_users_icon', '')}
                        className="text-red-500 hover:text-red-700 p-1"
                        title="Usuń ikonę"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                  
                  <p className="text-sm text-gray-500">
                    Ikona wyświetlana w sekcji zespołu pracowników
                  </p>
                </div>
              </div>
              
              {/* Ikona sprawdzenia */}
              <div>
                <Label htmlFor="check-icon">Ikona sprawdzenia</Label>
                <div className="mt-2 space-y-3">
                  <div className="flex space-x-2">
                    <Input
                      id="check-icon"
                      type="text"
                      placeholder="/img/check-icon.png"
                      value={settings.find(s => s.key === 'login_check_icon')?.value || ''}
                      onChange={(e) => updateSetting('login_check_icon', e.target.value)}
                      className="flex-1"
                    />
                    <input
                      id="check-icon-upload"
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, 'login_check_icon')}
                      className="hidden"
                    />
                    <label
                      htmlFor="check-icon-upload"
                      className="cursor-pointer inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Upload
                    </label>
                    <button
                      onClick={() => setShowIconSelector('check')}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <ImageIcon className="h-4 w-4 mr-2" />
                      Wybierz
                    </button>
                  </div>
                  
                  {/* Podgląd ikony sprawdzenia */}
                  {settings.find(s => s.key === 'login_check_icon')?.value && (
                    <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                      <div className="w-12 h-12 bg-white border border-gray-200 rounded-lg flex items-center justify-center overflow-hidden">
                        <img 
                          src={settings.find(s => s.key === 'login_check_icon')?.value || ''} 
                          alt="Check Icon Preview" 
                          className="w-8 h-8 object-contain"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement
                            target.style.display = 'none'
                            const fallback = target.nextElementSibling as HTMLElement
                            if (fallback) fallback.style.display = 'flex'
                          }}
                        />
                        <CheckCircle className="w-8 h-8 text-gray-400 hidden" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">Podgląd ikony</p>
                        <p className="text-xs text-gray-500">
                          {settings.find(s => s.key === 'login_check_icon')?.value}
                        </p>
                      </div>
                      <button
                        onClick={() => updateSetting('login_check_icon', '')}
                        className="text-red-500 hover:text-red-700 p-1"
                        title="Usuń ikonę"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                  
                  <p className="text-sm text-gray-500">
                    Ikona wyświetlana w sekcji zarządzania zadaniami
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Ustawienia nazw */}
        <Card>
          <CardHeader>
            <CardTitle>Nazwy systemu</CardTitle>
            <CardDescription>
              Konfiguracja nazw wyświetlanych w interfejsie
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="system-name">Nazwa systemu</Label>
              <Input
                id="system-name"
                type="text"
                placeholder="MOSiR Portal"
                value={settings.find(s => s.key === 'system_name')?.value || ''}
                onChange={handleSystemNameChange}
                className="mt-2"
              />
            </div>
            
            <div>
              <Label htmlFor="company-name">Nazwa firmy</Label>
              <Input
                id="company-name"
                type="text"
                placeholder="MOSiR"
                value={settings.find(s => s.key === 'company_name')?.value || ''}
                onChange={handleCompanyNameChange}
                className="mt-2"
              />
            </div>
          </CardContent>
        </Card>

        {/* Wyświetlanie uprawnień użytkownika */}
        <PermissionDisplay />

        {/* System zarządzania uprawnieniami */}
        <PermissionsDashboard />

        {/* Galeria plików */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <ImageIcon className="h-5 w-5" />
              <span>Galeria plików</span>
            </CardTitle>
            <CardDescription>
              Przeglądaj wcześniej uploadowane pliki i zarządzaj nimi
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FileGallery />
          </CardContent>
        </Card>

        {/* Informacje o systemie */}
        <Card>
          <CardHeader>
            <CardTitle>Informacje o systemie</CardTitle>
            <CardDescription>
              Szczegóły konfiguracji i ostatnie zmiany
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {settings.map(setting => (
                <div key={setting.key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{setting.key}</p>
                    <p className="text-sm text-gray-600">{setting.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-900">{setting.value || 'Brak wartości'}</p>
                    {setting.updated_at && (
                      <p className="text-xs text-gray-500">
                        Ostatnia zmiana: {new Date(setting.updated_at).toLocaleDateString('pl-PL')}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Modal wyboru ikon */}
      {showIconSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl max-h-[90vh] overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">
                Wybierz ikonę {showIconSelector === 'building' ? 'budynku' : showIconSelector === 'users' ? 'użytkowników' : 'sprawdzenia'}
              </h3>
              <button
                onClick={() => setShowIconSelector(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <IconSelector 
              onSelect={(iconPath) => {
                const settingKey = showIconSelector === 'building' ? 'login_building_icon' : 
                                  showIconSelector === 'users' ? 'login_users_icon' : 'login_check_icon'
                updateSetting(settingKey, iconPath)
                setShowIconSelector(null)
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
