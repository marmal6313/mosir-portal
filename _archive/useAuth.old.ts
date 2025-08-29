// useAuth.ts - Poprawiona wersja

import { useState, useEffect, createContext, useContext, useRef } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

interface Profile {
  id: string | null
  email: string | null
  first_name: string | null
  last_name: string | null
  phone?: string | null
  whatsapp?: string | null
  position?: string | null
  role: string | null
  active: boolean | null
  created_at?: string | null
  updated_at?: string | null
  avatar_url?: string | null
  manager_id?: string | null
  department_id: number | null
  department_name?: string | null
  full_name?: string | null
  manager_name?: string | null
}

interface AuthContextType {
  user: User | null
  profile: Profile | null
  loading: boolean
  authError: string | null
}

// Tworzenie kontekstu
const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Cache dla profilu żeby uniknąć wielokrotnych zapytań
const profileCache = new Map<string, Profile>()

async function fetchProfile(userId: string): Promise<Profile | null> {
  console.log('🔍 fetchProfile: Pobieranie profilu dla ID:', userId)
  
  // Sprawdź cache
  if (profileCache.has(userId)) {
    console.log('💾 fetchProfile: Zwracam profil z cache')
    return profileCache.get(userId)!
  }

  try {
    const { data, error } = await supabase
      .from('users_with_details')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('❌ fetchProfile: Błąd pobierania profilu:', error)
      return null
    }

    if (!data) {
      console.error('❌ fetchProfile: Brak danych profilu')
      return null
    }

    console.log('✅ fetchProfile: Profil pobrany:', data)
    console.log('🔑 fetchProfile: Rola:', data.role, 'Typ:', typeof data.role)
    
    // Zapisz w cache
    profileCache.set(userId, data)
    
    return data
  } catch (error) {
    console.error('❌ fetchProfile: Nieoczekiwany błąd:', error)
    return null
  }
}

// Główny hook useAuth - samodzielny, nie używa kontekstu
export function useAuth(): AuthContextType {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)
  
  // Ref żeby śledzić czy inicjalizacja jest w toku
  const initializingRef = useRef(false)
  const initializedRef = useRef(false)

  // Funkcja do inicjalizacji sesji
  const initializeAuth = async () => {
    if (initializingRef.current || initializedRef.current) {
      console.log('🔄 useAuth: Inicjalizacja już w toku lub zakończona, pomijam')
      return
    }

    console.log('🔍 useAuth: Rozpoczynam inicjalizację autoryzacji...')
    initializingRef.current = true
    
    try {
      // Pobierz aktualną sesję
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError) {
        console.error('❌ useAuth: Błąd sesji:', sessionError)
        setAuthError(sessionError.message)
        setLoading(false)
        return
      }

      if (!session?.user) {
        console.log('🔍 useAuth: Brak sesji użytkownika')
        setUser(null)
        setProfile(null)
        setLoading(false)
        initializedRef.current = true
        return
      }

      console.log('✅ useAuth: Sesja użytkownika znaleziona:', session.user.id)
      setUser(session.user)

      // Pobierz profil
      const userProfile = await fetchProfile(session.user.id)
      
      if (userProfile) {
        console.log('✅ useAuth: Profil ustawiony:', userProfile.role)
        setProfile(userProfile)
      } else {
        console.error('❌ useAuth: Nie udało się pobrać profilu')
        setAuthError('Nie udało się pobrać profilu użytkownika')
      }

    } catch (error) {
      console.error('❌ useAuth: Nieoczekiwany błąd podczas inicjalizacji:', error)
      setAuthError('Nieoczekiwany błąd podczas inicjalizacji')
    } finally {
      setLoading(false)
      initializingRef.current = false
      initializedRef.current = true
      console.log('🔍 useAuth: Inicjalizacja zakończona')
    }
  }

  useEffect(() => {
    console.log('🔍 useAuth: useEffect uruchomiony')
    
    // Zresetuj flagi przy każdym nowym effect (np. po Fast Refresh)
    if (!initializedRef.current && !initializingRef.current) {
      initializeAuth()
    }

    // Nasłuchuj zmian autoryzacji
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔄 useAuth: Zmiana stanu autoryzacji:', event)
      
      if (event === 'SIGNED_OUT') {
        setUser(null)
        setProfile(null)
        setAuthError(null)
        profileCache.clear() // Wyczyść cache
        initializedRef.current = false
      } else if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user)
        const userProfile = await fetchProfile(session.user.id)
        setProfile(userProfile)
      }
      
      setLoading(false)
    })

    return () => {
      console.log('🔍 useAuth: Cleanup subscription')
      subscription.unsubscribe()
    }
  }, []) // Pusta tablica dependencies - effect uruchomi się tylko raz

  // Debug log
  useEffect(() => {
    console.log('🔍 useAuth: Stan zmieniony:', {
      user: !!user,
      profile: !!profile,
      loading,
      profileRole: profile?.role
    })
  }, [user, profile, loading])

  return {
    user,
    profile,
    loading,
    authError,
  }
}

// Provider dla kontekstu - używa useAuth wewnętrznie
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth()
  
  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  )
}

// Hook do używania kontekstu
export function useAuthContext(): AuthContextType {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuthContext musi być używany wewnątrz AuthProvider')
  }
  return context
}