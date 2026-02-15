'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'
import type { Database } from '@/types/database'

/**
 * Direct Message Conversation
 */
export interface DmConversation {
  id: string
  participant_1: string
  participant_2: string
  last_message_at: string | null
  created_at: string | null
  // Populated fields
  other_user?: {
    id: string
    first_name: string | null
    last_name: string | null
    email: string | null
    avatar_url: string | null
  }
  unread_count?: number
  last_message?: string | null
}

/**
 * Direct Message Content
 */
export interface DmMessage {
  id: string
  dm_id: string
  sender_id: string
  content: string
  metadata: any | null
  read_by_recipient: boolean | null
  created_at: string | null
  // Populated fields
  sender?: {
    id: string
    first_name: string | null
    last_name: string | null
    email: string | null
    avatar_url: string | null
  }
}

/**
 * useDirectMessages Hook
 *
 * Manages direct message conversations and messages.
 *
 * Features:
 * - Get or create DM conversation
 * - Fetch all user's DM conversations
 * - Load messages for specific DM
 * - Send messages via RPC function
 * - Real-time message updates
 * - Mark messages as read
 * - Unread count tracking
 *
 * Usage:
 * ```tsx
 * const {
 *   conversations,
 *   messages,
 *   loading,
 *   sendMessage,
 *   markAsRead,
 *   getOrCreateDm
 * } = useDirectMessages(selectedDmId)
 *
 * // Start DM with a user
 * const dmId = await getOrCreateDm(otherUserId)
 *
 * // Send message
 * await sendMessage('Hello!')
 *
 * // Mark as read
 * await markAsRead()
 * ```
 */
