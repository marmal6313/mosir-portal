'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'

interface AuthErrorProviderProps {
  children: React.ReactNode
  authError?: string | null
}

export function AuthErrorProvider({ children, authError }: AuthErrorProviderProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (authError) {
      setErrorMessage(authError)
    }
  }, [authError])

  const hideError = () => {
    setErrorMessage(null)
  }

  return (
    <>
      {children}
      
      {/* Błąd autoryzacji */}
      {errorMessage && (
        <div className="fixed top-4 right-4 z-50 max-w-md">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 shadow-lg">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-sm font-medium text-red-800">
                  Problem z uwierzytelnianiem
                </h3>
                <p className="mt-1 text-sm text-red-700">
                  {errorMessage}
                </p>
              </div>
              <button
                onClick={hideError}
                className="text-red-400 hover:text-red-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
