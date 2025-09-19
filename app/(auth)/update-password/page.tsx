'use client'

import { FormEvent, Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Lock, KeyRound, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react'

type Status = 'checking' | 'ready' | 'error'

export const dynamic = 'force-dynamic'

export default function UpdatePasswordPage() {
  return (
    <Suspense fallback={<UpdatePasswordFallback />}>
      <UpdatePasswordContent />
    </Suspense>
  )
}

function UpdatePasswordFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-100 p-6">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-gray-600">Weryfikuję link resetujący...</p>
      </div>
    </div>
  )
}

function UpdatePasswordContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [status, setStatus] = useState<Status>('checking')
  const [verificationError, setVerificationError] = useState('')

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [updating, setUpdating] = useState(false)
  const [updateMessage, setUpdateMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const loginRedirect = useMemo(() => {
    const urlMessage = searchParams.get('redirectMessage')
    return urlMessage ? `/login?message=${encodeURIComponent(urlMessage)}` : '/login?message=password-reset-success'
  }, [searchParams])

  useEffect(() => {
    let active = true

    const handleRecoverySession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!active) return

        if (session) {
          setStatus('ready')
          return
        }

        const hashSource = typeof window !== 'undefined' ? window.location.hash?.replace(/^#/, '') : ''
        const hashParams = new URLSearchParams(hashSource ?? '')
        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')
        const typeFromHash = hashParams.get('type')

        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
          if (error) throw error
          if (!active) return
          setStatus('ready')
          return
        }

        const code = searchParams.get('code')
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) throw error
          if (!active) return
          setStatus('ready')
          return
        }

        const token = searchParams.get('token')
        const type = searchParams.get('type') || typeFromHash
        const email = searchParams.get('email')

        if (token && type === 'recovery') {
          const { error } = await supabase.auth.verifyOtp({
            type: 'recovery',
            token,
            email: email ?? undefined,
          })
          if (error) throw error
          if (!active) return
          setStatus('ready')
          return
        }

        throw new Error('Link resetujący jest nieprawidłowy lub wygasł. Poproś o nowy link.')
      } catch (error) {
        console.error('update-password: failed to verify link', error)
        if (!active) return
        setVerificationError(error instanceof Error ? error.message : 'Nie udało się zweryfikować linku resetującego.')
        setStatus('error')
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        setStatus('ready')
      }
    })

    handleRecoverySession()

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [searchParams])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setUpdateMessage(null)

    if (newPassword.trim().length < 8) {
      setUpdateMessage({ type: 'error', text: 'Hasło musi mieć co najmniej 8 znaków.' })
      return
    }

    if (newPassword !== confirmPassword) {
      setUpdateMessage({ type: 'error', text: 'Potwierdzenie hasła musi być identyczne.' })
      return
    }

    try {
      setUpdating(true)
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error

      setUpdateMessage({ type: 'success', text: 'Hasło zostało pomyślnie zaktualizowane.' })
      setNewPassword('')
      setConfirmPassword('')

      setTimeout(async () => {
        await supabase.auth.signOut()
        router.push(loginRedirect)
      }, 1500)
    } catch (error) {
      console.error('update-password: failed to update password', error)
      setUpdateMessage({ type: 'error', text: error instanceof Error ? error.message : 'Nie udało się zmienić hasła.' })
    } finally {
      setUpdating(false)
    }
  }

  if (status === 'checking') {
    return <UpdatePasswordFallback />
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-red-50 to-rose-100 p-6">
        <div className="w-full max-w-md space-y-6 text-center bg-white/90 rounded-2xl shadow-xl border border-red-100 p-8">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto" />
          <h1 className="text-2xl font-bold text-gray-900">Nie udało się zweryfikować linku</h1>
          <p className="text-gray-600">{verificationError}</p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => router.push('/reset-password')}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:from-blue-700 hover:to-indigo-700"
            >
              <ArrowLeft className="h-4 w-4" />
              Poproś o nowy link
            </button>
            <button
              onClick={() => router.push('/login')}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              Powrót do logowania
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-100 p-6">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-3">
          <div className="mx-auto w-20 h-20 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center shadow-2xl">
            <Lock className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Ustaw nowe hasło</h1>
          <p className="text-gray-600">Wprowadź nowe hasło dla swojego konta MOSiR.</p>
        </div>

        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {updateMessage && (
              <div
                className={`rounded-xl p-4 flex items-center gap-3 ${
                  updateMessage.type === 'success'
                    ? 'bg-green-50 border border-green-200 text-green-800'
                    : 'bg-red-50 border border-red-200 text-red-800'
                }`}
              >
                {updateMessage.type === 'success' ? (
                  <CheckCircle className="h-5 w-5" />
                ) : (
                  <AlertCircle className="h-5 w-5" />
                )}
                <span className="text-sm">{updateMessage.text}</span>
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="new-password" className="block text-sm font-medium text-gray-700">
                Nowe hasło
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="Minimum 8 znaków"
                  autoComplete="new-password"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700">
                Potwierdź nowe hasło
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="Powtórz nowe hasło"
                  autoComplete="new-password"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={updating}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-lg hover:shadow-xl"
            >
              {updating ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Zapisywanie...
                </div>
              ) : (
                'Zapisz nowe hasło'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => router.push('/login')}
              className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 hover:underline transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Powrót do logowania
            </button>
          </div>
        </div>

        <div className="text-center">
          <p className="text-xs text-gray-500">
            © 2025 MOSiR Ostrów Mazowiecka. Wszystkie prawa zastrzeżone.
          </p>
        </div>
      </div>
    </div>
  )
}
