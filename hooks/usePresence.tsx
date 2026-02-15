'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'

/**
 * User Presence Status
 */
export type PresenceStatus = 'online' | 'away' | 'offline'

/**
 * User Presence Data
 */
export interface UserPresence {
  user_id: string
  status: PresenceStatus
  last_seen_at: string | null
  updated_at: string | null
}

/**
 * usePresence Hook
 *
 * Manages user presence tracking with heartbeat pattern.
 *
 * Features:
 * - Heartbeat every 30 seconds to update online status
 * - Window visibility detection (blur → away, focus → online)
 * - Real-time subscription to other users' presence
 * - Automatic cleanup on unmount
 *
 * Usage:
 * ```tsx
 * const { userPresence, isOnline, updateStatus } = usePresence()
 *
 * // Check if specific user is online
 * const isUserOnline = isOnline(userId)
 *
 * // Get user's last seen
 * const presence = userPresence.get(userId)
 * const lastSeen = presence?.last_seen_at
 * ```
 */
export function usePresence() {
  const { user } = useAuth()
  const [userPresence, setUserPresence] = useState<Map<string, UserPresence>>(new Map())
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const subscriptionRef = useRef<any>(null)

  /**
   * Update current user's presence status
   */
  const updateStatus = useCallback(async (status: PresenceStatus) => {
    if (!user) return

    try {
      const { error } = await supabase.rpc('update_presence', {
        p_status: status
      })

      if (error) {
        console.error('Failed to update presence:', error)
      }
    } catch (err) {
      console.error('Error updating presence:', err)
    }
  }, [user])

  /**
   * Check if a user is online
   */
  const isOnline = useCallback((userId: string): boolean => {
    const presence = userPresence.get(userId)
    return presence?.status === 'online'
  }, [userPresence])

  /**
   * Check if a user is away
   */
  const isAway = useCallback((userId: string): boolean => {
    const presence = userPresence.get(userId)
    return presence?.status === 'away'
  }, [userPresence])

  /**
   * Get formatted "last seen" text
   */
  const getLastSeenText = useCallback((userId: string): string | null => {
    const presence = userPresence.get(userId)
    if (!presence?.last_seen_at) return null

    const lastSeen = new Date(presence.last_seen_at)
    const now = new Date()
    const diffMs = now.getTime() - lastSeen.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} minutes ago`

    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours} hours ago`

    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays} days ago`
  }, [userPresence])

  /**
   * Fetch all users' presence on mount
   */
  const fetchAllPresence = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('user_presence')
        .select('*')

      if (error) {
        console.error('Failed to fetch presence:', error)
        return
      }

      if (data) {
        const presenceMap = new Map<string, UserPresence>()
        data.forEach((p) => {
          presenceMap.set(p.user_id, p as UserPresence)
        })
        setUserPresence(presenceMap)
      }
    } catch (err) {
      console.error('Error fetching presence:', err)
    }
  }, [])

  /**
   * Handle visibility change (tab focus/blur)
   */
  useEffect(() => {
    if (!user) return

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab is hidden/inactive → set to away
        updateStatus('away')
      } else {
        // Tab is active → set to online
        updateStatus('online')
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [user, updateStatus])

  /**
   * Start heartbeat interval (every 30 seconds)
   */
  useEffect(() => {
    if (!user) return

    // Initial status update
    updateStatus('online')

    // Start heartbeat
    heartbeatIntervalRef.current = setInterval(() => {
      // Only send heartbeat if tab is visible
      if (!document.hidden) {
        updateStatus('online')
      }
    }, 30000) // 30 seconds

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current)
        heartbeatIntervalRef.current = null
      }
    }
  }, [user, updateStatus])

  /**
   * Handle beforeunload (user closes tab/browser)
   */
  useEffect(() => {
    if (!user) return

    const handleBeforeUnload = () => {
      // Set to offline when closing (best effort - may not always work)
      updateStatus('offline')
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [user, updateStatus])

  /**
   * Subscribe to real-time presence updates
   */
  useEffect(() => {
    if (!user) return

    // Fetch initial presence data
    fetchAllPresence()

    // Subscribe to presence changes
    subscriptionRef.current = supabase
      .channel('user-presence-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_presence',
        },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const newPresence = payload.new as UserPresence
            setUserPresence((prev) => {
              const updated = new Map(prev)
              updated.set(newPresence.user_id, newPresence)
              return updated
            })
          } else if (payload.eventType === 'DELETE') {
            const oldPresence = payload.old as UserPresence
            setUserPresence((prev) => {
              const updated = new Map(prev)
              updated.delete(oldPresence.user_id)
              return updated
            })
          }
        }
      )
      .subscribe()

    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current)
        subscriptionRef.current = null
      }
    }
  }, [user, fetchAllPresence])

  /**
   * Cleanup: Set offline on unmount
   */
  useEffect(() => {
    return () => {
      if (user) {
        updateStatus('offline')
      }
    }
  }, [user, updateStatus])

  return {
    /** Map of user_id → UserPresence */
    userPresence,
    /** Check if user is online */
    isOnline,
    /** Check if user is away */
    isAway,
    /** Get "last seen X minutes ago" text */
    getLastSeenText,
    /** Manually update own status */
    updateStatus,
  }
}
