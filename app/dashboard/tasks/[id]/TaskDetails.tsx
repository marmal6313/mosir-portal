"use client"
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { 
  ArrowLeft, 
  Edit3, 
  Save, 
  X, 
  Calendar, 
  User, 
  Building2, 
  Target, 
  Clock, 
  CheckCircle2, 
  PlayCircle, 
  Circle, 
  AlertTriangle,
  History,
  Eye,
  EyeOff,
  MessageCircle,
  Send
} from 'lucide-react'
import Link from 'next/link'

type TaskChange = {
  id: string
  task_id: string
  user_id: string | null
  changed_at: string
  old_description: string | null
  new_description: string | null
  old_status: string | null
  new_status: string | null
  old_due_date: string | null
  new_due_date: string | null
  user_name?: string
  users?: {
    first_name: string | null
    last_name: string | null
  } | null
}

type TaskComment = {
  id: string
  task_id: string | null
  user_id: string | null
  comment: string
  created_at: string | null
  users?: {
    first_name: string | null
    last_name: string | null
  } | null
}

type TimelineEntry =
  | { type: 'change'; id: string; timestamp: string; userName: string; change: TaskChange }
  | { type: 'comment'; id: string; timestamp: string; userName: string; comment: TaskComment }

type UserOption = {
  id: string
  full_name: string
  email: string
  department_name: string | null
}

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