export function useDirectMessages(dmId: string | null) {
  const { user } = useAuth()
  const [conversations, setConversations] = useState<DmConversation[]>([])
  const [messages, setMessages] = useState<DmMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const subscriptionRef = useRef<any>(null)

  /**
   * Get or create DM conversation with another user
   */
  const getOrCreateDm = useCallback(async (otherUserId: string): Promise<string | null> => {
    if (!user) return null

    try {
      const { data, error } = await supabase.rpc('get_or_create_dm', {
        p_other_user_id: otherUserId
      })

      if (error) {
        console.error('Failed to get/create DM:', error)
        return null
      }

      return data as string
    } catch (err) {
      console.error('Error getting/creating DM:', err)
      return null
    }
  }, [user])

  /**
   * Fetch all DM conversations for current user
   */
  const fetchConversations = useCallback(async () => {
    if (!user) return

    setLoading(true)
    try {
      // Get all DMs where user is a participant
      const { data: dms, error } = await supabase
        .from('direct_messages')
        .select('*')
        .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`)
        .order('last_message_at', { ascending: false })

      if (error) {
        console.error('Failed to fetch conversations:', error)
        return
      }

      if (!dms) return

      // Fetch other participants' info and unread counts
      const conversationsWithDetails = await Promise.all(
        dms.map(async (dm) => {
          const otherUserId = dm.participant_1 === user.id ? dm.participant_2 : dm.participant_1

          // Fetch other user's info
          const { data: otherUser } = await supabase
            .from('users')
            .select('id, first_name, last_name, email, avatar_url')
            .eq('id', otherUserId)
            .single()

          // Count unread messages
          const { count: unreadCount } = await supabase
            .from('direct_message_content')
            .select('*', { count: 'exact', head: true })
            .eq('dm_id', dm.id)
            .eq('sender_id', otherUserId)
            .eq('read_by_recipient', false)

          // Get last message preview
          const { data: lastMsg } = await supabase
            .from('direct_message_content')
            .select('content')
            .eq('dm_id', dm.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

          return {
            ...dm,
            other_user: otherUser || undefined,
            unread_count: unreadCount || 0,
            last_message: lastMsg?.content || null,
          } as DmConversation
        })
      )

      setConversations(conversationsWithDetails)
    } catch (err) {
      console.error('Error fetching conversations:', err)
    } finally {
      setLoading(false)
    }
  }, [user])

  /**
   * Fetch messages for a specific DM
   */
  const fetchMessages = useCallback(async (conversationId: string) => {
    if (!user) return

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('direct_message_content')
        .select(`
          *,
          sender:users!direct_message_content_sender_id_fkey(
            id,
            first_name,
            last_name,
            email,
            avatar_url
          )
        `)
        .eq('dm_id', conversationId)
        .order('created_at', { ascending: true })

      if (error) {
        console.error('Failed to fetch messages:', error)
        return
      }

      if (data) {
        setMessages(data as any[])
      }
    } catch (err) {
      console.error('Error fetching messages:', err)
    } finally {
      setLoading(false)
    }
  }, [user])

  /**
   * Send a message in current DM
   */
  const sendMessage = useCallback(async (content: string) => {
    if (!user || !dmId || !content.trim()) return false

    setSending(true)
    try {
      const { data, error } = await supabase.rpc('send_dm_message', {
        p_dm_id: dmId,
        p_content: content.trim()
      })

      if (error) {
        console.error('Failed to send message:', error)
        return false
      }

      return true
    } catch (err) {
      console.error('Error sending message:', err)
      return false
    } finally {
      setSending(false)
    }
  }, [user, dmId])

  /**
   * Mark all unread messages in current DM as read
   */
  const markAsRead = useCallback(async () => {
    if (!user || !dmId) return

    try {
      // Get other participant's ID
      const { data: dm } = await supabase
        .from('direct_messages')
        .select('participant_1, participant_2')
        .eq('id', dmId)
        .single()

      if (!dm) return

      const otherUserId = dm.participant_1 === user.id ? dm.participant_2 : dm.participant_1

      // Mark messages from other user as read
      const { error } = await supabase
        .from('direct_message_content')
        .update({ read_by_recipient: true })
        .eq('dm_id', dmId)
        .eq('sender_id', otherUserId)
        .eq('read_by_recipient', false)

      if (error) {
        console.error('Failed to mark as read:', error)
      }
    } catch (err) {
      console.error('Error marking as read:', err)
    }
  }, [user, dmId])

  /**
   * Fetch conversations on mount
   */
  useEffect(() => {
    if (user) {
      fetchConversations()
    }
  }, [user, fetchConversations])

  /**
   * Fetch messages when dmId changes
   */
  useEffect(() => {
    if (dmId) {
      fetchMessages(dmId)
      // Mark as read when opening
      markAsRead()
    } else {
      setMessages([])
    }
  }, [dmId, fetchMessages, markAsRead])

  /**
   * Subscribe to real-time message updates for current DM
   */
  useEffect(() => {
    if (!user || !dmId) return

    subscriptionRef.current = supabase
      .channel(`dm-messages-${dmId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_message_content',
          filter: `dm_id=eq.${dmId}`,
        },
        async (payload) => {
          const newMessage = payload.new as any

          // Fetch sender info
          const { data: sender } = await supabase
            .from('users')
            .select('id, first_name, last_name, email, avatar_url')
            .eq('id', newMessage.sender_id)
            .single()

          const messageWithSender = {
            ...newMessage,
            sender: sender || undefined,
          } as DmMessage

          setMessages((prev) => [...prev, messageWithSender])

          // If message is from other user, mark as read
          if (newMessage.sender_id !== user.id) {
            markAsRead()
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'direct_message_content',
          filter: `dm_id=eq.${dmId}`,
        },
        (payload) => {
          const updatedMessage = payload.new as any

          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === updatedMessage.id
                ? { ...msg, ...updatedMessage }
                : msg
            )
          )
        }
      )
      .subscribe()

    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current)
        subscriptionRef.current = null
      }
    }
  }, [user, dmId, markAsRead])

  /**
   * Subscribe to conversation updates (new messages in other DMs)
   */
  useEffect(() => {
    if (!user) return

    const conversationChannel = supabase
      .channel('dm-conversations')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_message_content',
        },
        () => {
          // Refresh conversations when any new message arrives
          fetchConversations()
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'direct_messages',
        },
        () => {
          // Refresh when DM conversation updated
          fetchConversations()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(conversationChannel)
    }
  }, [user, fetchConversations])

  return {
    /** List of DM conversations */
    conversations,
    /** Messages in current DM */
    messages,
    /** Loading state */
    loading,
    /** Sending state */
    sending,
    /** Get or create DM with user */
    getOrCreateDm,
    /** Send message in current DM */
    sendMessage,
    /** Mark current DM as read */
    markAsRead,
    /** Refresh conversations list */
    refreshConversations: fetchConversations,
  }
}
