'use client'

import { useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'
import { useToast } from './useToast'

/** Notification types that trigger chat notifications */
const CHAT_NOTIFICATION_TYPES = ['channel_message', 'dm_message', 'mention', 'info'] as const

/** Audio context for generating notification sound */
let audioContext: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!audioContext) {
    try {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    } catch {
      console.warn('[chat-notifications] Web Audio API not available')
      return null
    }
  }
  return audioContext
}

/**
 * Play a short notification sound using Web Audio API.
 * Two-tone chime: C5 (523Hz) → E5 (659Hz)
 */
function playNotificationSound() {
  const ctx = getAudioContext()
  if (!ctx) return

  // Resume context if suspended (browser autoplay policy)
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {})
  }

  const now = ctx.currentTime

  // First tone: C5 (523 Hz)
  const osc1 = ctx.createOscillator()
  const gain1 = ctx.createGain()
  osc1.type = 'sine'
  osc1.frequency.value = 523.25
  gain1.gain.setValueAtTime(0.15, now)
  gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.15)
  osc1.connect(gain1)
  gain1.connect(ctx.destination)
  osc1.start(now)
  osc1.stop(now + 0.15)

  // Second tone: E5 (659 Hz)
  const osc2 = ctx.createOscillator()
  const gain2 = ctx.createGain()
  osc2.type = 'sine'
  osc2.frequency.value = 659.25
  gain2.gain.setValueAtTime(0.15, now + 0.1)
  gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.3)
  osc2.connect(gain2)
  gain2.connect(ctx.destination)
  osc2.start(now + 0.1)
  osc2.stop(now + 0.3)
}

interface NotificationPayload {
  id: string
  user_id: string
  title: string
  message: string
  type: string
  action_url: string | null
  read: boolean
  created_at: string
}

/**
 * useChatNotifications Hook
 *
 * Listens for real-time notifications from the database and shows
 * in-app toasts + plays sound for chat-related notifications.
 *
 * Features:
 * - Real-time subscription to notifications table
 * - In-app toast for channel messages, DMs, and mentions
 * - Two-tone notification sound (Web Audio API)
 * - Respects user preferences (sound on/off, notification types)
 * - Clickable toast to navigate to the message
 *
 * Usage:
 * ```tsx
 * // In dashboard layout
 * useChatNotifications()
 * ```
 */
export function useChatNotifications() {
  const { user } = useAuth()
  const { toast } = useToast()
  const subscriptionRef = useRef<any>(null)
  const prefsRef = useRef<{
    sound_enabled: boolean
    notify_channel_messages: boolean
    notify_dm_messages: boolean
    notify_mentions: boolean
  }>({
    sound_enabled: true,
    notify_channel_messages: true,
    notify_dm_messages: true,
    notify_mentions: true,
  })

  // Load user notification preferences
  const loadPreferences = useCallback(async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('sound_enabled, notify_channel_messages, notify_dm_messages, notify_mentions')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!error && data) {
        prefsRef.current = {
          sound_enabled: data.sound_enabled ?? true,
          notify_channel_messages: data.notify_channel_messages ?? true,
          notify_dm_messages: data.notify_dm_messages ?? true,
          notify_mentions: data.notify_mentions ?? true,
        }
      }
    } catch {
      // Use defaults on error
    }
  }, [user])

  // Handle incoming notification
  const handleNotification = useCallback((payload: NotificationPayload) => {
    if (!user || payload.user_id !== user.id) return

    const type = payload.type
    const prefs = prefsRef.current

    // Check if this notification type is enabled
    if (type === 'channel_message' && !prefs.notify_channel_messages) return
    if (type === 'dm_message' && !prefs.notify_dm_messages) return
    if ((type === 'mention' || type === 'info') && !prefs.notify_mentions) return

    // Only handle chat-related types
    if (!CHAT_NOTIFICATION_TYPES.includes(type as any)) return

    // Play sound
    if (prefs.sound_enabled) {
      playNotificationSound()
    }

    // Show toast
    const variant = type === 'dm_message' ? 'default' : 'default'
    const icon = type === 'dm_message' ? '💬' : type === 'mention' ? '📢' : '📨'

    toast({
      title: `${icon} ${payload.title}`,
      description: payload.message.length > 80
        ? payload.message.substring(0, 80) + '...'
        : payload.message,
      variant,
      duration: 5000,
      action: payload.action_url ? (
        <button
          onClick={() => window.location.href = payload.action_url!}
          className="text-xs font-medium text-blue-600 hover:text-blue-800 underline"
        >
          Otwórz
        </button>
      ) : undefined,
    })
  }, [user, toast])

  // Load preferences on mount
  useEffect(() => {
    loadPreferences()
  }, [loadPreferences])

  // Subscribe to real-time notifications
  useEffect(() => {
    if (!user) return

    subscriptionRef.current = supabase
      .channel(`chat-notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const notification = payload.new as NotificationPayload
          handleNotification(notification)
        }
      )
      .subscribe()

    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current)
        subscriptionRef.current = null
      }
    }
  }, [user, handleNotification])

  return {
    /** Reload preferences (call after user saves settings) */
    reloadPreferences: loadPreferences,
  }
}