const isBoundaryChar = (char: string | undefined) => {
  if (!char) return true
  return /[\s,.;:!?()\[\]{}"'`]/.test(char)
}

const hasMentionToken = (text: string, token: string) => {
  let index = text.indexOf(token)
  while (index !== -1) {
    const before = index === 0 ? undefined : text[index - 1]
    const after = text[index + token.length]

    if (isBoundaryChar(before) && isBoundaryChar(after)) {
      return true
    }

    index = text.indexOf(token, index + 1)
  }

  return false
}

const extractMentionedUserIds = (
  comment: string,
  mentionableUsers: UserOption[],
  authorId?: string
) => {
  if (!comment || mentionableUsers.length === 0) return [] as string[]

  const normalizedComment = normalizeText(comment)
  const mentioned = new Set<string>()

  mentionableUsers.forEach((user) => {
    if (!user.id || user.id === authorId) return

    const normalizedFullName = user.full_name ? normalizeText(user.full_name) : ''
    const tokens = new Set<string>()

    if (normalizedFullName) {
      tokens.add(`@${normalizedFullName}`)

      const parts = normalizedFullName.split(' ')
      if (parts[0]) tokens.add(`@${parts[0]}`)
      if (parts.length > 1) {
        const lastPart = parts[parts.length - 1]
        if (lastPart) tokens.add(`@${lastPart}`)
      }
    }

    if (user.email) {
      const emailPrefix = user.email.split('@')[0]
      const normalizedEmailPrefix = normalizeText(emailPrefix.replace(/[._-]+/g, ' '))
      if (normalizedEmailPrefix) {
        tokens.add(`@${normalizedEmailPrefix}`)
      }
    }

    for (const token of tokens) {
      if (hasMentionToken(normalizedComment, token)) {
        mentioned.add(user.id)
        break
      }
    }
  })

  return Array.from(mentioned)
}

export default function TaskDetails({ task }: { task: Omit<Database['public']['Views']['tasks_with_details']['Row'], 'id'> & { id: string } }) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<{ 
    status: string; 
    due_date: string; 
    description: string;
    assigned_to: string;
    priority: string;
  }>({
    status: task.status || '',
    due_date: task.due_date ? task.due_date.slice(0, 10) : '',
    description: task.description || '',
    assigned_to: task.assigned_to || '',
    priority: task.priority || ''
  })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState("")
  const [error, setError] = useState("")
  const [changes, setChanges] = useState<TaskChange[]>([])
  const [loadingChanges, setLoadingChanges] = useState(true)
  const [comments, setComments] = useState<TaskComment[]>([])
  const [loadingComments, setLoadingComments] = useState(true)
  const [newComment, setNewComment] = useState('')
  const [postingComment, setPostingComment] = useState(false)
  const [showDescription, setShowDescription] = useState(true)
  const [users, setUsers] = useState<UserOption[]>([])
  const [mentionState, setMentionState] = useState<{ active: boolean; query: string; startIndex: number }>({
    active: false,
    query: '',
    startIndex: -1,
  })
  const [mentionHighlightedIndex, setMentionHighlightedIndex] = useState(0)

  // Pobierz listę użytkowników
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const { data: usersData, error } = await supabase
          .from('users_with_details')
          .select('id, full_name, email, department_name')
          .eq('active', true)
          .order('full_name')

        if (error) {
          console.error('Błąd pobierania użytkowników:', error)
        } else {
          // Filtruj użytkowników z niepustymi ID i full_name
          const validUsers = usersData?.filter(user => user.id && user.full_name) || []
          setUsers(validUsers as UserOption[])
        }
      } catch (error) {
        console.error('Błąd pobierania użytkowników:', error)
      }
    }

    fetchUsers()
  }, [])

  const mentionSuggestions = useMemo(() => {
    if (!mentionState.active) return [] as UserOption[]

    const normalizedQuery = normalizeText(mentionState.query)

    const activeMentionIds = new Set(extractMentionedUserIds(newComment, users))

    const candidateUsers = users.filter((user) => user.id && !activeMentionIds.has(user.id))

    if (!normalizedQuery.length) {
      return candidateUsers.slice(0, 6)
    }

    return candidateUsers
      .filter((user) => {
        const tokens = new Set<string>()

        if (user.full_name) {
          const normalizedFull = normalizeText(user.full_name)
          if (normalizedFull) tokens.add(normalizedFull)

          const parts = normalizedFull.split(' ')
          parts.forEach((part) => {
            if (part) tokens.add(part)
          })
        }

        if (user.email) {
          const prefix = user.email.split('@')[0]
          const normalizedPrefix = normalizeText(prefix.replace(/[._-]+/g, ' '))
          if (normalizedPrefix) tokens.add(normalizedPrefix)
        }

        return Array.from(tokens).some((token) => token.includes(normalizedQuery))
      })
      .slice(0, 6)
  }, [mentionState.active, mentionState.query, users, newComment])

  useEffect(() => {
    if (!mentionState.active) {
      setMentionHighlightedIndex(0)
      return
    }

    if (mentionHighlightedIndex >= mentionSuggestions.length) {
      setMentionHighlightedIndex(0)
    }
  }, [mentionState.active, mentionHighlightedIndex, mentionSuggestions.length])

  const updateMentionState = useCallback(
    (value: string, caretPosition: number) => {
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
        if (charBefore && !/[\s(\[{]/.test(charBefore)) {
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

      if (/[\s@,.;:!?]/.test(query)) {
        if (mentionState.active) {
          setMentionState({ active: false, query: '', startIndex: -1 })
          setMentionHighlightedIndex(0)
        }
        return
      }

      setMentionState({ active: true, query: query.toLowerCase(), startIndex: atIndex })
      setMentionHighlightedIndex(0)
    },
    [mentionState.active]
  )

  const insertMention = useCallback(
    (user: UserOption) => {
      const textarea = textareaRef.current
      if (!textarea) return

      const caret = textarea.selectionStart
      const anchor = mentionState.startIndex

      if (anchor < 0 || anchor > caret) {
        setMentionState({ active: false, query: '', startIndex: -1 })
        setMentionHighlightedIndex(0)
        return
      }

      const displayName = user.full_name || user.email || 'użytkownik'
      const token = `@${displayName}`
      const insertion = `${token} `

      setNewComment((prev) => {
        const before = prev.slice(0, anchor)
        const after = prev.slice(caret)
        return `${before}${insertion}${after}`
      })

      requestAnimationFrame(() => {
        const textareaElement = textareaRef.current
        if (!textareaElement) return
        const nextCaret = anchor + insertion.length
        textareaElement.focus()
        textareaElement.setSelectionRange(nextCaret, nextCaret)
      })

      setMentionState({ active: false, query: '', startIndex: -1 })
      setMentionHighlightedIndex(0)
    },
    [mentionState.startIndex]
  )

  const fetchChanges = useCallback(async () => {
    try {
      setLoadingChanges(true)
      if (!task.id) {
        setChanges([])
        setLoadingChanges(false)
        return
      }
      const { data: changesData, error } = await supabase
        .from('task_changes')
        .select(`
          *,
          users:user_id(first_name, last_name)
        `)
        .eq('task_id', task.id)
        .order('changed_at', { ascending: false })

      if (error) {
        console.error('Błąd pobierania historii:', error)
        return
      }

      const changesWithUserNames = changesData?.map(change => ({
        ...change,
        user_name: change.users ? `${change.users.first_name ?? ''} ${change.users.last_name ?? ''}`.trim() || 'Nieznany użytkownik' : 'Nieznany użytkownik'
      })) || []
      setChanges(changesWithUserNames)
    } catch (error) {
      console.error('Błąd pobierania historii:', error)
    } finally {
      setLoadingChanges(false)
    }
  }, [task.id])

  const fetchComments = useCallback(async () => {
    try {
      setLoadingComments(true)
      if (!task.id) {
        setComments([])
        setLoadingComments(false)
        return
      }
      const { data: commentsData, error } = await supabase
        .from('task_comments')
        .select(`
          id,
          comment,
          created_at,
          task_id,
          user_id,
          users:user_id(first_name, last_name)
        `)
        .eq('task_id', task.id)
        .order('created_at', { ascending: true })

      if (error) {
        console.error('Błąd pobierania komentarzy:', error)
        return
      }

      setComments((commentsData as TaskComment[]) || [])
    } catch (error) {
      console.error('Błąd pobierania komentarzy:', error)
    } finally {
      setLoadingComments(false)
    }
  }, [task.id])

  useEffect(() => {
    fetchChanges()
    fetchComments()
  }, [fetchChanges, fetchComments])

  const startEditing = (field: string) => {
    setEditingField(field)
    // Zaktualizuj wartości edycji na podstawie aktualnego zadania
    setEditValues({
      status: task.status || '',
      due_date: task.due_date ? task.due_date.slice(0, 10) : '',
      description: task.description || '',
      assigned_to: task.assigned_to || '',
      priority: task.priority || ''
    })
  }

  const cancelEditing = () => {
    setEditingField(null)
    setError("")
  }

  const handleFieldChange = (field: string, value: string) => {
    setEditValues(prev => ({ ...prev, [field]: value }))
  }

  const saveField = async (field: string) => {
    setLoading(true)
    setError("")
    setSuccess("")

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError("Brak autoryzacji")
        setLoading(false)
        return
      }

      const oldValue = field === 'due_date' ? (task.due_date ? task.due_date.slice(0, 10) : '') : (task[field as keyof typeof task] || '')
      const newValue = editValues[field as keyof typeof editValues]

      if (oldValue === newValue) {
        setSuccess("Brak zmian do zapisania")
        setLoading(false)
        return
      }

      const updateData: Record<string, string | null> = {
        updated_at: new Date().toISOString()
      }
      updateData[field] = field === 'due_date' ? (newValue ? newValue : null) : (newValue || null)

      const { error: updateError } = await supabase
        .from('tasks')
        .update(updateData)
        .eq('id', task.id)

      if (updateError) {
        setError(updateError.message)
        setLoading(false)
        return
      }

      // Zapisz historię zmian
      const historyData = {
        task_id: task.id,
        user_id: user.id,
        old_description: field === 'description' ? (oldValue as string | null) : null,
        new_description: field === 'description' ? (newValue as string | null) : null,
        old_status: field === 'status' ? (oldValue as string | null) : null,
        new_status: field === 'status' ? (newValue as string | null) : null,
        old_due_date: field === 'due_date' ? (oldValue ? task.due_date : null) : null,
        new_due_date: field === 'due_date' ? (newValue ? newValue : null) : null
      }

        const { error: historyError } = await supabase
          .from('task_changes')
        .insert(historyData)

        if (historyError) {
          console.error('Błąd zapisywania historii:', historyError)
        }

      // Zaktualizuj lokalne dane
      Object.assign(task, updateData)
      
      setSuccess(`Pole ${field === 'status' ? 'status' : field === 'due_date' ? 'termin' : field === 'description' ? 'opis' : field === 'priority' ? 'priorytet' : 'przydzielenie'} zostało zaktualizowane!`)
      setEditingField(null)
      
      // Odśwież historię zmian
      await fetchChanges()

    } catch (error) {
      setError("Wystąpił błąd podczas aktualizacji")
      console.error('Błąd aktualizacji:', error)
    }

    setLoading(false)
  }

  const handleAddComment = async () => {
    const trimmed = newComment.trim()
    if (!trimmed) return

    setPostingComment(true)
    setError("")
    setSuccess("")

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setError('Brak aktywnej sesji użytkownika')
        return
      }

      const mentionIds = extractMentionedUserIds(trimmed, users, session.user.id)

      const response = await fetch('/api/tasks/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          taskId: task.id,
          comment: trimmed,
          mentions: mentionIds,
        })
      })

      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        const errorText = payload?.details || payload?.error || 'Nie udało się dodać komentarza'
        setError(errorText)
        return
      }

      const createdComment = payload?.comment as TaskComment | undefined
      setNewComment('')
      setMentionState({ active: false, query: '', startIndex: -1 })
      setMentionHighlightedIndex(0)
      setSuccess('Komentarz dodany')

      if (createdComment) {
        setComments(prev => [...prev, createdComment])
      } else {
        await fetchComments()
      }
    } catch (error) {
      console.error('Błąd dodawania komentarza:', error)
      setError('Nie udało się dodać komentarza')
    } finally {
      setPostingComment(false)
    }
  }

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="h-5 w-5 text-green-600" />
      case 'in_progress': return <PlayCircle className="h-5 w-5 text-yellow-600" />
      case 'new': return <Circle className="h-5 w-5 text-blue-600" />
      case 'cancelled': return <X className="h-5 w-5 text-red-600" />
      default: return <Circle className="h-5 w-5 text-gray-400" />
    }
  }

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 border-green-200'
      case 'in_progress': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'new': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStatusLabel = (status: string | null) => {
    switch (status) {
      case 'completed': return 'Zakończone'
      case 'in_progress': return 'W trakcie'
      case 'new': return 'Nowe'
      case 'cancelled': return 'Anulowane'
      default: return 'Nieznany'
    }
  }

  const getPriorityColor = (priority: string | null) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200'
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'low': return 'bg-green-100 text-green-800 border-green-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getPriorityLabel = (priority: string | null) => {
    switch (priority) {
      case 'high': return 'Wysoki'
      case 'medium': return 'Średni'
      case 'low': return 'Niski'
      default: return 'Brak'
    }
  }

  const isOverdue = (dueDate: string | null) => {
    if (!dueDate) return false
    return new Date(dueDate) < new Date() && task.status !== 'completed'
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Brak terminu'
    return new Date(dateString).toLocaleDateString('pl-PL')
  }

  const formatDateTime = (dateString: string | null | undefined) => {
    if (!dateString) return 'Brak daty'
    const parsed = new Date(dateString)
    if (Number.isNaN(parsed.getTime())) {
      return 'Brak daty'
    }
    return parsed.toLocaleString('pl-PL')
  }

  const getUserDisplayName = useCallback((userId: string | null, fallback?: { first_name: string | null; last_name: string | null } | null) => {
    if (fallback) {
      const fallbackName = `${fallback.first_name ?? ''} ${fallback.last_name ?? ''}`.trim()
      if (fallbackName) {
        return fallbackName
      }
    }

    if (!userId) {
      return 'Nieznany użytkownik'
    }

    const matched = users.find(u => u.id === userId)
    if (matched) {
      return matched.full_name
    }

    return 'Nieznany użytkownik'
  }, [users])

  const getInitials = (name: string) => {
    const letters = name
      .split(/\s+/)
      .filter(Boolean)
      .map(part => part[0]?.toUpperCase() ?? '')
      .join('')
    return letters.slice(0, 2) || '?'
  }

  const timelineEntries = useMemo<TimelineEntry[]>(() => {
    const changeEntries: TimelineEntry[] = changes.map(change => {
      const userName = change.user_name && change.user_name.trim().length > 0
        ? change.user_name
        : getUserDisplayName(change.user_id, change.users ?? undefined)

      return {
        type: 'change' as const,
        id: `change-${change.id}`,
        timestamp: change.changed_at,
        userName,
        change
      }
    })

    const commentEntries: TimelineEntry[] = comments.map(comment => ({
      type: 'comment' as const,
      id: `comment-${comment.id}`,
      timestamp: comment.created_at ?? new Date().toISOString(),
      userName: getUserDisplayName(comment.user_id, comment.users ?? undefined),
      comment
    }))

    return [...changeEntries, ...commentEntries].sort((a, b) => {
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    })
  }, [changes, comments, getUserDisplayName])

  const getAssignedUserName = (userId: string | null) => {
    if (!userId) return 'Brak'
    return getUserDisplayName(userId)
  }

  const renderEditableField = (field: string, label: string, currentValue: string | null, type: 'text' | 'select' | 'date' | 'textarea' = 'text') => {
    const isEditing = editingField === field

    if (isEditing) {
      return (
        <div className="space-y-2 transition-all duration-200 ease-in-out">
          {/* Label i przyciski akcji */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 font-medium">{label}</span>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                onClick={() => saveField(field)}
                disabled={loading}
                className="h-8 px-3 text-sm bg-green-600 hover:bg-green-700 text-white"
              >
                <Save className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={cancelEditing}
                className="h-8 px-3 text-sm border-gray-300 hover:bg-gray-50"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {/* Pole edycji */}
          <div className="space-y-2">
            {type === 'select' && field === 'status' && (
              <select
                value={editValues.status}
                onChange={(e) => handleFieldChange(field, e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="new">Nowe</option>
                <option value="in_progress">W trakcie</option>
                <option value="completed">Zakończone</option>
                <option value="cancelled">Anulowane</option>
              </select>
            )}
            
            {type === 'select' && field === 'assigned_to' && (
              <select
                value={editValues.assigned_to}
                onChange={(e) => handleFieldChange(field, e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Wybierz użytkownika</option>
                {users.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.full_name} {user.department_name ? `(${user.department_name})` : ''}
                  </option>
                ))}
              </select>
            )}

            {type === 'select' && field === 'priority' && (
              <select
                value={editValues.priority}
                onChange={(e) => handleFieldChange(field, e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="low">Niski</option>
                <option value="medium">Średni</option>
                <option value="high">Wysoki</option>
              </select>
            )}
            
            {type === 'date' && (
              <Input
                type="date"
                value={editValues.due_date}
                onChange={(e) => handleFieldChange(field, e.target.value)}
                className="w-full text-sm border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            )}
            
            {type === 'textarea' && (
              <textarea
                value={editValues.description}
                onChange={(e) => handleFieldChange(field, e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                placeholder="Wprowadź opis zadania..."
              />
            )}
          </div>
        </div>
      )
    }

    return (
      <div className="flex items-center justify-start gap-2 group">
        <div>
          <div className="text-xs text-gray-500 font-medium">{label}</div>
          <div className="text-sm font-semibold text-gray-900">
            {field === 'status' ? getStatusLabel(currentValue) :
             field === 'assigned_to' ? getAssignedUserName(currentValue) :
             field === 'priority' ? getPriorityLabel(currentValue) :
             field === 'due_date' ? formatDate(currentValue) :
             field === 'description' ? (currentValue || 'Brak opisu') :
             currentValue || 'Brak'}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => startEditing(field)}
          className="h-6 px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Edit3 className="h-3 w-3" />
        </Button>
      </div>
    )
  }

  if (!task.id) {
    return <div>Błąd: Brak ID zadania.</div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/tasks">
              <Button variant="outline" size="sm" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Powrót do zadań</span>
                <span className="sm:hidden">Powrót</span>
              </Button>
            </Link>
          <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Szczegóły zadania</h1>
              <p className="text-sm text-gray-600 mt-1">Kliknij na ikonę edycji aby zmienić dane</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 py-4 sm:py-6">
        {/* Główna karta zadania */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-4 sm:mb-6 hover:shadow-md transition-shadow">
          <div className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-0 mb-4">
              <div className="flex-1">
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">{task.title}</h2>
                
                {/* Status i priorytet */}
                <div className="flex items-center gap-2 sm:gap-3 mb-4 flex-wrap">
                  <Badge className={`${getStatusColor(task.status)} border text-sm sm:text-base`}>
                    {getStatusIcon(task.status)}
                    {getStatusLabel(task.status)}
                  </Badge>
                  <Badge className={`${getPriorityColor(task.priority)} border text-sm sm:text-base`}>
                    <Target className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                    {getPriorityLabel(task.priority)}
                  </Badge>
                  {isOverdue(task.due_date) && (
                    <Badge className="bg-red-100 text-red-800 border-red-200 border text-sm sm:text-base">
                      <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                      Przeterminowane
                    </Badge>
                  )}
                </div>
                
                {/* ID zadania */}
                <div className="text-xs sm:text-sm text-gray-500 font-mono bg-gray-100 px-2 py-1 rounded inline-block">
                  ID: {task.id}
                </div>
              </div>
            </div>
            
            {/* Szczegóły w grid z inline editing */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <Building2 className="h-5 w-5 text-blue-600 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="text-xs text-gray-500 font-medium">Dział</div>
                    <div className="text-sm font-semibold text-gray-900">{task.department_name || 'Brak'}</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <User className="h-5 w-5 text-green-600 flex-shrink-0" />
                  <div className="flex-1">
                    {renderEditableField('assigned_to', 'Przydzielone do', task.assigned_to, 'select')}
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <User className="h-5 w-5 text-purple-600 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="text-xs text-gray-500 font-medium">Utworzył</div>
                    <div className="text-sm font-semibold text-gray-900">{task.created_by_name || 'Nieznany'}</div>
                  </div>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <Calendar className="h-5 w-5 text-orange-600 flex-shrink-0" />
                  <div className="flex-1">
                    {renderEditableField('due_date', 'Termin', task.due_date, 'date')}
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <Clock className="h-5 w-5 text-indigo-600 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="text-xs text-gray-500 font-medium">Tydzień</div>
                    <div className="text-sm font-semibold text-gray-900">
                      {task.due_date ? `Tydzień ${Math.ceil((new Date(task.due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24 * 7))}` : 'Brak'}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <Clock className="h-5 w-5 text-gray-600 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="text-xs text-gray-500 font-medium">Utworzono</div>
                    <div className="text-sm font-semibold text-gray-900">
                      {task.created_at ? formatDateTime(task.created_at) : 'Brak'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Status z inline editing */}
            <div className="mt-4 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-blue-600 flex-shrink-0" />
                <div className="flex-1">
                  {renderEditableField('status', 'Status zadania', task.status, 'select')}
                </div>
              </div>
            </div>

            {/* Priorytet z inline editing */}
            <div className="mt-4 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <div className="flex items-center gap-3">
                <Target className="h-5 w-5 text-red-600 flex-shrink-0" />
                <div className="flex-1">
                  {renderEditableField('priority', 'Priorytet', task.priority, 'select')}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Opis zadania z inline editing */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-4 sm:mb-6 hover:shadow-md transition-shadow">
          <div className="p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900">Opis zadania</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDescription(!showDescription)}
                className="flex items-center gap-2"
              >
                {showDescription ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                <span className="hidden sm:inline">{showDescription ? 'Ukryj' : 'Pokaż'}</span>
                <span className="sm:hidden">{showDescription ? 'Ukryj' : 'Pokaż'}</span>
              </Button>
            </div>
            
            {showDescription && (
              <div className="bg-gray-50 p-4 rounded-lg">
                {renderEditableField('description', 'Opis', task.description, 'textarea')}
              </div>
            )}
          </div>
        </div>

        {/* Komunikaty */}
        {success && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-4 p-4">
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <span className="text-sm text-green-800">{success}</span>
            </div>
          </div>
        )}
        
        {error && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-4 p-4">
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-red-800" />
              <span className="text-sm text-red-800">{error}</span>
            </div>
          </div>
        )}

        {/* Dyskusja zadania */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-4">
          <div className="p-4 sm:p-6 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900">Dyskusja</h3>
              <Badge variant="outline" className="ml-2 text-xs">
                {comments.length}
              </Badge>
            </div>
          </div>
          <div className="p-4 sm:p-6 space-y-4 max-h-[420px] overflow-y-auto">
            {loadingComments ? (
              <div className="text-center py-6">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-500">Ładowanie komentarzy...</p>
              </div>
            ) : comments.length === 0 ? (
              <div className="text-center py-6 text-sm text-gray-500">
                Brak komentarzy. Rozpocznij dyskusję, aby omówić postęp zadania.
              </div>
            ) : (
              comments.map(comment => {
                const authorName = getUserDisplayName(comment.user_id, comment.users ?? undefined)
                const initials = getInitials(authorName)
                return (
                  <div key={comment.id} className="flex items-start gap-3">
                    <div className="h-9 w-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-semibold">
                      {initials}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">{authorName}</span>
                        <span className="text-xs text-gray-500">{formatDateTime(comment.created_at)}</span>
                      </div>
                      <div className="mt-1 rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 text-sm text-gray-800 whitespace-pre-line">
                        {comment.comment}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
          <div className="border-t border-gray-200 p-4 sm:p-6 space-y-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
              <div className="relative w-full lg:flex-1">
                <Textarea
                  ref={textareaRef}
                  value={newComment}
                  onChange={(event) => {
                    const { value, selectionStart } = event.target
                    setNewComment(value)
                    updateMentionState(value, selectionStart ?? value.length)
                  }}
                  onKeyDown={(event) => {
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
                      if (event.key === 'Enter' && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
                        event.preventDefault()
                        const selected = mentionSuggestions[mentionHighlightedIndex]
                        if (selected) insertMention(selected)
                        return
                      }
                      if (event.key === 'Tab') {
                        event.preventDefault()
                        const selected = mentionSuggestions[mentionHighlightedIndex]
                        if (selected) insertMention(selected)
                        return
                      }
                      if (event.key === 'Escape') {
                        event.preventDefault()
                        setMentionState({ active: false, query: '', startIndex: -1 })
                        setMentionHighlightedIndex(0)
                        return
                      }
                    }

                    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                      event.preventDefault()
                      handleAddComment()
                      return
                    }
                  }}
                  onBlur={() => {
                    setTimeout(() => {
                      setMentionState({ active: false, query: '', startIndex: -1 })
                      setMentionHighlightedIndex(0)
                    }, 100)
                  }}
                  onClick={(event) => {
                    const target = event.target as HTMLTextAreaElement
                    updateMentionState(target.value, target.selectionStart ?? target.value.length)
                  }}
                  onKeyUp={(event) => {
                    const target = event.target as HTMLTextAreaElement
                    updateMentionState(target.value, target.selectionStart ?? target.value.length)
                  }}
                  onSelect={(event) => {
                    const target = event.target as HTMLTextAreaElement
                    updateMentionState(target.value, target.selectionStart ?? target.value.length)
                  }}
                  rows={3}
                  className="min-h-[90px] w-full resize-none"
                  placeholder="Dodaj komentarz lub zapytaj zespół..."
                />
                {mentionState.active && mentionSuggestions.length > 0 && (
                  <div className="absolute bottom-full left-0 z-20 mb-2 w-full max-w-sm overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl">
                    {mentionSuggestions.map((userOption, index) => {
                      const label = userOption.full_name || userOption.email || 'Nieznany'
                      const isActive = index === mentionHighlightedIndex
                      return (
                        <button
                          key={userOption.id}
                          type="button"
                          className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${
                            isActive ? 'bg-blue-600 text-white' : 'hover:bg-gray-100'
                          }`}
                          onMouseDown={(event) => {
                            event.preventDefault()
                            insertMention(userOption)
                          }}
                          onMouseEnter={() => setMentionHighlightedIndex(index)}
                        >
                          <span className="font-medium">{label}</span>
                          {userOption.department_name && (
                            <span className={`ml-3 text-xs ${isActive ? 'text-blue-100' : 'text-gray-500'}`}>
                              {userOption.department_name}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
                <p className="mt-2 text-xs text-gray-500">
                  Wpisz @ i zacznij wpisywać imię, aby oznaczyć osobę. Użyj Ctrl + Enter, żeby szybko wysłać komentarz.
                </p>
              </div>
              <Button
                onClick={handleAddComment}
                disabled={postingComment || newComment.trim().length === 0}
                className="flex items-center gap-2 lg:w-auto"
              >
                {postingComment ? (
                  'Wysyłanie...'
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Wyślij
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Historia zmian */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-4 sm:p-6 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-gray-600" />
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900">Historia zmian</h3>
              <Badge variant="secondary" className="ml-2">
                {timelineEntries.length} aktywności
              </Badge>
            </div>
          </div>
          
          <div className="p-4 sm:p-6">
            {loadingChanges || loadingComments ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-500">Ładowanie historii...</p>
              </div>
            ) : timelineEntries.length === 0 ? (
              <div className="text-center py-8">
                <History className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h4 className="text-lg font-medium text-gray-900 mb-2">Brak historii zmian</h4>
                <p className="text-gray-500">Zadanie nie zostało jeszcze edytowane</p>
              </div>
            ) : (
              <div className="space-y-4">
                {timelineEntries.map((entry, index) => {
                  const isAssignmentChange = entry.type === 'change'
                    && (entry.change.old_description?.startsWith('Przypisanie:') || entry.change.new_description?.startsWith('Przypisanie:'))
                    && entry.change.old_description !== entry.change.new_description
                  const oldAssignment = entry.type === 'change'
                    ? entry.change.old_description?.replace('Przypisanie: ', '')
                    : null
                  const newAssignment = entry.type === 'change'
                    ? entry.change.new_description?.replace('Przypisanie: ', '')
                    : null

                  return (
                    <div key={entry.id} className="relative">
                      {index < timelineEntries.length - 1 && (
                        <div className="absolute left-6 top-8 w-0.5 h-8 bg-gray-200"></div>
                      )}

                      <div className="absolute left-5 top-6 w-3 h-3 bg-blue-500 rounded-full border-2 border-white shadow-sm"></div>

                      <div className="ml-12 bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            {entry.type === 'comment' ? (
                              <MessageCircle className="h-4 w-4 text-blue-500" />
                            ) : (
                              <User className="h-4 w-4 text-gray-400" />
                            )}
                            <span className="text-sm font-medium text-gray-900">
                              {entry.userName}
                            </span>
                          </div>
                          <span className="text-xs text-gray-500">
                            {formatDateTime(entry.timestamp)}
                          </span>
                        </div>

                        {entry.type === 'comment' ? (
                          <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 text-sm text-gray-800 whitespace-pre-line">
                            {entry.comment.comment}
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {isAssignmentChange && (
                              <div className="text-sm">
                                <span className="font-medium text-gray-700">Przypisanie:</span>
                                <div className="mt-1 flex items-center gap-2">
                                  <span className="text-red-600 text-xs">{oldAssignment || 'Brak'}</span>
                                  <span className="text-gray-400">→</span>
                                  <span className="text-green-600 text-xs font-medium">{newAssignment || 'Brak'}</span>
                                </div>
                              </div>
                            )}

                            {!isAssignmentChange && entry.change.old_description !== entry.change.new_description && (
                              <div className="text-sm">
                                <span className="font-medium text-gray-700">Opis:</span>
                                <div className="mt-1 p-2 bg-gray-50 rounded text-xs">
                                  <div className="text-red-600 line-through">{entry.change.old_description || 'Brak'}</div>
                                  <div className="text-green-600 font-medium">{entry.change.new_description || 'Brak'}</div>
                                </div>
                              </div>
                            )}

                            {entry.change.old_status !== entry.change.new_status && (
                              <div className="text-sm">
                                <span className="font-medium text-gray-700">Status:</span>
                                <div className="mt-1 flex items-center gap-2">
                                  <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
                                    {entry.change.old_status || 'Brak'}
                                  </Badge>
                                  <span className="text-gray-400">→</span>
                                  <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                                    {entry.change.new_status || 'Brak'}
                                  </Badge>
                                </div>
                              </div>
                            )}

                            {entry.change.old_due_date !== entry.change.new_due_date && (
                              <div className="text-sm">
                                <span className="font-medium text-gray-700">Termin:</span>
                                <div className="mt-1 flex items-center gap-2">
                                  <span className="text-red-600 text-xs">{entry.change.old_due_date ? formatDate(entry.change.old_due_date) : 'Brak'}</span>
                                  <span className="text-gray-400">→</span>
                                  <span className="text-green-600 text-xs font-medium">{entry.change.new_due_date ? formatDate(entry.change.new_due_date) : 'Brak'}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
} 
