'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuthContext } from '@/hooks/useAuth'
import { Database } from '@/types/database'
import Sidebar from '@/components/layouts/Sidebar'
import Header from '@/components/layouts/Header'
import { Building2 } from 'lucide-react'
import { AuthErrorProvider } from '@/components/AuthErrorProvider'
import { SkipLink } from '@/components/ui/skip-link'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, profile, loading, authError } = useAuthContext()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const [loadingTimeoutReached, setLoadingTimeoutReached] = useState(false)

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  // Zamykaj sidebar na mobilnych po kliknięciu poza nim
  useEffect(() => {
    const handleClickOutside = () => {
      if (sidebarOpen && window.innerWidth < 1024) {
        setSidebarOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [sidebarOpen])

  // Zamykaj sidebar na desktop po resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(false)
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (!loading) {
      setLoadingTimeoutReached(false)
      return
    }

    const timer = window.setTimeout(() => {
      setLoadingTimeoutReached(true)
    }, 30000) // Zwiększono z 8s do 30s dla attendance/schedules

    return () => window.clearTimeout(timer)
  }, [loading])

  // WYŁĄCZONE: Przekierowanie powoduje problemy z attendance/schedules
  // useEffect(() => {
  //   if (!loadingTimeoutReached) return

  //   const fallbackPath =
  //     pathname && pathname.startsWith('/dashboard/tasks/')
  //       ? '/dashboard/tasks'
  //       : '/dashboard'

  //   router.replace(fallbackPath)
  // }, [loadingTimeoutReached, pathname, router])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-gray-50 to-blue-50">
        <div className="text-center">
          <div className="relative">
            <div className="w-32 h-32 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center shadow-2xl animate-pulse">
              <Building2 className="h-16 w-16 text-white" />
            </div>
            <div className="absolute inset-0 w-32 h-32 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          </div>
          <h2 className="mt-6 text-2xl font-bold text-gray-700">Ładowanie MOSiR Portal</h2>
          <p className="mt-2 text-gray-500">
            {loadingTimeoutReached
              ? 'Ładowanie trwa dłużej niż zwykle. Przenosimy Cię na listę, aby spróbować ponownie.'
              : 'Przygotowujemy Twój dashboard...'}
          </p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null // Przekierowanie do loginu
  }

  return (
    <AuthErrorProvider authError={authError}>
      <SkipLink />
      <div className="flex h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-gray-100">
        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden" />
        )}
        
        {/* Sidebar */}
        <div className={`
          fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
          <Sidebar user={user} profile={profile as Database["public"]["Views"]["users_with_details"]["Row"] | null} />
        </div>
        
        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header user={user} profile={profile as Database["public"]["Views"]["users_with_details"]["Row"] | null} onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
          <main id="main-content" className="flex-1 overflow-x-hidden overflow-y-auto bg-transparent">
            {children}
          </main>
        </div>
      </div>
    </AuthErrorProvider>
  )
}
