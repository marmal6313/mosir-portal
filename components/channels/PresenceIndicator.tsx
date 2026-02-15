import React from 'react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { PresenceStatus } from '@/hooks/usePresence'

/**
 * PresenceIndicator Props
 */
export interface PresenceIndicatorProps {
  /** User's presence status */
  status: PresenceStatus
  /** Last seen timestamp (optional) */
  lastSeenAt?: string | null
  /** Size variant */
  size?: 'sm' | 'md' | 'lg'
  /** Show tooltip with last seen info */
  showTooltip?: boolean
  /** Additional CSS classes */
  className?: string
}

/**
 * PresenceIndicator Component
 *
 * Displays a colored dot indicating user's online status.
 *
 * - 🟢 Green: Online (active)
 * - 🟠 Orange: Away (idle)
 * - ⚪ Gray: Offline
 *
 * Features:
 * - Tooltip with "last seen" timestamp
 * - Multiple size variants
 * - Accessible (includes aria-label)
 *
 * Usage:
 * ```tsx
 * <PresenceIndicator
 *   status="online"
 *   lastSeenAt="2025-01-15T10:30:00Z"
 *   size="md"
 *   showTooltip
 * />
 * ```
 */
export function PresenceIndicator({
  status,
  lastSeenAt,
  size = 'md',
  showTooltip = true,
  className = '',
}: PresenceIndicatorProps) {
  // Size classes
  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  }

  // Status colors
  const statusColors = {
    online: 'bg-green-500',
    away: 'bg-orange-500',
    offline: 'bg-gray-400',
  }

  // Status labels
  const statusLabels = {
    online: 'Online',
    away: 'Away',
    offline: 'Offline',
  }

  // Format last seen time
  const getLastSeenText = (): string => {
    if (!lastSeenAt) return statusLabels[status]

    const lastSeen = new Date(lastSeenAt)
    const now = new Date()
    const diffMs = now.getTime() - lastSeen.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (status === 'online') return 'Online now'
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `Last seen ${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`

    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24)
      return `Last seen ${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`

    const diffDays = Math.floor(diffHours / 24)
    return `Last seen ${diffDays} day${diffDays !== 1 ? 's' : ''} ago`
  }

  const indicator = (
    <div
      className={`rounded-full ${sizeClasses[size]} ${statusColors[status]} ${className}`}
      aria-label={statusLabels[status]}
      role="status"
    />
  )

  // Return with tooltip if enabled
  if (showTooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="inline-flex items-center justify-center">
              {indicator}
            </div>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p className="text-xs">{getLastSeenText()}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return indicator
}

/**
 * PresenceIndicatorWithLabel Component
 *
 * Presence indicator with status label next to it.
 *
 * Usage:
 * ```tsx
 * <PresenceIndicatorWithLabel status="online" lastSeenAt="..." />
 * ```
 */
export function PresenceIndicatorWithLabel({
  status,
  lastSeenAt,
  size = 'md',
}: Omit<PresenceIndicatorProps, 'showTooltip' | 'className'>) {
  const statusLabels = {
    online: 'Online',
    away: 'Away',
    offline: 'Offline',
  }

  return (
    <div className="flex items-center gap-2">
      <PresenceIndicator status={status} lastSeenAt={lastSeenAt} size={size} />
      <span className="text-sm text-gray-600">{statusLabels[status]}</span>
    </div>
  )
}
