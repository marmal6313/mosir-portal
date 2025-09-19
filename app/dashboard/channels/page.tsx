'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/hooks/useAuth'
import type { Database } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AlertCircle,
  Archive,
  Hash,
  Loader2,
  Lock,
  MessageSquare,
  MoreVertical,
  Plus,
  Send,
  Unlock,
  Users,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { formatDistanceToNow } from 'date-fns'
import { pl } from 'date-fns/locale'


type ChannelRow = Database['public']['Tables']['communication_channels']['Row']
type ChannelMessageRow = Database['public']['Tables']['channel_messages']['Row']
type DepartmentRow = Database['public']['Tables']['departments']['Row']
type UserRow = Pick<Database['public']['Tables']['users']['Row'], 'id' | 'first_name' | 'last_name' | 'role' | 'department_id'>

type MentionRecord = {
  user?: UserRow | null
}

type MessageRecord = ChannelMessageRow & {
  sender?: UserRow | null
  mentions?: MentionRecord[] | null
}

type MentionableUser = {
  id: string
  first_name: string | null
  last_name: string | null
  role: string | null
  full_name: string | null
  department_id: number | null
  department_name: string | null
}

type ChannelWithAccess = ChannelRow & {
  channel_departments?: Array<{ department_id: number }>
}

type MessageWithSender = ChannelMessageRow & {
  sender?: UserRow | null
  mentions?: UserRow[]
}

const VISIBILITY_LABELS: Record<string, { label: string; icon: typeof Unlock }> = {
  public: { label: 'Kanał publiczny', icon: Unlock },
  restricted: { label: 'Kanał ograniczony', icon: Lock },
}

type ChannelFormState = {
  name: string
  description: string
  visibility: 'public' | 'restricted'
  departments: Set<number>
}

const DEFAULT_FORM_STATE: ChannelFormState = {
  name: '',
  description: '',
  visibility: 'public',
  departments: new Set<number>(),
}

function buildDisplayName(user?: UserRow | null) {
  if (!user) return 'Nieznany użytkownik'
  const first = user.first_name?.trim() ?? ''
  const last = user.last_name?.trim() ?? ''
  const full = `${first} ${last}`.trim()
  return full.length ? full : 'Użytkownik bez imienia'
}

