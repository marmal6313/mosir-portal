'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        router.push('/dashboard')
      } else {
        router.push('/login')
      }
    }

    checkAuth()
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
        <p className="mt-2 text-sm sm:text-base text-gray-500">Przekierowywanie...</p>
      </div>
    </div>
  )
}