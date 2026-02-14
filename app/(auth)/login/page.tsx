'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Lock, Mail, Eye, EyeOff, Building2, Users, CheckCircle, Loader2 } from 'lucide-react'
import Image from 'next/image'


export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [systemSettings, setSystemSettings] = useState<{
    login_logo?: string
    city_name?: string
    system_name?: string
    login_building_icon?: string
    login_users_icon?: string
    login_check_icon?: string
  }>({})
  const router = useRouter()

  // Załaduj ustawienia systemu
  useEffect(() => {

    // Wyloguj lokalnie, jeśli przeszliśmy tu z uszkodzoną sesją
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        return
      }

      if (session?.expires_at && session.expires_at * 1000 < Date.now()) {
        supabase.auth.signOut({ scope: 'local' }).catch((signOutError) => {
          console.error('Błąd podczas czyszczenia lokalnej sesji:', signOutError)
        })
      }
    }).catch((sessionError) => {
      console.error('Błąd podczas sprawdzania sesji:', sessionError)
      supabase.auth.signOut({ scope: 'local' }).catch((signOutError) => {
        console.error('Błąd podczas awaryjnego czyszczenia sesji:', signOutError)
      })
    })

    loadSystemSettings()
    
    // Sprawdź czy jest komunikat o pomyślnym resetowaniu hasła
    const urlParams = new URLSearchParams(window.location.search)
    const message = urlParams.get('message')
    if (message === 'password-reset-success') {
      setSuccessMessage('Hasło zostało pomyślnie zresetowane. Możesz się teraz zalogować używając nowego hasła.')
      // Usuń parametr z URL
      window.history.replaceState({}, '', '/login')
    }
  }, [])

  const loadSystemSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('key, value')
        .in('key', [
          'login_logo', 
          'city_name', 
          'system_name',
          'login_building_icon',
          'login_users_icon', 
          'login_check_icon'
        ])

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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        console.error('Logowanie nie powiodło się:', signInError)
        setError(signInError.message || 'Nieprawidłowy email lub hasło')
        return
      }

      if (!data?.session) {
        setError('Nie otrzymano sesji logowania. Spróbuj ponownie.')
        return
      }

      router.replace('/dashboard')
    } catch (err) {
      console.error('Wystąpił błąd podczas logowania:', err)
      setError('Wystąpił nieoczekiwany błąd podczas logowania. Spróbuj ponownie lub skontaktuj się z administratorem.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left side - Login Form */}
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-100 p-6 sm:p-8 lg:p-12">
        <div className="w-full max-w-md space-y-8">
          {/* Logo and Header */}
          <div className="text-center">
            <div className="mx-auto w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center shadow-2xl mb-6">
              {systemSettings.login_building_icon ? (
                <Image 
                  src={systemSettings.login_building_icon} 
                  alt="Building Icon" 
                  width={48}
                  height={48}
                  className="w-10 h-10 sm:w-12 sm:h-12 object-contain"
                  onError={() => {
                    // Fallback handled by CSS
                  }}
                />
              ) : null}
              <Building2 className={`w-10 h-10 sm:w-12 sm:h-12 text-white ${systemSettings.login_building_icon ? 'hidden' : ''}`} />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
              {systemSettings.system_name || 'MOSiR Portal'}
            </h1>
            <p className="text-lg text-gray-600 mb-1">
              {systemSettings.city_name || 'Ostrów Mazowiecka'}
            </p>
            <p className="text-sm text-gray-500">
              System zarządzania zadaniami i obiektami
            </p>
          </div>

          {/* Login Form */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-6 sm:p-8">
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 text-center mb-2">
                  Zaloguj się
                </h2>
                <p className="text-sm text-gray-600 text-center">
                  Wprowadź swoje dane logowania
                </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-5">
                {/* Email Field */}
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                    Adres email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      id="email"
                      name="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-400"
                      placeholder="twoj@email.pl"
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                    Hasło
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-400"
                      placeholder="Wprowadź hasło"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 hover:text-gray-600 transition-colors"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff /> : <Eye />}
                    </button>
                  </div>
                  
                  {/* Forgot Password Link */}
                  <div className="mt-2 text-right">
                    <button
                      type="button"
                      onClick={() => router.push('/reset-password')}
                      className="text-sm text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                    >
                      Zapomniałem hasła
                    </button>
                  </div>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm text-red-800">{error}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Success Message */}
                {successMessage && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM10 14a2 2 0 100-4 2 2 0 000 4zm-3-9a1 1 0 11-2 0 1 1 0 012 0zm6 0a1 1 0 11-2 0 1 1 0 012 0z" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm text-green-800">{successMessage}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Login Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-lg hover:shadow-xl"
                >
                  {loading ? (
                    <div className="flex items-center justify-center">
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Logowanie...
                    </div>
                  ) : (
                    'Zaloguj się'
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center">
            <p className="text-xs text-gray-500">
              © 2025 MOSiR {systemSettings.city_name || 'Ostrów Mazowiecka'}. Wszystkie prawa zastrzeżone.
            </p>
          </div>
        </div>
      </div>

      {/* Right side - Features and Info */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-blue-600 via-indigo-700 to-purple-800 text-white p-8 lg:p-12">
        <div className="max-w-lg space-y-8">
          {/* Large Logo */}
          <div className="text-center mb-12">
            {systemSettings.login_logo ? (
              <div className="mx-auto w-32 h-32 bg-white/10 backdrop-blur-sm rounded-3xl flex items-center justify-center shadow-2xl mb-6 overflow-hidden">
                <Image 
                  src={systemSettings.login_logo} 
                  alt="MOSiR Logo" 
                  width={96}
                  height={96}
                  className="w-24 h-24 object-contain"
                  onError={() => {
                    // Fallback handled by CSS
                  }}
                />
                <div className="hidden w-24 h-24 items-center justify-center">
                  <Building2 className="w-16 h-16 text-white/90" />
                </div>
              </div>
            ) : (
              <div className="mx-auto w-32 h-32 bg-white/10 backdrop-blur-sm rounded-3xl flex items-center justify-center shadow-2xl mb-6">
                <Building2 className="w-16 h-16 text-white/90" />
              </div>
            )}
            <h1 className="text-5xl font-bold mb-2 text-white">
              MOSiR
            </h1>
            <p className="text-2xl font-medium text-blue-100">
              {systemSettings.city_name || 'Ostrów Mazowiecka'}
            </p>
          </div>

          {/* Features */}
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-center mb-8">
              System zarządzania obiektami sportowymi
            </h2>
            
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <div className="flex-shrink-0 w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                  {systemSettings.login_check_icon ? (
                    <Image 
                      src={systemSettings.login_check_icon} 
                      alt="Check Icon" 
                      width={20}
                      height={20}
                      className="w-5 h-5 object-contain"
                      onError={() => {
                        // Fallback handled by CSS
                      }}
                    />
                  ) : null}
                  <CheckCircle className={`w-5 h-5 text-green-300 ${systemSettings.login_check_icon ? 'hidden' : ''}`} />
                </div>
                <div>
                  <h3 className="font-medium text-white">Zarządzanie zadaniami</h3>
                  <p className="text-sm text-blue-100">Efektywne planowanie i realizacja projektów</p>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <div className="flex-shrink-0 w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                  {systemSettings.login_users_icon ? (
                    <Image 
                      src={systemSettings.login_users_icon} 
                      alt="Users Icon" 
                      width={20}
                      height={20}
                      className="w-5 h-5 object-contain"
                      onError={() => {
                        // Fallback handled by CSS
                      }}
                    />
                  ) : null}
                  <Users className={`w-5 h-5 text-blue-300 ${systemSettings.login_users_icon ? 'hidden' : ''}`} />
                </div>
                <div>
                  <h3 className="font-medium text-white">Zespół pracowników</h3>
                  <p className="text-sm text-blue-100">Koordynacja działań całego zespołu</p>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <div className="flex-shrink-0 w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                  {systemSettings.login_building_icon ? (
                    <Image 
                      src={systemSettings.login_building_icon} 
                      alt="Building Icon" 
                      width={20}
                      height={20}
                      className="w-5 h-5 object-contain"
                      onError={() => {
                        // Fallback handled by CSS
                      }}
                    />
                  ) : null}
                  <Building2 className={`w-5 h-5 text-indigo-300 ${systemSettings.login_building_icon ? 'hidden' : ''}`} />
                </div>
                <div>
                  <h3 className="font-medium text-white">Obiekty sportowe</h3>
                  <p className="text-sm text-blue-100">Zarządzanie infrastrukturą sportową</p>
                </div>
              </div>
            </div>
          </div>

          {/* Contact Info */}
          <div className="mt-12 text-center">
            <p className="text-blue-100 text-sm">
              Potrzebujesz pomocy? Skontaktuj się z administratorem systemu
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