function convertMentionableToUserRow(user: MentionableUser): UserRow {
  return {
    id: user.id,
    first_name: user.first_name,
    last_name: user.last_name,
    role: user.role,
    department_id: user.department_id,
  }
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function sortChannels(channels: ChannelWithAccess[]) {
  return [...channels].sort((a, b) => {
    const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0
    const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0
    return bTime - aTime
  })
}

export default function ChannelsPage() {
  const router = useRouter()
  const { user, loading, profile } = useAuthContext()
  const [channels, setChannels] = useState<ChannelWithAccess[]>([])
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null)
  const [messages, setMessages] = useState<MessageWithSender[]>([])
  const [departments, setDepartments] = useState<DepartmentRow[]>([])
  const [loadingChannels, setLoadingChannels] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [creatingChannel, setCreatingChannel] = useState(false)
  const [sendInFlight, setSendInFlight] = useState(false)
  const [channelForm, setChannelForm] = useState<ChannelFormState>(DEFAULT_FORM_STATE)
  const [channelError, setChannelError] = useState<string | null>(null)
  const [messageError, setMessageError] = useState<string | null>(null)
  const userCacheRef = useRef<Map<string, UserRow>>(new Map())
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const [messageDraft, setMessageDraft] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [mentionableUsers, setMentionableUsers] = useState<MentionableUser[]>([])
  const mentionTokensRef = useRef<Map<string, string>>(new Map())
  const [activeMentionUserIds, setActiveMentionUserIds] = useState<Set<string>>(() => new Set())
  const [mentionState, setMentionState] = useState<{ active: boolean; query: string; startIndex: number }>({
    active: false,
    query: '',
    startIndex: -1,
  })
  const [mentionHighlightedIndex, setMentionHighlightedIndex] = useState(0)
  const [channelMenuOpenId, setChannelMenuOpenId] = useState<string | null>(null)
  const menuRefs = useRef<Map<string, HTMLDivElement | null>>(new Map())
  const [archivingChannelId, setArchivingChannelId] = useState<string | null>(null)

  const normalizeMessage = useCallback((message: MessageRecord): MessageWithSender => {
    const sender = (message.sender ?? userCacheRef.current.get(message.sender_id) ?? null) as UserRow | null
    if (sender) {
      userCacheRef.current.set(sender.id, sender)
    }

    const mentionUsers = (message.mentions ?? [])
      .map((mention) => mention?.user ?? null)
      .filter((mention): mention is UserRow => Boolean(mention))

    mentionUsers.forEach((mention) => {
      userCacheRef.current.set(mention.id, mention)
    })

    return {
      ...message,
      sender,
      mentions: mentionUsers,
    }
  }, [])

  const upsertMessage = useCallback((message: MessageWithSender) => {
    if (!message.id) return

    setMessages((prev) => {
      const index = prev.findIndex((item) => item.id === message.id)
      if (index === -1) {
        return [...prev, message]
      }
      const next = [...prev]
      next[index] = message
      return next
    })
  }, [])

  const selectedChannel = useMemo(
    () => channels.find((channel) => channel.id === selectedChannelId) ?? null,
    [channels, selectedChannelId]
  )

  const departmentMap = useMemo(() => {
    const entries = departments.map((department) => [department.id, department] as const)
    return new Map(entries)
  }, [departments])

  const mentionableById = useMemo(() => {
    return new Map(mentionableUsers.map((user) => [user.id, user] as const))
  }, [mentionableUsers])

  const resetForm = useCallback(() => {
    setChannelForm({ ...DEFAULT_FORM_STATE, departments: new Set<number>() })
  }, [])

  const syncMentionTokens = useCallback((value: string) => {
    const toRemove: string[] = []
    mentionTokensRef.current.forEach((token, userId) => {
      if (!value.includes(token)) {
        toRemove.push(userId)
      }
    })

    if (!toRemove.length) return

    setActiveMentionUserIds((prev) => {
      if (prev.size === 0) return prev
      const next = new Set(prev)
      toRemove.forEach((id) => next.delete(id))
      return next
    })

    toRemove.forEach((id) => mentionTokensRef.current.delete(id))
  }, [])

  const updateMentionState = useCallback((value: string, caretPosition: number) => {
    const substring = value.slice(0, caretPosition)
    const atIndex = substring.lastIndexOf('@')

    if (atIndex === -1) {
      if (mentionState.active) {
        setMentionState({ active: false, query: '', startIndex: -1 })
        setMentionHighlightedIndex(0)
      }
      return
    }

    if (atIndex > 0) {
      const charBefore = substring[atIndex - 1]
      if (charBefore && !/\s|[(\[{]/.test(charBefore)) {
        if (mentionState.active) {
          setMentionState({ active: false, query: '', startIndex: -1 })
          setMentionHighlightedIndex(0)
        }
        return
      }
    }

    const query = substring.slice(atIndex + 1)
    if (!query.length) {
      setMentionState({ active: true, query: '', startIndex: atIndex })
      setMentionHighlightedIndex(0)
      return
    }

    if (/[\s.,;:!?]/.test(query)) {
      if (mentionState.active) {
        setMentionState({ active: false, query: '', startIndex: -1 })
        setMentionHighlightedIndex(0)
      }
      return
    }

    setMentionState({ active: true, query: query.toLowerCase(), startIndex: atIndex })
    setMentionHighlightedIndex(0)
  }, [mentionState.active])

  const mentionSuggestions = useMemo(() => {
    if (!mentionState.active) return [] as MentionableUser[]
    const base = mentionableUsers.filter((user) => !activeMentionUserIds.has(user.id))
    const query = mentionState.query.trim()

    if (!query.length) {
      return base.slice(0, 6)
    }

    const lowered = query.toLowerCase()
    return base
      .filter((user) => {
        const label = (user.full_name ?? '').toLowerCase()
        const composed = `${user.first_name ?? ''} ${user.last_name ?? ''}`.toLowerCase()
        const emailLike = label || composed
        return emailLike.includes(lowered)
      })
      .slice(0, 6)
  }, [mentionState.active, mentionState.query, mentionableUsers, activeMentionUserIds])

  useEffect(() => {
    if (mentionHighlightedIndex >= mentionSuggestions.length) {
      setMentionHighlightedIndex(0)
    }
  }, [mentionHighlightedIndex, mentionSuggestions.length])

  const insertMention = useCallback((user: MentionableUser) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const caret = textarea.selectionStart
    const anchor = mentionState.startIndex

    if (anchor < 0 || anchor > caret) {
      setMentionState({ active: false, query: '', startIndex: -1 })
      setMentionHighlightedIndex(0)
      return
    }

    const displayName = buildDisplayName(convertMentionableToUserRow(user))
    const token = `@${displayName}`
    const insertion = `${token} `

    setMessageDraft((prev) => {
      const before = prev.slice(0, anchor)
      const after = prev.slice(caret)
      const nextValue = `${before}${insertion}${after}`

      mentionTokensRef.current.set(user.id, token)
      setActiveMentionUserIds((prevSet) => {
        const next = new Set(prevSet)
        next.add(user.id)
        return next
      })

      window.requestAnimationFrame(() => {
        const position = before.length + insertion.length
        textarea.setSelectionRange(position, position)
        textarea.focus()
      })

      syncMentionTokens(nextValue)
      return nextValue
    })

    setMentionState({ active: false, query: '', startIndex: -1 })
    setMentionHighlightedIndex(0)
  }, [mentionState.startIndex, syncMentionTokens])

  const loadDepartments = useCallback(async () => {
    const { data, error } = await supabase
      .from('departments')
      .select('id, name')
      .order('name')

    if (error) {
      console.error('Błąd ładowania działów', error)
      return
    }

    setDepartments(data ?? [])
  }, [])

  const loadChannels = useCallback(async () => {
    setLoadingChannels(true)
    setChannelError(null)
    const { data, error } = await supabase
      .from('communication_channels')
      .select('id, name, description, visibility, is_archived, created_at, created_by, updated_at, last_message_at, channel_departments ( department_id )')
      .eq('is_archived', false)
      .order('last_message_at', { ascending: false })

    if (error) {
      const code = typeof error === 'object' && 'code' in error ? (error.code as string | undefined) : undefined
      const missingSchema = code === '42P01'
      const recursivePolicy = code === '42P17'
      const message = missingSchema
        ? 'Nie znaleziono tabel kanałów. Uruchom skrypt database/communication_channels.sql w Supabase i spróbuj ponownie.'
        : recursivePolicy
          ? 'Konfiguracja RLS dla kanałów wymaga aktualizacji. Uruchom ponownie zaktualizowany skrypt database/communication_channels.sql w Supabase.'
          : (typeof error === 'object' && 'message' in error && typeof error.message === 'string')
            ? `Nie udało się wczytać listy kanałów: ${error.message}`
            : 'Nie udało się wczytać listy kanałów. Odśwież stronę lub spróbuj ponownie później.'
      console.warn('Nie udało się wczytać kanałów', error)
      setChannelError(message)
      setLoadingChannels(false)
      return
    }

    const filtered = sortChannels(data ?? [])
    setChannels(filtered)

    if (selectedChannelId) {
      const stillExists = filtered.some((channel) => channel.id === selectedChannelId)
      if (!stillExists) {
        setSelectedChannelId(filtered.length > 0 ? filtered[0].id : null)
      }
    } else if (filtered.length > 0) {
      setSelectedChannelId(filtered[0].id)
    }

    setLoadingChannels(false)
  }, [selectedChannelId])

  const loadMessages = useCallback(async (channelId: string) => {
    setLoadingMessages(true)
    setMessageError(null)

    const { data, error } = await supabase
      .from('channel_messages')
      .select<MessageRecord>(`
        id,
        channel_id,
        sender_id,
        content,
        metadata,
        created_at,
        sender:users!channel_messages_sender_id_fkey (
          id,
          first_name,
          last_name,
          role,
          department_id
        ),
        mentions:channel_message_mentions (
          user:users!channel_message_mentions_user_id_fkey (
            id,
            first_name,
            last_name,
            role,
            department_id
          )
        )
      `)
      .eq('channel_id', channelId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Nie udało się wczytać wiadomości', error)
      const code = typeof error === 'object' && 'code' in error ? (error.code as string | undefined) : undefined
      const message = code === '42P01'
        ? 'Brakuje nowych tabel wzmiankowania. Uruchom ponownie skrypt database/communication_channels.sql w Supabase.'
        : (typeof error === 'object' && 'message' in error && typeof error.message === 'string')
          ? `Nie udało się wczytać wiadomości: ${error.message}`
          : 'Nie udało się wczytać wiadomości tego kanału.'
      setMessageError(message)
      setLoadingMessages(false)
      return
    }

    const withSenders: MessageWithSender[] = (data ?? []).map(normalizeMessage)

    setMessages(withSenders)
    setLoadingMessages(false)
  }, [normalizeMessage])

  const ensureSender = useCallback(async (senderId: string) => {
    if (userCacheRef.current.has(senderId)) {
      return userCacheRef.current.get(senderId) ?? null
    }

    const { data } = await supabase
      .from('users')
      .select('id, first_name, last_name, role, department_id')
      .eq('id', senderId)
      .maybeSingle()

    if (data) {
      userCacheRef.current.set(senderId, data)
      return data
    }

    return null
  }, [])

  const fetchMessageWithRelations = useCallback(async (messageId: string) => {
    const { data, error } = await supabase
      .from('channel_messages')
      .select<MessageRecord>(`
        id,
        channel_id,
        sender_id,
        content,
        metadata,
        created_at,
        sender:users!channel_messages_sender_id_fkey (
          id,
          first_name,
          last_name,
          role,
          department_id
        ),
        mentions:channel_message_mentions (
          user:users!channel_message_mentions_user_id_fkey (
            id,
            first_name,
            last_name,
            role,
            department_id
          )
        )
      `)
      .eq('id', messageId)
      .maybeSingle()

    if (error || !data) {
      return null
    }

    return normalizeMessage(data)
  }, [normalizeMessage])

  useEffect(() => {
    if (loading) return

    if (!user) {
      router.push('/login')
      return
    }

    loadDepartments()
    loadChannels()
  }, [user, loading, router, loadDepartments, loadChannels])

  useEffect(() => {
    if (!user) return

    const loadMentionableUsers = async () => {
      const { data, error } = await supabase
        .from('users_with_details')
        .select('id, first_name, last_name, role, department_id, department_name, full_name, active')
        .order('full_name', { ascending: true })

      if (error) {
        console.error('Nie udało się wczytać listy użytkowników do wzmiankowania', error)
        return
      }

      if (data) {
        const filtered = data
          .filter((item) => item.id && item.id !== user.id && (item.active ?? true))
          .map((item) => ({
            id: item.id!,
            first_name: item.first_name,
            last_name: item.last_name,
            role: item.role,
            department_id: item.department_id,
            department_name: item.department_name,
            full_name: item.full_name,
          }))

        setMentionableUsers(filtered)
      }
    }

    loadMentionableUsers()
  }, [user])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!channelMenuOpenId) return
      const container = menuRefs.current.get(channelMenuOpenId)
      if (container && !container.contains(event.target as Node)) {
        setChannelMenuOpenId(null)
      }
    }

    if (channelMenuOpenId) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [channelMenuOpenId])

  useEffect(() => {
    if (selectedChannelId) {
      loadMessages(selectedChannelId)
    } else {
      setMessages([])
    }
  }, [selectedChannelId, loadMessages])

  useEffect(() => {
    if (!selectedChannelId) return

    const channel = supabase
      .channel(`realtime-channel-messages-${selectedChannelId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'channel_messages',
          filter: `channel_id=eq.${selectedChannelId}`,
        },
        async (payload) => {
          const newMessage = payload.new as ChannelMessageRow
          const sender = await ensureSender(newMessage.sender_id)

          const enriched = await fetchMessageWithRelations(newMessage.id)
          if (enriched) {
            upsertMessage(enriched)
          } else {
            upsertMessage(normalizeMessage({ ...newMessage, sender }))
          }

          setChannels((prev) => {
            const updated = prev.map((channel) => (
              channel.id === newMessage.channel_id
                ? { ...channel, last_message_at: newMessage.created_at }
                : channel
            ))
            return sortChannels(updated)
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [selectedChannelId, ensureSender, normalizeMessage, upsertMessage, fetchMessageWithRelations])

  useEffect(() => {
    const messagesContainer = messagesContainerRef.current
    if (!messagesContainer) return

    messagesContainer.scrollTop = messagesContainer.scrollHeight
  }, [messages, selectedChannelId])

  const handleSendMessage = useCallback(async () => {
    if (!user || !selectedChannelId) return

    const content = messageDraft.trim()
    if (!content.length) return

    const mentionIds = Array.from(activeMentionUserIds)

    setSendInFlight(true)
    setMessageError(null)

    try {
      const { data, error } = await supabase
        .rpc('create_channel_message', {
          p_channel_id: selectedChannelId,
          p_content: content,
          p_mentions: mentionIds.length ? mentionIds : null,
        })

      if (error || !data) {
        console.error('Nie udało się wysłać wiadomości', error)
        const errorCode = (error as { code?: string })?.code
        const friendly = errorCode === '42501'
          ? 'Nie masz jeszcze dostępu do tego kanału. Skontaktuj się z administratorem, aby dołączyć.'
          : error?.message || 'Spróbuj ponownie.'
        setMessageError('Nie udało się wysłać wiadomości: ' + friendly)
        return
      }

      const senderRow: UserRow = {
        id: user.id,
        first_name: profile?.first_name ?? null,
        last_name: profile?.last_name ?? null,
        role: profile?.role ?? null,
        department_id: profile?.department_id ?? null,
      }

      const mentionRecords: MentionRecord[] = mentionIds
        .map((id) => mentionableById.get(id))
        .filter((mention): mention is MentionableUser => Boolean(mention))
        .map((mention) => ({ user: convertMentionableToUserRow(mention) }))

      const localMessage = normalizeMessage({
        ...data,
        sender: senderRow,
        mentions: mentionRecords,
      })

      upsertMessage(localMessage)

      const canonical = await fetchMessageWithRelations(data.id)
      if (canonical) {
        upsertMessage(canonical)
      }

      setMessageDraft('')
      mentionTokensRef.current.clear()
      setActiveMentionUserIds(new Set<string>())
      syncMentionTokens('')
      setMentionState({ active: false, query: '', startIndex: -1 })
      setMentionHighlightedIndex(0)

      setChannels((prev) => {
        const updated = prev.map((channel) => (
          channel.id === selectedChannelId
            ? { ...channel, last_message_at: data.created_at }
            : channel
        ))
        return sortChannels(updated)
      })
    } finally {
      setSendInFlight(false)
    }
  }, [
    user,
    selectedChannelId,
    messageDraft,
    activeMentionUserIds,
    profile,
    mentionableById,
    normalizeMessage,
    fetchMessageWithRelations,
    upsertMessage,
    syncMentionTokens,
  ])

  const handleDraftChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const { value, selectionStart } = event.target
      setMessageDraft(value)
      updateMentionState(value, selectionStart)
      syncMentionTokens(value)
    },
    [syncMentionTokens, updateMentionState]
  )

  const handleCaretPositionChange = useCallback(
    (event: React.SyntheticEvent<HTMLTextAreaElement>) => {
      const target = event.currentTarget
      updateMentionState(target.value, target.selectionStart)
    },
    [updateMentionState]
  )

  const renderMessageContent = useCallback((message: MessageWithSender) => {
    const text = message.content ?? ''
    const mentions = message.mentions ?? []

    if (!mentions.length) {
      return <p className="whitespace-pre-wrap text-sm leading-relaxed">{text}</p>
    }

    const labels = Array.from(
      new Set(
        mentions.map((mention) => `@${buildDisplayName(mention)}`)
      )
    )

    if (!labels.length) {
      return <p className="whitespace-pre-wrap text-sm leading-relaxed">{text}</p>
    }

    const pattern = new RegExp(`(${labels.map(escapeRegExp).join('|')})`, 'g')
    const parts = text.split(pattern)
    const labelSet = new Set(labels)

    return (
      <p className="whitespace-pre-wrap text-sm leading-relaxed">
        {parts.map((part, index) => (
          labelSet.has(part)
            ? (
                <span key={`${message.id}-mention-${index}`} className="font-semibold text-blue-600">
                  {part}
                </span>
              )
            : (
                <span key={`${message.id}-text-${index}`}>{part}</span>
              )
        ))}
      </p>
    )
  }, [])

  const handleMessageKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (mentionState.active && mentionSuggestions.length > 0) {
        if (event.key === 'ArrowDown') {
          event.preventDefault()
          setMentionHighlightedIndex((prev) => (prev + 1) % mentionSuggestions.length)
          return
        }

        if (event.key === 'ArrowUp') {
          event.preventDefault()
          setMentionHighlightedIndex((prev) => (prev - 1 + mentionSuggestions.length) % mentionSuggestions.length)
          return
        }

        if ((event.key === 'Enter' && !event.ctrlKey && !event.metaKey) || event.key === 'Tab') {
          event.preventDefault()
          const selected = mentionSuggestions[mentionHighlightedIndex] ?? mentionSuggestions[0]
          if (selected) {
            insertMention(selected)
          }
          return
        }

        if (event.key === 'Escape') {
          event.preventDefault()
          setMentionState({ active: false, query: '', startIndex: -1 })
          setMentionHighlightedIndex(0)
          return
        }
      }

      if (event.key !== 'Enter') return

      const isModifier = event.ctrlKey || event.metaKey
      const allowSend = isModifier || !event.shiftKey

      if (!allowSend) return

      event.preventDefault()
      if (sendInFlight) return

      void handleSendMessage()
    },
    [
      mentionState.active,
      mentionSuggestions,
      mentionHighlightedIndex,
      insertMention,
      handleSendMessage,
      sendInFlight,
    ]
  )

  const closeChannelMenu = useCallback(() => {
    setChannelMenuOpenId(null)
  }, [])

  const handleArchiveChannel = useCallback(
    async (channelId: string) => {
      setArchivingChannelId(channelId)
      setChannelError(null)

      const { error } = await supabase
        .from('communication_channels')
        .update({ is_archived: true })
        .eq('id', channelId)

      if (error) {
        console.error('Nie udało się zarchiwizować kanału', error)
        setChannelError('Nie udało się zarchiwizować kanału. Spróbuj ponownie później.')
        setArchivingChannelId(null)
        return
      }

      setChannels((prev) => {
        const next = prev.filter((channel) => channel.id !== channelId)
        if (selectedChannelId === channelId) {
          setSelectedChannelId(next.length ? next[0].id : null)
        }
        return next
      })

      closeChannelMenu()
      setArchivingChannelId(null)
    },
    [closeChannelMenu, selectedChannelId]
  )

  const handleCreateChannel = useCallback(async () => {
    if (!user) return
    if (!channelForm.name.trim().length) {
      setChannelError('Nazwa kanału jest wymagana.')
      return
    }

    if (channelForm.visibility === 'restricted' && channelForm.departments.size === 0) {
      setChannelError('Wybierz przynajmniej jeden dział dla kanału ograniczonego.')
      return
    }

    setCreatingChannel(true)
    setChannelError(null)

    const departmentIds = channelForm.visibility === 'restricted'
      ? Array.from(channelForm.departments)
      : null

    const { data: channelId, error: createError } = await supabase
      .rpc('create_channel', {
        p_name: channelForm.name.trim(),
        p_description: channelForm.description.trim() || null,
        p_visibility: channelForm.visibility,
        p_departments: departmentIds && departmentIds.length > 0 ? departmentIds : null,
      })

    if (createError || !channelId) {
      console.error('Nie udało się utworzyć kanału', createError)
      const errorMessage =
        (createError && typeof createError === 'object' && 'message' in createError && createError.message)
          ? String(createError.message)
          : (createError && typeof createError === 'object' && 'details' in createError && createError.details)
            ? String(createError.details)
            : 'Nie udało się utworzyć kanału. Spróbuj ponownie.'
      setChannelError(errorMessage)
      setCreatingChannel(false)
      return
    }

    resetForm()
    setCreateDialogOpen(false)
    await loadChannels()
    setSelectedChannelId(channelId)
    setCreatingChannel(false)
  }, [channelForm, user, loadChannels, resetForm])

  const toggleDepartment = useCallback((departmentId: number, checked: boolean) => {
    setChannelForm((prev) => {
      const nextDepartments = new Set(prev.departments)
      if (checked) {
        nextDepartments.add(departmentId)
      } else {
        nextDepartments.delete(departmentId)
      }
      return {
        ...prev,
        departments: nextDepartments,
      }
    })
  }, [])

  const createDialogDepartments = useMemo(() => {
    if (departments.length === 0) return null

    return (
      <div className="mt-4 space-y-2 max-h-56 overflow-y-auto pr-1">
        {departments.map((department) => {
          const checked = channelForm.departments.has(department.id)
          return (
            <label
              key={department.id}
              className="flex items-center space-x-3 rounded-md border border-gray-200 px-3 py-2 hover:bg-gray-50"
            >
              <Checkbox
                checked={checked}
                onCheckedChange={(value) => toggleDepartment(department.id, value === true)}
              />
              <span className="text-sm font-medium text-gray-700">{department.name}</span>
            </label>
          )
        })}
      </div>
    )
  }, [departments, channelForm.departments, toggleDepartment])

  const channelIndicator = useCallback((channel: ChannelWithAccess) => {
    const config = VISIBILITY_LABELS[channel.visibility] ?? VISIBILITY_LABELS.public
    const Icon = config.icon
    const timestamp = channel.last_message_at
      ? formatDistanceToNow(new Date(channel.last_message_at), { addSuffix: true, locale: pl })
      : 'Brak wiadomości'

    return (
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 text-xs text-gray-500">
          <Icon className="h-3.5 w-3.5" />
          <span>{config.label}</span>
        </div>
        <span className="text-xs text-gray-400">{timestamp}</span>
      </div>
    )
  }, [])

  return (
    <div className="flex h-full flex-1 flex-col gap-4 px-3 py-4 sm:gap-6 sm:px-4 sm:py-6 lg:flex-row lg:px-8">
      <aside className="flex w-full flex-col lg:max-w-xs rounded-2xl border border-gray-200 bg-white/80 backdrop-blur-md shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-blue-100 p-2">
              <MessageSquare className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Kanały</h2>
              <p className="text-xs text-gray-500">Wybierz kanał lub utwórz nowy</p>
            </div>
          </div>
          <Button size="icon" variant="ghost" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-5 w-5" />
          </Button>
        </div>

        {channelError && (
          <div className="mx-4 mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4" />
            <span>{channelError}</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-1 pb-4 pt-2 sm:px-2">
          {loadingChannels ? (
            <div className="flex h-full items-center justify-center text-sm text-gray-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Ładowanie kanałów...
            </div>
          ) : channels.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-center text-sm text-gray-500">
              Brak kanałów. Utwórz pierwszy kanał dla swojego działu.
            </div>
          ) : (
            <ul className="space-y-2">
              {channels.map((channel) => {
                const isActive = channel.id === selectedChannelId
                const canManageChannel =
                  profile?.role === 'superadmin' || profile?.role === 'dyrektor' || channel.created_by === user?.id

                return (
                  <li
                    key={channel.id}
                    ref={(node) => {
                      if (node) {
                        menuRefs.current.set(channel.id, node)
                      } else {
                        menuRefs.current.delete(channel.id)
                      }
                    }}
                    className="relative"
                  >
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setSelectedChannelId(channel.id)
                          closeChannelMenu()
                        }}
                        className={`flex-1 rounded-xl border px-4 py-3 text-left transition-all ${
                          isActive
                            ? 'border-blue-500 bg-gradient-to-r from-blue-500/90 to-blue-600 text-white shadow-lg'
                            : 'border-transparent bg-white hover:border-blue-200 hover:bg-blue-50'
                        }`}
                      >
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          <Hash className="h-4 w-4" />
                          <span className="truncate">{channel.name}</span>
                        </div>
                        {channel.description && (
                          <p className={`mt-1 text-xs ${isActive ? 'text-blue-50/80' : 'text-gray-500'}`}>
                            {channel.description}
                          </p>
                        )}
                        <div className={`mt-2 ${isActive ? 'text-blue-100' : 'text-gray-500'}`}>
                          {channelIndicator(channel)}
                        </div>
                      </button>

                      {canManageChannel && (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            setChannelMenuOpenId((prev) => (prev === channel.id ? null : channel.id))
                          }}
                          className={`flex h-10 w-10 items-center justify-center rounded-lg border transition ${
                            channelMenuOpenId === channel.id
                              ? 'border-blue-300 bg-blue-50 text-blue-600'
                              : 'border-transparent text-gray-500 hover:border-blue-200 hover:bg-blue-50'
                          }`}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    {channelMenuOpenId === channel.id && (
                      <div className="absolute right-0 top-12 z-30 w-52 rounded-lg border border-gray-200 bg-white p-2 shadow-xl">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            closeChannelMenu()
                            setSelectedChannelId(channel.id)
                            router.push(`/dashboard/channels/${channel.id}/settings`)
                          }}
                          className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-gray-100"
                          disabled
                        >
                          Ustawienia kanału
                          <span className="text-xs text-gray-400">Wkrótce</span>
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            handleArchiveChannel(channel.id)
                          }}
                          className="mt-1 flex w-full items-center justify-between rounded-md px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={archivingChannelId === channel.id}
                        >
                          {archivingChannelId === channel.id ? 'Archiwizowanie…' : 'Archiwizuj kanał'}
                          <Archive className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </aside>

      <section className="flex flex-1 flex-col">
        {selectedChannel ? (
          <Card className="flex h-full flex-1 flex-col">
            <CardHeader className="border-b border-gray-100 bg-gradient-to-r from-white to-blue-50 pb-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-3 text-xl font-semibold text-gray-900">
                    <Hash className="h-5 w-5 text-blue-600" />
                    {selectedChannel.name}
                  </CardTitle>
                  {selectedChannel.description && (
                    <p className="mt-1 text-sm text-gray-600">{selectedChannel.description}</p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="flex items-center gap-1 border-blue-200 bg-blue-100 text-blue-600">
                    {selectedChannel.visibility === 'restricted' ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                    {VISIBILITY_LABELS[selectedChannel.visibility]?.label ?? 'Kanał publiczny'}
                  </Badge>
                  {selectedChannel.channel_departments && selectedChannel.channel_departments.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {selectedChannel.channel_departments.map(({ department_id }) => (
                        <Badge key={department_id} variant="secondary" className="bg-gray-100 text-gray-700">
                          <Users className="mr-1 h-3 w-3" />
                          {departmentMap.get(department_id)?.name ?? 'Nieznany dział'}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="flex flex-1 flex-col gap-4 overflow-hidden p-0">
              <div ref={messagesContainerRef} className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
                {loadingMessages ? (
                  <div className="flex h-full items-center justify-center text-sm text-gray-500">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Ładowanie wiadomości...
                  </div>
                ) : messages.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
                    Nie ma jeszcze żadnych wiadomości. Zacznij rozmowę jako pierwszy!
                  </div>
                ) : (
                  messages.map((message) => {
                    const sender = message.sender ?? userCacheRef.current.get(message.sender_id) ?? null
                    const departmentName = sender?.department_id ? departmentMap.get(sender.department_id)?.name : null
                    const createdAtLabel = message.created_at
                      ? formatDistanceToNow(new Date(message.created_at), { addSuffix: true, locale: pl })
                      : ''

                    const isOwn = message.sender_id === user?.id

                    return (
                      <div
                        key={message.id}
                        className={`group flex flex-col space-y-1 rounded-xl border px-4 py-3 transition-all ${
                          isOwn
                            ? 'ml-auto max-w-xl border-blue-200 bg-blue-50 text-blue-900'
                            : 'mr-auto max-w-xl border-gray-200 bg-white text-gray-800'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{buildDisplayName(sender)}</span>
                            {departmentName && (
                              <Badge variant="outline" className="border-gray-200 text-gray-500">
                                {departmentName}
                              </Badge>
                            )}
                          </div>
                          <span className="text-gray-400">{createdAtLabel}</span>
                        </div>
                        {renderMessageContent(message)}
                      </div>
                    )
                  })
                )}
              </div>

              <div className="border-t border-gray-100 bg-white px-6 py-4">
                {messageError && (
                  <div className="mb-3 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    <AlertCircle className="h-4 w-4" />
                    {messageError}
                  </div>
                )}
                <div className="flex flex-col gap-3 md:flex-row md:items-end">
                  <div className="relative w-full md:flex-1">
                    <Textarea
                      ref={textareaRef}
                      value={messageDraft}
                      onChange={handleDraftChange}
                      onKeyDown={handleMessageKeyDown}
                      onKeyUp={handleCaretPositionChange}
                      onClick={handleCaretPositionChange}
                      onSelect={handleCaretPositionChange}
                      placeholder="Napisz wiadomość..."
                      className="min-h-[90px] w-full resize-none"
                    />
                    {mentionState.active && mentionSuggestions.length > 0 && (
                      <div className="absolute bottom-full left-0 z-20 mb-2 w-full max-w-sm overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl">
                        {mentionSuggestions.map((suggestion, index) => {
                          const label = buildDisplayName(convertMentionableToUserRow(suggestion))
                          return (
                            <button
                              key={suggestion.id}
                              type="button"
                              className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${
                                index === mentionHighlightedIndex
                                  ? 'bg-blue-600 text-white'
                                  : 'hover:bg-gray-100'
                              }`}
                              onMouseDown={(event) => {
                                event.preventDefault()
                                insertMention(suggestion)
                              }}
                            >
                              <span className="font-medium">{label}</span>
                              {suggestion.department_name && (
                                <span className="ml-3 text-xs text-gray-500">
                                  {suggestion.department_name}
                                </span>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                  <Button
                    onClick={handleSendMessage}
                    disabled={sendInFlight || !messageDraft.trim().length}
                    className="w-full md:w-auto"
                  >
                    {sendInFlight ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="mr-2 h-4 w-4" />
                    )}
                    Wyślij
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : loadingChannels ? (
          <div className="flex flex-1 items-center justify-center text-sm text-gray-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Ładowanie kanałów...
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center text-sm text-gray-500">
              Wybierz kanał z listy po lewej albo utwórz nowy, aby rozpocząć rozmowę.
            </div>
          </div>
        )}
      </section>

      <Dialog open={createDialogOpen} onOpenChange={(open) => {
        setCreateDialogOpen(open)
        if (!open) {
          resetForm()
          setChannelError(null)
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nowy kanał komunikacji</DialogTitle>
            <DialogDescription>
              Stwórz kanał, w którym zespoły będą mogły wymieniać wiadomości w czasie rzeczywistym.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {channelError && (
              <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4" />
                <span>{channelError}</span>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Nazwa kanału</label>
              <Input
                value={channelForm.name}
                onChange={(event) => setChannelForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="np. marketing-eventy"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Opis (opcjonalnie)</label>
              <Textarea
                value={channelForm.description}
                onChange={(event) => setChannelForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="Opisz cel kanału lub zasady komunikacji"
                className="resize-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Widoczność</label>
              <div className="grid gap-3 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setChannelForm((prev) => ({ ...prev, visibility: 'public', departments: new Set<number>() }))}
                  className={`rounded-lg border px-3 py-3 text-left transition-all ${
                    channelForm.visibility === 'public'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300'
                  }`}
                >
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                    <Unlock className="h-4 w-4" />
                    Kanał publiczny
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Dostępny dla wszystkich użytkowników portalu.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setChannelForm((prev) => {
                      const nextDepartments = new Set(prev.departments)
                      if (nextDepartments.size === 0 && profile?.department_id) {
                        nextDepartments.add(profile.department_id)
                      }
                      return {
                        ...prev,
                        visibility: 'restricted',
                        departments: nextDepartments,
                      }
                    })
                  }
                  className={`rounded-lg border px-3 py-3 text-left transition-all ${
                    channelForm.visibility === 'restricted'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300'
                  }`}
                >
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                    <Lock className="h-4 w-4" />
                    Tylko wybrane działy
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Wybierz, które działy będą miały dostęp do kanału.
                  </p>
                </button>
              </div>
            </div>

            {channelForm.visibility === 'restricted' && (
              <div>
                <p className="text-sm font-medium text-gray-700">Działy z dostępem</p>
                <p className="text-xs text-gray-500">Kanał będzie widoczny tylko dla wskazanych działów.</p>
                {createDialogDepartments}
              </div>
            )}
          </div>

          <DialogFooter className="mt-6">
            <Button
              variant="outline"
              onClick={() => {
                setCreateDialogOpen(false)
              }}
              disabled={creatingChannel}
            >
              Anuluj
            </Button>
            <Button onClick={handleCreateChannel} disabled={creatingChannel}>
              {creatingChannel ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Utwórz kanał
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
