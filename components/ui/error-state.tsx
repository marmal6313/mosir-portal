import { Button } from '@/components/ui/button'
import { AlertCircle, RefreshCw } from 'lucide-react'

/**
 * Error State Component
 *
 * Displays a consistent error state with optional retry functionality.
 * Provides clear error messaging and recovery options to the user.
 *
 * @param title - Error title (defaults to "Something went wrong")
 * @param message - Error message explaining what happened
 * @param onRetry - Optional retry callback function
 * @param retryLabel - Custom label for retry button (defaults to "Try Again")
 *
 * Usage:
 * <ErrorState
 *   message="Failed to load tasks. Please check your internet connection."
 *   onRetry={() => fetchTasks()}
 * />
 *
 * <ErrorState
 *   title="Network Error"
 *   message="Unable to connect to the server."
 *   onRetry={handleRetry}
 *   retryLabel="Retry Now"
 * />
 */

interface ErrorStateProps {
  title?: string
  message: string
  onRetry?: () => void
  retryLabel?: string
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  retryLabel = 'Try Again'
}: ErrorStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center py-12 px-4 text-center"
      role="alert"
      aria-live="assertive"
    >
      {/* Error Icon */}
      <div className="w-16 h-16 mb-4 text-red-500" aria-hidden="true">
        <AlertCircle className="w-full h-full" />
      </div>

      {/* Title */}
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        {title}
      </h3>

      {/* Error Message */}
      <p className="text-sm text-gray-600 max-w-md mb-6">
        {message}
      </p>

      {/* Retry Button */}
      {onRetry && (
        <Button
          onClick={onRetry}
          variant="outline"
          aria-label={retryLabel}
        >
          <RefreshCw className="w-4 h-4 mr-2" aria-hidden="true" />
          {retryLabel}
        </Button>
      )}
    </div>
  )
}

/**
 * Inline Error State
 *
 * Compact error display for inline use (forms, small sections)
 *
 * Usage:
 * <InlineErrorState message="Invalid email address" />
 */

interface InlineErrorStateProps {
  message: string
  onDismiss?: () => void
}

export function InlineErrorState({
  message,
  onDismiss
}: InlineErrorStateProps) {
  return (
    <div
      className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg"
      role="alert"
    >
      <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" aria-hidden="true" />
      <p className="text-sm text-red-800 flex-1">{message}</p>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-red-600 hover:text-red-800 transition-colors"
          aria-label="Dismiss error"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </div>
  )
}

/**
 * Network Error State
 *
 * Pre-configured error state for network/connection issues
 *
 * Usage:
 * <NetworkErrorState onRetry={() => fetchData()} />
 */

interface NetworkErrorStateProps {
  onRetry?: () => void
}

export function NetworkErrorState({ onRetry }: NetworkErrorStateProps) {
  return (
    <ErrorState
      title="Connection Error"
      message="Unable to connect to the server. Please check your internet connection and try again."
      onRetry={onRetry}
      retryLabel="Retry Connection"
    />
  )
}

/**
 * Permission Error State
 *
 * Pre-configured error state for permission/authorization issues
 *
 * Usage:
 * <PermissionErrorState />
 */

export function PermissionErrorState() {
  return (
    <ErrorState
      title="Access Denied"
      message="You don't have permission to view this content. Please contact your administrator if you think this is a mistake."
    />
  )
}
