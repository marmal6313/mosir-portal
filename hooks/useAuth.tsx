'use client'

// useAuth.tsx - Poprawiona wersja

import { useState, useEffect, createContext, useContext, useRef } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'

type Profile = Database["public"]["Views"]["users_with_details"]["Row"]

// Kontrola logów - TYMCZASOWO włączone w production dla debugowania
const DEBUG = true // process.env.NODE_ENV === 'development'

interface AuthContextType {
  user: User | null
  profile: Profile | null
  loading: boolean
  authError: string | null
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  authError: null,
})

// Cache dla profilu żeby uniknąć wielokrotnych zapytań
const profileCache = new Map<string, Profile>()

async function fetchProfile(userId: string): Promise<Profile | null> {
  if (DEBUG) console.log('🔍 fetchProfile: Rozpoczynam pobieranie profilu dla użytkownika:', userId)

  // Sprawdź cache
  if (profileCache.has(userId)) {
    if (DEBUG) console.log('✅ fetchProfile: Profil z cache:', profileCache.get(userId))
    return profileCache.get(userId)!
  }

  try {
    if (DEBUG) console.log('🔍 fetchProfile: Pobieram profil z bazy...')

    // Dodaj timeout 10 sekund
    const timeoutPromise = new Promise<null>((resolve) => {
      setTimeout(() => {
        console.warn('⏱️ fetchProfile: Timeout po 10 sekundach')
        resolve(null)
      }, 10000)
    })

    // Race between fetch and timeout
    const fetchPromise = (async () => {
      const { data, error } = await supabase
        .from('users_with_details')
        .select('*')
        .eq('id', userId)
        .single()

      if (DEBUG) console.log('🔍 fetchProfile: Odpowiedź z bazy:', { data, error })

      if (error) {
        console.error('❌ fetchProfile: Błąd pobierania profilu:', error)
        return null
      }

      if (!data) {
        console.error('❌ fetchProfile: Brak danych profilu')
        return null
      }

      if (DEBUG) {
        console.log('✅ fetchProfile: Profil pobrany:', data)
        console.log('🔑 fetchProfile: Rola:', data.role, 'Typ:', typeof data.role)
      }

      // Zapisz w cache
      profileCache.set(userId, data)

      return data
    })()

    const result = await Promise.race([fetchPromise, timeoutPromise])
    return result
  } catch (error) {
    console.error('❌ fetchProfile: Nieoczekiwany błąd podczas pobierania profilu:', error)
    return null
  }
}

export function useAuth(): AuthContextType {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loadingState, setLoadingState] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)

  // Wrapper żeby logować zmiany loading state
  const setLoading = (value: boolean) => {
    if (DEBUG) console.log(`🔄 setLoading: ${loadingState} → ${value}`)
    setLoadingState(value)
  }
  
  // Ref żeby śledzić czy inicjalizacja jest w toku
  const initializingRef = useRef(false)
  const initializedRef = useRef(false)

  // Funkcja do inicjalizacji sesji
  const initializeAuth = async () => {
    if (initializingRef.current || initializedRef.current) {
      if (DEBUG) console.log('🔄 useAuth: Inicjalizacja już w toku lub zakończona, pomijam')
      return
    }

    if (DEBUG) console.log('🔍 useAuth: Rozpoczynam inicjalizację autoryzacji...')

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.error('❌ useAuth: Brak konfiguracji Supabase (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)')
      setAuthError('Brak konfiguracji Supabase. Uzupełnij zmienne środowiskowe i zrestartuj aplikację.')
      setUser(null)
      setProfile(null)
      setLoading(false)
      return
    }

    initializingRef.current = true
    
    try {
      // Pobierz aktualną sesję
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (DEBUG) console.log('🔍 useAuth: Sesja pobrana:', { session, sessionError })
      
      if (sessionError) {
        console.error('❌ useAuth: Błąd sesji:', sessionError)

        // Lokalne wylogowanie gdy trzymamy nieaktualny refresh token
        if (sessionError.message.toLowerCase().includes('refresh token')) {
          await supabase.auth.signOut({ scope: 'local' })
          profileCache.clear()
          setAuthError('Sesja wygasła – zaloguj się ponownie')
        } else {
          setAuthError(sessionError.message)
        }

        setUser(null)
        setProfile(null)
        setLoading(false)
        return
      }

      if (!session?.user) {
        if (DEBUG) console.log('🔍 useAuth: Brak sesji użytkownika')
        setUser(null)
        setProfile(null)
        setLoading(false)
        initializedRef.current = true
        return
      }

      if (DEBUG) console.log('✅ useAuth: Sesja użytkownika znaleziona:', session.user.id)
      setUser(session.user)

      // Pobierz profil
      const userProfile = await fetchProfile(session.user.id)
      
      if (userProfile) {
        if (DEBUG) console.log('✅ useAuth: Profil ustawiony:', userProfile.role)
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
      if (DEBUG) console.log('🔍 useAuth: Inicjalizacja zakończona')
    }
  }

  useEffect(() => {
    if (DEBUG) console.log('🔍 useAuth: useEffect uruchomiony')
    
    // Zresetuj flagi przy każdym nowym effect (np. po Fast Refresh)
    if (!initializedRef.current && !initializingRef.current) {
      initializeAuth()
    }

    // Nasłuchuj zmian autoryzacji
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (DEBUG) console.log('🔄 useAuth: Zmiana stanu autoryzacji:', event)

      // Ignoruj INITIAL_SESSION - to jest obsłużone w initializeAuth
      if (event === 'INITIAL_SESSION') {
        if (DEBUG) console.log('🔄 useAuth: Ignoruję INITIAL_SESSION (obsłużone w initializeAuth)')
        return
      }

      if (event === 'SIGNED_OUT') {
        setUser(null)
        setProfile(null)
        setAuthError(null)
        profileCache.clear() // Wyczyść cache
        initializedRef.current = false
        setLoading(false)
      } else if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user)
        const userProfile = await fetchProfile(session.user.id)
        setProfile(userProfile)
        setLoading(false)
      }
    })

    return () => {
      if (DEBUG) console.log('🔍 useAuth: Cleanup subscription')
      subscription.unsubscribe()
    }
  }, []) // Pusta tablica dependencies - effect uruchomi się tylko raz

  // Debug log - tylko w development
  // useEffect(() => {
  //   if (DEBUG) {
  //     console.log('🔍 useAuth: Stan zmieniony:', {
  //       user: !!user,
  //       profile: !!profile,
  //       loading,
  //       profileRole: profile?.role
  //     })
  //   }
  // }, [user, profile, loading])

  return {
    user,
    profile,
    loading: loadingState,
    authError,
  }
}

// Provider dla kontekstu
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth()
  
  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  )
}

// Hook do używania kontekstu
export function useAuthContext() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuthContext musi być używany wewnątrz AuthProvider')
  }
  return context
}
