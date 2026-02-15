import React from 'react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { PresenceIndicator } from './PresenceIndicator'
import type { PresenceStatus } from '@/hooks/usePresence'
import type { DmConversation } from '@/hooks/useDirectMessages'

/**
 * DmListItem Props
 */
export interface DmListItemProps {
  /** DM conversation data */
  conversation: DmConversation
  /** User's presence status */
  presenceStatus?: PresenceStatus
  /** Last seen timestamp */
  lastSeenAt?: string | null
  /** Whether this DM is currently selected */
  isSelected?: boolean
  /** Click handler */
  onClick: () => void
}

/**
 * DmListItem Component
 *
 * Displays a direct message conversation in the sidebar.
 *
 * Features:
 * - User avatar with fallback initials
 * - Presence indicator (online/away/offline)
 * - Unread message count badge
 * - Last message preview
 * - Selected state styling
 *
 * Usage:
 * ```tsx
 * <DmListItem
 *   conversation={dmConversation}
 *   presenceStatus="online"
 *   lastSeenAt="2025-01-15T10:30:00Z"
 *   isSelected={selectedDmId === dmConversation.id}
 *   onClick={() => setSelectedDmId(dmConversation.id)}
 * />
 * ```
 */
export function DmListItem({
  conversation,
  presenceStatus = 'offline',
  lastSeenAt,
  isSelected = false,
  onClick,
}: DmListItemProps) {
  const { other_user, unread_count, last_message } = conversation

  // Get user display name
  const userName =
    other_user?.first_name && other_user?.last_name
      ? `${other_user.first_name} ${other_user.last_name}`
      : other_user?.email || 'Unknown User'

  // Get avatar initials
  const initials =
    other_user?.first_name && other_user?.last_name
      ? `${other_user.first_name[0]}${other_user.last_name[0]}`.toUpperCase()
      : (other_user?.email?.[0] || '?').toUpperCase()

  // Truncate last message
  const truncatedMessage = last_message
    ? last_message.length > 40
      ? `${last_message.substring(0, 40)}...`
      : last_message
    : 'No messages yet'

  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
        transition-colors duration-150
        ${
          isSelected
            ? 'bg-blue-50 border-l-4 border-blue-600'
            : 'hover:bg-gray-100 border-l-4 border-transparent'
        }
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
      `}
      aria-label={`Direct message with ${userName}`}
      aria-current={isSelected ? 'true' : undefined}
    >
      {/* Avatar with presence indicator */}
      <div className="relative flex-shrink-0">
        <Avatar className="h-10 w-10">
          <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-600 text-white text-sm font-medium">
            {initials}
          </AvatarFallback>
        </Avatar>

        {/* Presence dot - positioned at bottom-right of avatar */}
        <div className="absolute bottom-0 right-0 translate-x-1 translate-y-1">
          <div className="bg-white rounded-full p-0.5">
            <PresenceIndicator
              status={presenceStatus}
              lastSeenAt={lastSeenAt}
              size="sm"
              showTooltip={false}
            />
          </div>
        </div>
      </div>

      {/* User info */}
      <div className="flex-1 min-w-0 text-left">
        {/* Name and unread badge */}
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <span
            className={`text-sm font-medium truncate ${
              isSelected ? 'text-blue-700' : 'text-gray-900'
            }`}
          >
            {userName}
          </span>

          {/* Unread count badge */}
          {unread_count && unread_count > 0 && (
            <Badge
              variant="default"
              className="h-5 min-w-[1.25rem] px-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700"
            >
              {unread_count > 99 ? '99+' : unread_count}
            </Badge>
          )}
        </div>

        {/* Last message preview */}
        <p
          className={`text-xs truncate ${
            unread_count && unread_count > 0
              ? 'text-gray-900 font-medium'
              : 'text-gray-500'
          }`}
        >
          {truncatedMessage}
        </p>
      </div>
    </button>
  )
}

/**
 * DmListItemSkeleton Component
 *
 * Loading skeleton for DM list item.
 *
 * Usage:
 * ```tsx
 * {loading ? <DmListItemSkeleton /> : <DmListItem ... />}
 * ```
 */
export function DmListItemSkeleton() {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      {/* Avatar skeleton */}
      <div className="h-10 w-10 rounded-full bg-gray-200 animate-pulse flex-shrink-0" />

      {/* Content skeleton */}
      <div className="flex-1 space-y-2">
        <div className="h-4 w-24 bg-gray-200 animate-pulse rounded" />
        <div className="h-3 w-32 bg-gray-200 animate-pulse rounded" />
      </div>
    </div>
  )
}
