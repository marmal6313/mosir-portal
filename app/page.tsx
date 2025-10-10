'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Home() {
  const router = useRouter()
  const [statusMessage, setStatusMessage] = useState('Przekierowywanie...')

  useEffect(() => {
    let isMounted = true
    let resolved = false

    const fallbackTimer = setTimeout(() => {
      if (!resolved && isMounted) {
        console.warn('Auth check timed out, clearing local session and redirecting to /login')
        setStatusMessage('Sesja wygasła lub jest nieaktualna. Czyszczę dane i przenoszę do logowania...')
        supabase.auth
          .signOut({ scope: 'local' })
          .catch((signOutError) => {
            console.error('Auth fallback signOut failed:', signOutError)
          })
        router.replace('/login')
      }
    }, 4000)

    supabase.auth.getSession()
      .then(({ data: { session }, error }) => {
        if (!isMounted) return
        resolved = true
        clearTimeout(fallbackTimer)

        if (error) {
          console.error('Auth check failed, redirecting to /login', error)
          setStatusMessage('Sesja wygasła. Przekierowuję do logowania...')
          router.replace('/login')
          return
        }

        const user = session?.user

        if (user) {
          router.replace('/dashboard')
        } else {
          router.replace('/login')
        }
      })
      .catch((error) => {
        if (!isMounted) return
        resolved = true
        clearTimeout(fallbackTimer)
        console.error('Auth check threw, redirecting to /login', error)
        setStatusMessage('Wystąpił błąd. Przekierowuję do logowania...')
        router.replace('/login')
      })

    return () => {
      isMounted = false
      clearTimeout(fallbackTimer)
    }
  }, [router])

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="text-center">
        <div className="relative">
          <div className="w-24 h-24 sm:w-32 sm:h-32 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center shadow-2xl animate-pulse">
            <div className="w-12 h-12 sm:w-16 sm:h-16 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
          </div>
        </div>
        <h1 className="mt-4 sm:mt-6 text-lg sm:text-2xl font-bold text-gray-700">Ładowanie MOSiR Portal</h1>
        <p className="mt-2 text-sm sm:text-base text-gray-500">{statusMessage}</p>
      </div>
    </div>
  )
}
