'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { User } from '@supabase/supabase-js'
import { Database } from '@/types/database'
import { supabase } from '@/lib/supabase'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { 
  Search, 
  Bell, 
  ChevronDown, 
  UserCircle, 
  Settings, 
  LogOut,
  Menu,
  CheckSquare,
  User as UserIcon
} from 'lucide-react'
import { NotificationBell } from '@/components/notifications/NotificationBell'

type UserProfile = Database["public"]["Views"]["users_with_details"]["Row"]

interface HeaderProps {
  user: User | null
  profile: UserProfile | null
  onMenuClick: () => void
}

export default function Header({ user, profile, onMenuClick }: HeaderProps) {
  const router = useRouter()
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<{
    tasks: Array<{ id: string; title: string; description: string | null; status: string | null }>;
    users: Array<{ id: string; first_name: string; last_name: string; email: string; role: string | null }>;
  }>({ tasks: [], users: [] })
  const [isSearching, setIsSearching] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Funkcja wyszukiwania
  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults({ tasks: [], users: [] })
      setIsSearchOpen(false)
      return
    }

    setIsSearching(true)
    try {
      // Wyszukiwanie zadań
      const { data: tasksData } = await supabase
        .from('tasks')
        .select('id, title, description, status')
        .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
        .limit(5)

      // Wyszukiwanie użytkowników
      const { data: usersData } = await supabase
        .from('users')
        .select('id, first_name, last_name, email, role')
        .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%`)
        .limit(5)

      setSearchResults({
        tasks: tasksData || [],
        users: usersData || []
      })
      setIsSearchOpen(true)
    } catch (error) {
      console.error('Błąd podczas wyszukiwania:', error)
    } finally {
      setIsSearching(false)
    }
  }

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery) {
        handleSearch(searchQuery)
      }
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [searchQuery])

  return (
    <header className="bg-white/80 backdrop-blur-md shadow-lg border-b border-gray-200/50 sticky top-0 z-40">
      <div className="flex items-center justify-between px-4 sm:px-6 py-4">
        {/* Left side - Mobile menu button and title */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onMenuClick}
            aria-label="Open navigation menu"
            className="lg:hidden p-2 hover:bg-gray-100"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </Button>
          
          <div className="hidden sm:block">
            <h2 className="text-lg sm:text-2xl font-bold bg-gradient-to-r from-gray-900 to-blue-600 bg-clip-text text-transparent">
              Witaj, {profile?.first_name}!
            </h2>
            <Badge variant="secondary" className="text-xs px-3 py-1 bg-gradient-to-r from-blue-100 to-purple-100 text-blue-800 border-blue-200 mt-1">
              {profile?.role === 'dyrektor' ? 'Dyrektor' :
               profile?.role === 'kierownik' ? 'Kierownik' :
               profile?.role === 'superadmin' ? 'Super Admin' : 'Pracownik'}
            </Badge>
          </div>
          
          {/* Mobile title */}
          <div className="sm:hidden">
            <h2 className="text-lg font-bold bg-gradient-to-r from-gray-900 to-blue-600 bg-clip-text text-transparent">
              {profile?.first_name}
            </h2>
          </div>
        </div>

        {/* Right side - Search, notifications, user menu */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Search Bar - hidden on mobile */}
          <div className="hidden md:block relative group" ref={searchRef}>
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" aria-hidden="true" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Szukaj zadań, użytkowników..."
              aria-label="Search tasks and users"
              className="pl-10 w-64 lg:w-80 border-gray-200 focus:border-blue-500 focus:ring-blue-500 transition-all duration-300 shadow-sm hover:shadow-md"
            />
            
            {/* Search Results Dropdown */}
            {isSearchOpen && (searchResults.tasks.length > 0 || searchResults.users.length > 0) && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-xl border border-gray-200 max-h-96 overflow-y-auto z-50">
                {/* Tasks */}
                {searchResults.tasks.length > 0 && (
                  <div className="p-3 border-b border-gray-100">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center">
                      <CheckSquare className="w-3 h-3 mr-2" />
                      Zadania ({searchResults.tasks.length})
                    </div>
                    {searchResults.tasks.map((task) => (
                      <div
                        key={task.id}
                        onClick={() => {
                          router.push(`/dashboard/tasks/${task.id}`)
                          setIsSearchOpen(false)
                          setSearchQuery('')
                        }}
                        className="p-2 hover:bg-gray-50 rounded cursor-pointer transition-colors"
                      >
                        <div className="font-medium text-sm text-gray-900 truncate">
                          {task.title}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {task.description || 'Brak opisu'}
                        </div>
                        <div className="text-xs text-blue-600">
                          Status: {task.status || 'Nieznany'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Users */}
                {searchResults.users.length > 0 && (
                  <div className="p-3">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center">
                      <UserIcon className="w-3 h-3 mr-2" />
                      Użytkownicy ({searchResults.users.length})
                    </div>
                    {searchResults.users.map((user) => (
                      <div
                        key={user.id}
                        onClick={() => {
                          router.push(`/dashboard/users`)
                          setIsSearchOpen(false)
                          setSearchQuery('')
                        }}
                        className="p-2 hover:bg-gray-50 rounded cursor-pointer transition-colors"
                      >
                        <div className="font-medium text-sm text-gray-900 truncate">
                          {user.first_name} {user.last_name}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {user.email}
                        </div>
                        <div className="text-xs text-blue-600">
                          Rola: {user.role || 'Nieznana'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            {/* Loading indicator */}
            {isSearching && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-lg border border-gray-200 p-4 text-center">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-sm text-gray-600 mt-2">Wyszukiwanie...</p>
              </div>
            )}
          </div>
          
          {/* Mobile search button */}
          <Button 
            variant="ghost" 
            size="sm" 
            className="md:hidden p-2 hover:bg-gray-100"
            onClick={() => {
              // Na mobile przekieruj do strony zadań z możliwością wyszukiwania
              router.push('/dashboard/tasks')
            }}
          >
            <Search className="h-5 w-5" />
          </Button>
          
          {/* Notifications */}
          <NotificationBell />

          {/* User Menu */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              aria-label="User menu"
              aria-expanded={isDropdownOpen}
              aria-haspopup="true"
              className="flex items-center space-x-2 p-2 rounded-xl hover:bg-blue-50 hover:border-blue-200 border-2 border-transparent transition-all duration-300 group"
            >
              <Avatar className="h-8 w-8 sm:h-10 sm:w-10 ring-2 ring-blue-500 group-hover:ring-blue-600 transition-all">
                <AvatarFallback className="bg-gradient-to-br from-blue-600 to-blue-700 text-white text-xs sm:text-sm font-semibold">
                  {profile?.first_name?.[0]}{profile?.last_name?.[0]}
                </AvatarFallback>
              </Avatar>
              <ChevronDown className={`hidden sm:block h-4 w-4 text-gray-500 transition-transform duration-300 ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isDropdownOpen && (
              <div className="absolute right-0 mt-3 w-64 bg-white rounded-2xl shadow-2xl border border-gray-200/50 py-3 z-50 animate-in slide-in-from-top-2 duration-300 backdrop-blur-sm">
                {/* User Info */}
                <div className="px-4 py-4 border-b border-gray-100">
                  <div className="flex items-center space-x-3">
                    <Avatar className="h-12 w-12 ring-2 ring-blue-500">
                      <AvatarFallback className="bg-gradient-to-br from-blue-600 to-blue-700 text-white font-semibold">
                        {profile?.first_name?.[0]}{profile?.last_name?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-semibold text-gray-900">
                        {profile?.first_name} {profile?.last_name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {profile?.email}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Menu Items */}
                <div className="py-2">
                  <button 
                    onClick={() => {
                      router.push('/dashboard/profile')
                      setIsDropdownOpen(false)
                    }}
                    className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 flex items-center transition-all duration-200 group"
                  >
                    <UserCircle className="mr-3 h-4 w-4 text-gray-400 group-hover:text-blue-500" />
                    Mój profil
                  </button>
                  <button 
                    onClick={() => {
                      router.push('/dashboard/settings')
                      setIsDropdownOpen(false)
                    }}
                    className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 flex items-center transition-all duration-200 group"
                  >
                    <Settings className="mr-3 h-4 w-4 text-gray-400 group-hover:text-blue-500" />
                    Ustawienia
                  </button>
                  <div className="border-t border-gray-100 my-2"></div>
                  <button 
                    onClick={async () => {
                      await supabase.auth.signOut()
                      router.push('/login')
                      setIsDropdownOpen(false)
                    }}
                    className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 flex items-center transition-all duration-200 group"
                  >
                    <LogOut className="mr-3 h-4 w-4 text-red-400 group-hover:text-red-500" />
                    Wyloguj
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}