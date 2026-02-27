'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { User } from '@supabase/supabase-js'
import Image from 'next/image'
import {
  LayoutDashboard,
  CheckSquare,
  FileText,
  MessageSquare,
  Users,
  Settings,
  LogOut,
  UserCircle,
  Database
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { Database } from '@/types/database'

type UserProfile = Database["public"]["Views"]["users_with_details"]["Row"]

interface SidebarProps {
  user: User | null
  profile: UserProfile | null
}

export default function Sidebar({ profile }: SidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [activeItem, setActiveItem] = useState('Dashboard')
  const [systemSettings, setSystemSettings] = useState<Record<string, string | null>>({})

  // Automatycznie ustaw aktywną zakładkę na podstawie URL
  useEffect(() => {
    if (pathname === '/dashboard') {
      setActiveItem('Dashboard')
    } else if (pathname.startsWith('/dashboard/tasks')) {
      setActiveItem('Zadania')
    } else if (pathname.startsWith('/dashboard/channels')) {
      setActiveItem('Kanały')
    } else if (pathname.startsWith('/dashboard/users')) {
      setActiveItem('Użytkownicy')
    } else if (pathname.startsWith('/dashboard/reports')) {
      setActiveItem('Raporty')
    } else if (pathname.startsWith('/dashboard/gantt')) {
      setActiveItem('Wykres Gantta')
    } else if (pathname.startsWith('/dashboard/fitnet-tools')) {
      setActiveItem('Fitnet Tools')
    } else if (pathname === '/dashboard/settings') {
      setActiveItem('Ustawienia')
    }
  }, [pathname])

  // Załaduj ustawienia systemu
  useEffect(() => {
    loadSystemSettings()
  }, [])

  const loadSystemSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('key, value')
        .in('key', ['mosir_logo', 'system_name', 'company_name'])

      if (error) throw error

      if (data) {
        const settings: Record<string, string | null> = {}
        data.forEach(setting => {
          settings[setting.key] = setting.value
        })
        setSystemSettings(settings)
      }
    } catch (error) {
      console.error('Błąd podczas ładowania ustawień systemu:', error)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Zadania', href: '/dashboard/tasks', icon: CheckSquare },
    { name: 'Kanały', href: '/dashboard/channels', icon: MessageSquare },
    { name: 'Raporty', href: '/dashboard/reports', icon: FileText },
    { name: 'Wykres Gantta', href: '/dashboard/gantt', icon: FileText },
    ...(profile?.role === 'superadmin' || profile?.role === 'dyrektor' || profile?.role === 'kierownik'
      ? [{ name: 'Użytkownicy', href: '/dashboard/users', icon: Users }]
      : []),
    ...(profile?.role === 'superadmin'
      ? [{ name: 'Fitnet Tools', href: '/dashboard/fitnet-tools', icon: Database }]
      : []),
    ...(profile?.role === 'superadmin' || profile?.role === 'dyrektor'
      ? [{ name: 'Ustawienia', href: '/dashboard/settings', icon: Settings }]
      : []),
  ]

  return (
    <div className="bg-white border-r border-gray-200 text-gray-900 w-64 min-h-screen flex flex-col shadow-lg">
      {/* Logo Section */}
      <div className="p-4 sm:p-6 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="p-2 sm:p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-md">
            <Image 
              src={systemSettings.mosir_logo || '/mosir-logo.svg'} 
              alt="MOSiR Logo" 
              width={32}
              height={32}
              className="h-6 w-6 sm:h-8 sm:w-8"
              onError={() => {
                // Fallback do domyślnej ikony jeśli logo się nie załaduje
                // Next.js Image component automatycznie obsługuje fallback
              }}
            />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 truncate">
              {systemSettings.system_name || 'Drabio'}
            </h1>
            <p className="text-xs text-blue-600 font-medium truncate">
              {systemSettings.company_name || 'System Zarządzania'}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 sm:p-4">
        <ul className="space-y-2">
          {navigation.map((item) => {
            const Icon = item.icon
            const isActive = activeItem === item.name
            
            return (
              <li key={item.name}>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setActiveItem(item.name)
                    router.push(item.href)
                  }}
                  aria-label={`Navigate to ${item.name}`}
                  aria-current={isActive ? 'page' : undefined}
                  className={`w-full justify-start h-12 px-3 sm:px-4 text-sm sm:text-base font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-600 shadow-sm'
                      : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100 border-l-4 border-transparent'
                  }`}
                >
                  <Icon className="h-4 w-4 sm:h-5 sm:w-5 mr-3 flex-shrink-0" aria-hidden="true" />
                  <span className="truncate">{item.name}</span>
                  {isActive && (
                    <div className="ml-auto w-2 h-2 bg-blue-600 rounded-full" aria-hidden="true"></div>
                  )}
                </Button>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* User Profile Section */}
      <div className="p-3 sm:p-4 border-t border-gray-200">
        <div className="flex items-center space-x-3 mb-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
            <UserCircle className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm sm:text-base font-medium text-gray-900 truncate">
              {profile?.full_name || 'Użytkownik'}
            </p>
            <div className="flex items-center space-x-2">
              <Badge
                variant="secondary"
                className="text-xs px-2 py-1 bg-blue-50 text-blue-700 border-blue-200"
              >
                {profile?.role || 'user'}
              </Badge>
              {profile?.department_name && (
                <Badge
                  variant="outline"
                  className="text-xs px-2 py-1 border-gray-300 text-gray-700"
                >
                  {profile.department_name}
                </Badge>
              )}
            </div>
          </div>
        </div>
        
        <Button
          variant="ghost"
          onClick={handleLogout}
          className="w-full justify-start h-10 px-3 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100"
        >
          <LogOut className="h-4 w-4 mr-3" />
          Wyloguj
        </Button>
      </div>
    </div>
  )
}
