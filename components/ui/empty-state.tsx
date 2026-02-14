import { Button } from '@/components/ui/button'
import { LucideIcon } from 'lucide-react'

/**
 * Empty State Component
 *
 * Displays a consistent empty state when no data is available.
 * Provides helpful guidance and optional action to the user.
 *
 * @param icon - Lucide icon component to display
 * @param title - Main heading text
 * @param description - Supporting text explaining the empty state
 * @param action - Optional action button with label and onClick handler
 *
 * Usage:
 * import { FileText } from 'lucide-react'
 *
 * <EmptyState
 *   icon={FileText}
 *   title="No tasks found"
 *   description="Get started by creating your first task"
 *   action={{
 *     label: "Create Task",
 *     onClick: () => router.push('/dashboard/tasks/add-task')
 *   }}
 * />
 */

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
  }
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action
}: EmptyStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center py-12 px-4 text-center"
      role="status"
      aria-live="polite"
    >
      {/* Icon */}
      <div
        className="w-16 h-16 mb-4 text-gray-400"
        aria-hidden="true"
      >
        <Icon className="w-full h-full" />
      </div>

      {/* Title */}
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        {title}
      </h3>

      {/* Description */}
      <p className="text-sm text-gray-500 max-w-md mb-6">
        {description}
      </p>

      {/* Optional Action Button */}
      {action && (
        <Button onClick={action.onClick} aria-label={action.label}>
          {action.label}
        </Button>
      )}
    </div>
  )
}

/**
 * Compact Empty State
 *
 * Smaller version for use in tables or compact spaces
 *
 * Usage:
 * <CompactEmptyState
 *   icon={Users}
 *   message="No users found"
 * />
 */

interface CompactEmptyStateProps {
  icon: LucideIcon
  message: string
}

export function CompactEmptyState({
  icon: Icon,
  message
}: CompactEmptyStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center py-8 px-4 text-center"
      role="status"
      aria-live="polite"
    >
      <div className="w-12 h-12 mb-3 text-gray-400" aria-hidden="true">
        <Icon className="w-full h-full" />
      </div>
      <p className="text-sm text-gray-600">{message}</p>
    </div>
  )
}
