'use client'

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { GanttChart, type GanttItem } from '@/components/GanttChart'
import type { Database } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Search, Filter, Plus, Download, RefreshCw } from 'lucide-react'
import { useAuthContext } from '@/hooks/useAuth'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { getStatusLabel, getPriorityLabel, getStatusColor, getPriorityColor } from '@/lib/tasks-utils'
import { useRouter } from 'next/navigation'

// ===== Date helpers — stabilne dla Gantta =====
// "YYYY-MM-DD" ?
const isDateOnly = (s?: string | null) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s)

// DB -> lokalne POŁUDNIE (12:00) tego dnia
const fromDbToLocalNoon = (value?: string | null, fallbackDays = 0): Date => {
  const now = new Date()
  if (!value) {
    const f = new Date(now)
    f.setDate(f.getDate() + fallbackDays)
    f.setHours(12, 0, 0, 0)
    return f
  }
  if (isDateOnly(value)) {
    const [y, m, d] = value.split('-').map(Number)
    return new Date(y, m - 1, d, 12, 0, 0, 0)
  }
  const dt = new Date(value)
  if (isNaN(dt.getTime())) {
    const f = new Date(now)
    f.setDate(f.getDate() + fallbackDays)
    f.setHours(12, 0, 0, 0)
    return f
  }
  dt.setHours(12, 0, 0, 0)
  return dt
}

// Do zapisu w DB: początek/koniec doby w UTC
const toDbStartIso = (d: Date) =>
  new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)).toISOString()

const toDbEndIso = (d: Date) =>
  new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)).toISOString()

// do <input type="date"> – zawsze lokalny YYYY-MM-DD (bez UTC)
const toDateInputValue = (d: Date): string => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Dodatkowe pomocnicze do filtrowania zakresów dobowych
const startOfDayLocal = (d: Date) => { const x = new Date(d); x.setHours(0,0,0,0); return x }
const endOfDayLocal   = (d: Date) => { const x = new Date(d); x.setHours(23,59,59,999); return x }

// ===== Helpery zakresu widoku (stabilne 12:00 lokalnie) =====
const atNoon = (d: Date) => { const x = new Date(d); x.setHours(12,0,0,0); return x }
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate()+n); return x }

// poniedziałek jako start tygodnia
const startOfWeekMon = (d: Date) => {
  const x = atNoon(d)
  const dow = (x.getDay() + 6) % 7 // 0=pon
  x.setDate(x.getDate() - dow)
  return x
}
const endOfWeekMon = (d: Date) => addDays(startOfWeekMon(d), 6)

const startOfMonthLocal = (d: Date) => atNoon(new Date(d.getFullYear(), d.getMonth(), 1))
const endOfMonthLocal = (d: Date) => atNoon(new Date(d.getFullYear(), d.getMonth()+1, 0))

const getViewRange = (viewMode: 'daily'|'weekly'|'monthly') => {
  const today = atNoon(new Date())
  if (viewMode === 'daily')  return { viewStart: today, viewEnd: today }
  if (viewMode === 'weekly') return { viewStart: startOfWeekMon(today), viewEnd: endOfWeekMon(today) }
  return { viewStart: startOfMonthLocal(today), viewEnd: endOfMonthLocal(today) }
}

type OwnerScope = 'all' | 'mine' | 'others' | 'department'


const normalizeDateToMidnight = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);

const PRINT_STYLES = `
  :root { color-scheme: light; }
  @page { margin: 18mm; }
  body.gantt-export-print { margin: 0; font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; background: #f1f5f9; color: #0f172a; }
  .gantt-export-wrapper { padding: 16px 0 20px 0; }
  .gantt-export-preview { margin-top: 16px; }
  .gantt-export-root { width: 100%; margin: 0; }
  .gantt-export-card { background: #ffffff; border-radius: 18px; border: 1px solid #e2e8f0; box-shadow: 0 24px 48px -28px rgba(15, 23, 42, 0.35); padding: 24px 0 28px; }
  .gantt-export-header h3 { margin: 0; font-size: 20px; font-weight: 600; color: #0f172a; }
  .gantt-export-header p { margin: 6px 0 0; font-size: 13px; color: #475569; }
  .gantt-export-meta { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 14px; font-size: 12px; color: #64748b; }
  .gantt-export-meta span { display: inline-flex; align-items: center; gap: 6px; }
  .gantt-export-table-wrapper { margin: 22px 0 0 0; border-radius: 14px; border: 1px solid #e2e8f0; overflow: hidden; background: #ffffff; padding: 0 10px 0 4px; }
  .gantt-export-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  .gantt-export-table thead { background: #dbeafe; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em; font-size: 11px; }
  .gantt-export-table th { padding: 12px 14px; text-align: left; font-weight: 600; border-bottom: 1px solid #bfdbfe; }
  .gantt-export-col-task { width: 34%; }
  .gantt-export-col-assignee { width: 14%; }
  .gantt-export-table th.gantt-export-date { text-align: center; white-space: nowrap; }
  .gantt-export-date span { display: block; font-size: 10px; line-height: 1.2; }
  .gantt-export-table tbody tr:nth-child(even) { background: #f8fafc; }
  .gantt-export-table td { padding: 12px 14px; border-bottom: 1px solid #e2e8f0; vertical-align: middle; font-size: 12px; }
  .gantt-export-task { font-weight: 600; color: #0f172a; }
  .gantt-export-assignee { color: #475569; }
  .gantt-export-cell { text-align: center; }
  .gantt-export-cell-active { display: inline-flex; align-items: center; justify-content: center; height: 30px; width: 30px; border-radius: 8px; background: #dbeafe; border: 1px solid #93c5fd; color: #1d4ed8; font-weight: 600; }
  .gantt-export-cell-empty { color: #cbd5f5; font-size: 14px; }
  .gantt-export-empty { border: 1px dashed #cbd5f5; border-radius: 14px; background: #f8fafc; padding: 32px; text-align: center; font-size: 13px; color: #64748b; }
  .gantt-export-warning { border: 1px dashed #facc15; border-radius: 12px; background: #fef9c3; padding: 20px; font-size: 13px; color: #854d0e; text-align: center; }
  @media print { body.gantt-export-print { background: #ffffff; } .gantt-export-wrapper { padding: 0; } .gantt-export-card { box-shadow: none; border: none; } }
`;

const GanttPage = () => {
  const { profile, user } = useAuthContext()
  const router = useRouter()
  const [ganttTasks, setGanttTasks] = useState<GanttItem[]>([])
  const [filteredTasks, setFilteredTasks] = useState<GanttItem[]>([])
  const [localLoading, setLocalLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filtry i sortowanie
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearchTerm = useDebouncedValue(searchTerm, 250)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [dateFilter, setDateFilter] = useState<string>('all')
  const [ownerFilter, setOwnerFilter] = useState<OwnerScope>('all')
  const [sortBy, setSortBy] = useState<string>('startDate')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [hideCompleted, setHideCompleted] = useState(true)

  const ownerFilterOptions: { value: OwnerScope; label: string; disabled?: boolean }[] = [
    { value: 'all', label: 'Wszyscy użytkownicy' },
    { value: 'mine', label: 'Moje zadania' },
    { value: 'others', label: 'Innych użytkowników' },
    { value: 'department', label: 'Mój dział', disabled: !profile?.department_id },
  ]

  // Widok
  const [viewMode, setViewMode] = useState<'daily' | 'weekly' | 'monthly'>('weekly')

  // Edycja
  const [editingTask, setEditingTask] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<GanttItem>>({})
  const [users, setUsers] = useState<Array<{ id: string; full_name: string; department_id: number | null }>>([])
  const [loadingUsers, setLoadingUsers] = useState(false)

  // Nowe zadanie
  const UNASSIGNED = '__unassigned__'
  const [showNewTaskModal, setShowNewTaskModal] = useState(false)
  const [newTaskForm, setNewTaskForm] = useState<Partial<GanttItem>>({
    title: '',
    description: '',
    status: 'new',
    priority: 'medium',
    progress: 0,
    assignee: UNASSIGNED,   // zamiast '' - bezpieczna wartość
    assigneeId: undefined,
    startDate: new Date(),
    endDate: new Date(new Date().setDate(new Date().getDate() + 7))
  })

  const [showPdfExportModal, setShowPdfExportModal] = useState(false)
  const [pdfStartDate, setPdfStartDate] = useState<string>(toDateInputValue(new Date()))
  const [pdfError, setPdfError] = useState<string | null>(null)
  const pdfStartDateValue = useMemo(() => {
    if (!pdfStartDate) return null
    const parsed = new Date(`${pdfStartDate}T00:00:00`)
    if (Number.isNaN(parsed.getTime())) return null
    return normalizeDateToMidnight(parsed)
  }, [pdfStartDate])

  const pdfPreviewDates = useMemo(() => {
    if (!pdfStartDateValue) return []
    return Array.from({ length: 7 }, (_, index) => addDays(pdfStartDateValue, index))
  }, [pdfStartDateValue])

  const pdfTasksForExport = useMemo(() => {
    if (!pdfStartDateValue) return []
    const rangeEnd = addDays(pdfStartDateValue, 6)
    return filteredTasks
      .map(task => {
        const normalizedStart = normalizeDateToMidnight(task.startDate)
        const normalizedEnd = normalizeDateToMidnight(task.endDate ?? task.startDate)
        return { ...task, startDate: normalizedStart, endDate: normalizedEnd }
      })
      .filter(task => task.endDate >= pdfStartDateValue && task.startDate <= rangeEnd)
      .sort((a, b) => {
        const startDiff = a.startDate.getTime() - b.startDate.getTime()
        if (startDiff !== 0) return startDiff
        return (a.title || '').localeCompare(b.title || '')
      })
  }, [filteredTasks, pdfStartDateValue])

  const pdfRangeLabel = useMemo(() => {
    if (!pdfStartDateValue) return ''
    const rangeEnd = addDays(pdfStartDateValue, 6)
    return `${pdfStartDateValue.toLocaleDateString('pl-PL')} - ${rangeEnd.toLocaleDateString('pl-PL')}`
  }, [pdfStartDateValue])

  const previewRef = useRef<HTMLDivElement | null>(null)


  // ===== Nowe helpery dla zakresu widoku =====
  const atMidnight = (d: Date) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
  const startOfWeekMon = (d: Date) => { const x=atMidnight(d); const dow=(x.getDay()+6)%7; x.setDate(x.getDate()-dow); return x; };
  const endOfWeekMon   = (d: Date) => { const x=startOfWeekMon(d); x.setDate(x.getDate()+6); return atMidnight(x); };
  const startOfMonth   = (d: Date) => atMidnight(new Date(d.getFullYear(), d.getMonth(), 1));
  const endOfMonth     = (d: Date) => atMidnight(new Date(d.getFullYear(), d.getMonth()+1, 0));

  const getViewRange = (mode: 'daily'|'weekly'|'monthly') => {
    const today = atMidnight(new Date());
    if (mode === 'daily')  return { viewStart: today, viewEnd: today };
    if (mode === 'weekly') return { viewStart: startOfWeekMon(today), viewEnd: endOfWeekMon(today) };
    return { viewStart: startOfMonth(today), viewEnd: endOfMonth(today) };
  };

  // ===== Pobieranie danych (zależne od profilu!) =====
  const fetchData = useCallback(async () => {
    setLocalLoading(true)
    setError(null)

    try {
      let query = supabase
        .from('tasks_with_details')
        .select(`
          id,
          title,
          description,
          status,
          priority,
          start_date,
          due_date,
          created_at,
          updated_at,
          department_id,
          department_name,
          assigned_to,
          assigned_to_name
        `)
        .order('created_at', { ascending: false })

      // logika widoczności
      if (profile && (profile.role === 'superadmin' || profile.role === 'dyrektor')) {
        // wszystko
      } else if (profile?.role === 'kierownik' && profile.department_id) {
        query = query.eq('department_id', profile.department_id)
      } else if (profile?.role && profile.department_id) {
        query = query.eq('department_id', profile.department_id)
      }

      const { data: tasks, error: tasksError } = await query
      if (tasksError) {
        setError(`Błąd pobierania zadań: ${tasksError.message}`)
        setGanttTasks([])
        setFilteredTasks([])
        return
      }
      if (!tasks || tasks.length === 0) {
        setGanttTasks([])
        setFilteredTasks([])
        return
      }

      // ✅ KLUCZ: zmapuj daty na POŁUDNIE lokalne (stabilne dla Gantta)
      const ganttItems: GanttItem[] = tasks
        .map((task) => {
          if (!task.id) return null

          const startDate = fromDbToLocalNoon(task.start_date)
          let endDate   = fromDbToLocalNoon(task.due_date)

          // ✅ WALIDACJA/naprawa: end >= start
          if (endDate < startDate) {
            endDate = new Date(startDate)
            endDate.setDate(endDate.getDate() + 1)
          }

          return {
            id: task.id,
            title: task.title || 'Bez tytułu',
            startDate,
            endDate,
            progress:
              task.status === 'completed' ? 100 :
              task.status === 'in_progress' ? 50 : 0,
            status: (task.status as 'new' | 'in_progress' | 'completed' | 'cancelled') || 'new',
            priority: (task.priority as 'low' | 'medium' | 'high') || 'medium',
            assignee: task.assigned_to_name || 'Nieprzydzielone',
            assigneeId: task.assigned_to,
            description: task.description || undefined,
            department: task.department_name || undefined,
            department_id: task.department_id || undefined
          } as GanttItem
        })
        .filter((x): x is GanttItem => Boolean(x))

      setGanttTasks(ganttItems)
      setFilteredTasks(ganttItems)
    } catch (err) {
      setError(`Nieoczekiwany błąd: ${err}`)
    } finally {
      setLocalLoading(false)
    }
  }, [profile])

  const fetchUsers = useCallback(async () => {
    try {
      setLoadingUsers(true)
      const { data, error } = await supabase
        .from('users_with_details')
        .select('id, full_name, department_id')
        .order('full_name')
      if (!error && data) {
        setUsers(data.filter(u => u.id && u.full_name) as Array<{ id: string; full_name: string; department_id: number | null }>)
      }
    } finally {
      setLoadingUsers(false)
    }
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  // ✅ POPRAWIONE: Uruchom na starcie oraz gdy pojawi się/zmieni profil
  useEffect(() => { 
    if (profile) { // Tylko gdy mamy profil
      fetchData() 
    }
  }, [profile, fetchData])

  // Filtrowanie/sortowanie – liczone na znormalizowanych datach
  useEffect(() => {
    let filtered = [...ganttTasks]
    const currentUserId = profile?.id ?? user?.id ?? null
    const currentDepartmentId = profile?.department_id ?? null

    if (debouncedSearchTerm) {
      const q = debouncedSearchTerm.toLowerCase()
      filtered = filtered.filter(t =>
        t.title.toLowerCase().includes(q) ||
        (t.assignee && t.assignee.toLowerCase().includes(q))
      )
    }

    if (statusFilter !== 'all') filtered = filtered.filter(t => t.status === statusFilter)
    if (priorityFilter !== 'all') filtered = filtered.filter(t => t.priority === priorityFilter)

    if (hideCompleted) {
      filtered = filtered.filter(t => t.status !== 'completed')
    }

    if (ownerFilter === 'mine' && currentUserId) {
      filtered = filtered.filter(t => t.assigneeId === currentUserId)
    } else if (ownerFilter === 'others' && currentUserId) {
      filtered = filtered.filter(t => t.assigneeId && t.assigneeId !== currentUserId)
    } else if (ownerFilter === 'department' && currentDepartmentId) {
      filtered = filtered.filter(t => t.department_id === currentDepartmentId)
    }

    if (dateFilter !== 'all') {
      const today = startOfDayLocal(new Date())
      const todayEnd = endOfDayLocal(new Date())
      const tomorrowStart = startOfDayLocal(new Date(today.getTime() + 24 * 60 * 60 * 1000))
      const tomorrowEnd = endOfDayLocal(new Date(tomorrowStart))
      const weekEnd = endOfDayLocal(new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000))

      switch (dateFilter) {
        case 'today':
          filtered = filtered.filter(t => t.startDate <= todayEnd && t.endDate >= today)
          break
        case 'tomorrow':
          filtered = filtered.filter(t => t.startDate <= tomorrowEnd && t.endDate >= tomorrowStart)
          break
        case 'this_week':
          filtered = filtered.filter(t => t.startDate <= weekEnd && t.endDate >= today)
          break
        case 'overdue':
          filtered = filtered.filter(t => t.endDate < today && t.status !== 'completed')
          break
      }
    }

    filtered.sort((a, b) => {
      const mul = sortOrder === 'asc' ? 1 : -1
      switch (sortBy) {
        case 'title':
          return mul * a.title.localeCompare(b.title, 'pl')
        case 'startDate':
          return mul * (a.startDate.getTime() - b.startDate.getTime())
        case 'endDate':
          return mul * (a.endDate.getTime() - b.endDate.getTime())
        case 'priority': {
          const order = { high: 3, medium: 2, low: 1 } as const
          return mul * ((order[a.priority as keyof typeof order] ?? 0) - (order[b.priority as keyof typeof order] ?? 0))
        }
        case 'status': {
          const order = { new: 1, in_progress: 2, completed: 3, cancelled: 4 } as const
          return mul * ((order[a.status as keyof typeof order] ?? 0) - (order[b.status as keyof typeof order] ?? 0))
        }
        default:
          return mul * (a.startDate.getTime() - b.startDate.getTime())
      }
    })

    setFilteredTasks(filtered)
  }, [ganttTasks, debouncedSearchTerm, statusFilter, priorityFilter, dateFilter, ownerFilter, hideCompleted, sortBy, sortOrder, profile, user])

  // ===== Przygotowanie danych dla Gantta =====
  // Przekazujemy surowe daty - clamp i inclusive robi GanttChart
  const memoizedGanttItems = useMemo(() => filteredTasks, [filteredTasks])

  // Labelki/kolory
  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'new': return 'Nowe'
      case 'in_progress': return 'W trakcie'
      case 'completed': return 'Zakończone'
      case 'cancelled': return 'Anulowane'
      default: return status
    }
  }
  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'low': return 'Niskie'
      case 'medium': return 'Średnie'
      case 'high': return 'Wysokie'
      default: return priority
    }
  }
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-gray-100 text-gray-800 border-gray-200'
      case 'in_progress': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'completed': return 'bg-green-100 text-green-800 border-green-200'
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'low': return 'bg-green-100 text-green-800 border-green-200'
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'high': return 'bg-red-100 text-red-800 border-red-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  // Akcje
  const handleTaskClick = (task: GanttItem) => {
    if (task?.id) {
      router.push(`/dashboard/tasks/${task.id}`)
    }
  }

  const handleEditTask = (task: GanttItem) => {
    setEditingTask(task.id)
    setEditForm({
      ...task,
      assignee: task.assigneeId ?? UNASSIGNED,
      assigneeId: task.assigneeId ?? undefined,
    })
  }

  const handleSaveEdit = async () => {
    if (!editingTask) return
    try {
      // mapowanie użytkownika - zamień UNASSIGNED na null
      const assignedToId =
        editForm.assigneeId !== undefined
          ? (editForm.assigneeId === null ? null : editForm.assigneeId)
          : (editForm.assignee && editForm.assignee !== UNASSIGNED ? (editForm.assignee as string) : null)

      // W stanie trzymamy daty jako 12:00 lokalnie (patrz onChange inputów)
      const start = editForm.startDate || null
      const end   = editForm.endDate   || null

      // ✅ WALIDACJA: sprawdź czy end >= start
      if (start && end && end < start) {
        alert('Data zakończenia nie może być wcześniejsza niż data rozpoczęcia')
        return
      }

      const updateData: Partial<Database['public']['Tables']['tasks']['Update']> = {
        title: editForm.title,
        status: editForm.status,
        priority: editForm.priority,
        start_date: start ? toDbStartIso(start) : undefined,
        due_date:   end   ? toDbEndIso(end)     : undefined,
        description: editForm.description,
        assigned_to: assignedToId
      }

      // Usuń undefined wartości
      Object.keys(updateData).forEach(key => {
        if (updateData[key as keyof typeof updateData] === undefined) {
          delete updateData[key as keyof typeof updateData]
        }
      })

      const { error: updateError } = await supabase
        .from('tasks')
        .update(updateData)
        .eq('id', editingTask)

      if (updateError) {
        alert(`Błąd podczas zapisywania: ${updateError.message}`)
        return
      }

      // Odśwież dane z bazy
      await fetchData()
      setEditingTask(null)
      setEditForm({})
    } catch (error) {
      console.error('Błąd podczas zapisywania:', error)
      alert('Nieoczekiwany błąd podczas zapisywania')
    }
  }

  const handleDeleteTask = async (task: GanttItem) => {
    try {
      console.log('🗑️ Usuwam zadanie z bazy:', {
        id: task.id,
        title: task.title,
        idType: typeof task.id,
        idValue: task.id
      })
      
      // Sprawdź czy ID jest poprawne
      if (!task.id || task.id === 'undefined' || task.id === 'null') {
        console.error('❌ Nieprawidłowe ID zadania:', task.id)
        alert('Nieprawidłowe ID zadania. Nie można usunąć.')
        return
      }

      // Najpierw usuń powiązane rekordy z task_changes
      console.log('🔍 Usuwam powiązane rekordy z task_changes...')
      const { error: changesError } = await supabase
        .from('task_changes')
        .delete()
        .eq('task_id', task.id)

      if (changesError) {
        console.warn('⚠️ Błąd usuwania historii zmian:', changesError)
        // Kontynuuj mimo błędu - może tabela nie istnieje
      } else {
        console.log('✅ Historia zmian usunięta')
      }

      // Teraz usuń z bazy danych - spróbuj najpierw z tabeli tasks
      let { data, error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', task.id)
        .select() // Dodaj select() żeby zobaczyć co zostało usunięte

      // Jeśli nie ma błędu, ale też nie ma danych, spróbuj bez select()
      if (!error && (!data || data.length === 0)) {
        console.log('🔍 Próbuję usunąć bez select()...')
        const { error: deleteError } = await supabase
          .from('tasks')
          .delete()
          .eq('id', task.id)
        
        if (deleteError) {
          error = deleteError
        } else {
          // Ustaw dummy data żeby oznaczyć sukces
          data = [{ id: task.id }] as Database['public']['Tables']['tasks']['Row'][]
        }
      }

      console.log('🔍 Odpowiedź z bazy:', { data, error })

      if (error) {
        console.error('❌ Błąd usuwania zadania:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        })
        alert(`Błąd podczas usuwania zadania: ${error.message || 'Nieznany błąd'}`)
        return
      }

      // Sprawdź czy coś zostało usunięte
      if (!data || data.length === 0) {
        console.warn('⚠️ Nie usunięto żadnego zadania. Może ID nie istnieje?')
        alert('Zadanie nie zostało usunięte. Może zostało już usunięte lub ID jest nieprawidłowe.')
        return
      }

      console.log('✅ Zadanie usunięte z bazy:', {
        deletedTask: data[0],
        title: task.title
      })

      // Odśwież dane z bazy
      await fetchData()
      
    } catch (error) {
      console.error('🚨 Nieoczekiwany błąd podczas usuwania:', {
        error,
        errorType: typeof error,
        errorMessage: error instanceof Error ? error.message : 'Nieznany błąd',
        stack: error instanceof Error ? error.stack : undefined
      })
      alert('Nieoczekiwany błąd podczas usuwania zadania')
    }
  }

  // Funkcja usuwania dla tabeli (zachowuję dla kompatybilności)
  const handleDeleteTaskById = async (taskId: string) => {
    const task = ganttTasks.find(t => t.id === taskId)
    if (!task) return
    
    if (!confirm('Czy na pewno chcesz usunąć to zadanie?')) return
    
    await handleDeleteTask(task)
  }

  // ===== Funkcje dla nowego zadania =====
  const handleNewTask = () => {
    setShowNewTaskModal(true)
    setNewTaskForm({
      title: '',
      description: '',
      status: 'new',
      priority: 'medium',
      progress: 0,
      assignee: UNASSIGNED,   // zamiast '' - bezpieczna wartość
      startDate: new Date(),
      endDate: new Date(new Date().setDate(new Date().getDate() + 7))
    })
  }

  const handleSaveNewTask = async () => {
    if (!newTaskForm.title?.trim()) {
      alert('Tytuł zadania jest wymagany')
      return
    }

    if (newTaskForm.endDate && newTaskForm.startDate && newTaskForm.endDate < newTaskForm.startDate) {
      alert('Data zakończenia nie może być wcześniejsza niż data rozpoczęcia')
      return
    }

    try {
      // mapowanie użytkownika - zamień UNASSIGNED na null
      const assignedToId =
        newTaskForm.assigneeId !== undefined
          ? (newTaskForm.assigneeId === null ? null : newTaskForm.assigneeId)
          : (newTaskForm.assignee && newTaskForm.assignee !== UNASSIGNED
              ? (newTaskForm.assignee as string)
              : null)

      const insertData = {
        title: newTaskForm.title,
        description: newTaskForm.description || '',
        status: newTaskForm.status || 'new',
        priority: newTaskForm.priority || 'medium',
        start_date: newTaskForm.startDate ? toDbStartIso(newTaskForm.startDate) : null,
        due_date: newTaskForm.endDate ? toDbEndIso(newTaskForm.endDate) : null,
        assigned_to: assignedToId,
        department_id: profile?.department_id || null
      }

      const { error } = await supabase
        .from('tasks')
        .insert(insertData)

      if (error) {
        alert(`Błąd podczas tworzenia: ${error.message}`)
        return
      }

      // Odśwież dane z bazy
      await fetchData()
      setShowNewTaskModal(false)
      alert('Zadanie zostało utworzone')
    } catch (error) {
      console.error('Błąd podczas tworzenia zadania:', error)
      alert('Wystąpił błąd podczas tworzenia zadania')
    }
  }

  const handleCloseNewTaskModal = () => {
    if (newTaskForm.title || newTaskForm.description) {
      if (window.confirm('Masz niezapisane zmiany. Czy na pewno chcesz zamknąć bez zapisywania?')) {
        setShowNewTaskModal(false)
        setNewTaskForm({
          title: '',
          description: '',
          status: 'new',
          priority: 'medium',
          progress: 0,
          assignee: UNASSIGNED,   // zamiast '' - bezpieczna wartość
          assigneeId: undefined,
          startDate: new Date(),
          endDate: new Date(new Date().setDate(new Date().getDate() + 7))
        })
      }
    } else {
      setShowNewTaskModal(false)
    }
  }

  const openPdfExportModal = () => {
    setPdfStartDate(toDateInputValue(new Date()))
    setPdfError(null)
    setShowPdfExportModal(true)
  }

  const handlePdfDownload = () => {
    if (!pdfStartDateValue) {
      setPdfError('Wybierz datę początkową')
      return
    }

    if (pdfTasksForExport.length === 0) {
      setPdfError('Brak zadań w wybranym tygodniu.')
      return
    }

    const previewNode = previewRef.current
    if (!previewNode) {
      setPdfError('Podgląd nie jest jeszcze gotowy do wydruku.')
      return
    }

    setPdfError(null)

    const htmlContent = previewNode.outerHTML.trim()
    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.top = '0'
    iframe.style.left = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.opacity = '0'
    iframe.setAttribute('aria-hidden', 'true')
    iframe.srcdoc = `<!DOCTYPE html>
<html lang="pl">
<head>
<meta charSet="utf-8" />
<title>Lista zadań - Wykres Gantta</title>
<style>${PRINT_STYLES}</style>
</head>
<body class="gantt-export-print">${htmlContent}</body>
</html>`

    const cleanup = () => {
      iframe.removeEventListener('load', triggerPrint)
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe)
      }
    }

    const triggerPrint = () => {
      const printWindow = iframe.contentWindow
      if (!printWindow) {
        console.error('Nie udało się uzyskać kontekstu drukowania z iframe')
        cleanup()
        return
      }

      printWindow.focus()
      printWindow.print()
      printWindow.addEventListener('afterprint', () => cleanup(), { once: true })
      printWindow.setTimeout(() => cleanup(), 1500)
    }

    iframe.addEventListener('load', triggerPrint, { once: true })
    document.body.appendChild(iframe)
  }


  const handleExport = (format: 'pdf' | 'excel') => {
    if (format === 'pdf') {
      openPdfExportModal()
      return
    }

    console.log(`📤 Eksport ${format.toUpperCase()} nie jest jeszcze obsługiwany`)
  }

  const resetFilters = () => {
    setSearchTerm('')
    setStatusFilter('all')
    setPriorityFilter('all')
    setDateFilter('all')
    setOwnerFilter('all')
    setSortBy('startDate')
    setSortOrder('asc')
    setHideCompleted(false)
  }

  if (localLoading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-lg">Ładowanie danych...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Błąd</h1>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
        <button 
          onClick={() => fetchData()}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Spróbuj ponownie
        </button>
      </div>
    )
  }

  if (ganttTasks.length === 0) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Brak zadań</h1>
        <p>Nie znaleziono żadnych zadań w bazie danych.</p>
        <button 
          onClick={() => fetchData()}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Odśwież
        </button>
      </div>
    )
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Wykres Gantta</h1>
          <p className="text-gray-600 mt-1">
            {filteredTasks.length} z {ganttTasks.length} zadań
          </p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => fetchData()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Odśwież
          </Button>
          
          <Button variant="outline" onClick={() => handleExport('pdf')}>
            <Download className="h-4 w-4 mr-2" />
            PDF
          </Button>
          
          <Button variant="outline" onClick={() => handleExport('excel')}>
            <Download className="h-4 w-4 mr-2" />
            Excel
          </Button>
          
          <Button onClick={handleNewTask}>
            <Plus className="h-4 w-4 mr-2" />
            Nowe zadanie
          </Button>
        </div>
      </div>

      {/* Filtry i wyszukiwanie */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          {/* Wyszukiwanie */}
          <div className="lg:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Wyszukaj zadania..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Filtry */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Wszystkie statusy</SelectItem>
              <SelectItem value="new">Nowe</SelectItem>
              <SelectItem value="in_progress">W trakcie</SelectItem>
              <SelectItem value="completed">Zakończone</SelectItem>
              <SelectItem value="cancelled">Anulowane</SelectItem>
            </SelectContent>
          </Select>

          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Priorytet" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Wszystkie priorytety</SelectItem>
              <SelectItem value="low">Niskie</SelectItem>
              <SelectItem value="medium">Średnie</SelectItem>
              <SelectItem value="high">Wysokie</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2">
            <Checkbox
              id="hide-completed-gantt"
              checked={hideCompleted}
              onCheckedChange={(checked) => setHideCompleted(checked === true)}
            />
            <label htmlFor="hide-completed-gantt" className="text-sm text-gray-700">
              Ukryj zakończone
            </label>
          </div>

          <Select value={ownerFilter} onValueChange={(value) => setOwnerFilter(value as OwnerScope)}>
            <SelectTrigger>
              <SelectValue placeholder="Zakres" />
            </SelectTrigger>
            <SelectContent>
              {ownerFilterOptions.map(option => (
                <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Data" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Wszystkie daty</SelectItem>
              <SelectItem value="today">Dzisiaj</SelectItem>
              <SelectItem value="tomorrow">Jutro</SelectItem>
              <SelectItem value="this_week">Ten tydzień</SelectItem>
              <SelectItem value="overdue">Przeterminowane</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Sortowanie */}
        <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-200">
          <span className="text-sm text-gray-600">Sortuj według:</span>
          
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="startDate">Data rozpoczęcia</SelectItem>
              <SelectItem value="endDate">Data zakończenia</SelectItem>
              <SelectItem value="title">Tytuł</SelectItem>
              <SelectItem value="priority">Priorytet</SelectItem>
              <SelectItem value="status">Status</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
          >
            {sortOrder === 'asc' ? '↑ Rosnąco' : '↓ Malejąco'}
          </Button>

          <Button variant="outline" size="sm" onClick={resetFilters}>
            <Filter className="h-4 w-4 mr-2" />
            Resetuj filtry
          </Button>
        </div>
      </div>

      {/* Widoki */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm text-gray-600">Widok:</span>
        <Button
          variant={viewMode === 'daily' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setViewMode('daily')}
        >
          Dzienny
        </Button>
        <Button
          variant={viewMode === 'weekly' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setViewMode('weekly')}
        >
          Tygodniowy
        </Button>
        <Button
          variant={viewMode === 'monthly' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setViewMode('monthly')}
        >
          Miesięczny
        </Button>
      </div>

      {/* Wykres Gantta */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <GanttChart 
          items={memoizedGanttItems}
          range={{ start: getViewRange(viewMode).viewStart, end: getViewRange(viewMode).viewEnd }}
          onBarClick={handleTaskClick}
          onItemDelete={handleDeleteTask}
          canDelete={profile?.role === 'superadmin' || profile?.role === 'dyrektor'}
          onItemUpdate={async (updatedItem: GanttItem) => {
            console.log('💾 Aktualizacja zadania:', updatedItem)
            
            try {
              // Znajdź oryginalne zadanie
              const originalTask = ganttTasks.find(t => t.id === updatedItem.id)
              if (!originalTask) {
                console.log('❌ Nie znaleziono oryginalnego zadania')
                return
              }

              // Przygotuj dane do aktualizacji
              const updateData: Partial<Database['public']['Tables']['tasks']['Update']> = {}
              
              if (updatedItem.status !== originalTask.status) {
                updateData.status = updatedItem.status
              }
              
              if (updatedItem.priority !== originalTask.priority) {
                updateData.priority = updatedItem.priority
              }

              // Sprawdź postęp - konwertuj z GanttItem na format bazy danych
              if (updatedItem.progress !== undefined) {
                const newProgress = updatedItem.progress
                const currentProgress = originalTask.status === 'completed' ? 100 : 
                                      originalTask.status === 'in_progress' ? 50 : 0
                
                if (newProgress !== currentProgress) {
                  // Aktualizuj status na podstawie postępu
                  if (newProgress === 100) {
                    updateData.status = 'completed'
                  } else if (newProgress === 0) {
                    updateData.status = 'new'
                  } else if (newProgress > 0 && newProgress < 100) {
                    updateData.status = 'in_progress'
                  }
                }
              }

              // Sprawdź osobę przypisaną
              if (updatedItem.assignee !== originalTask.assignee) {
                // Znajdź ID użytkownika na podstawie nazwy
                const user = ganttTasks.find(task => 
                  task.department_id === originalTask.department_id && 
                  task.assignee === updatedItem.assignee
                )
                
                if (user) {
                  // Jeśli znaleziono użytkownika z tego samego działu, zaktualizuj assigned_to
                  // Na razie zapiszemy w description, ale w przyszłości możemy dodać pole assigned_to
                  updateData.description = updatedItem.assignee
                } else {
                  // Jeśli nie znaleziono, zapisz w description
                  updateData.description = updatedItem.assignee || null
                }
              }

              // Sprawdź opis
              if (updatedItem.description !== originalTask.description) {
                updateData.description = updatedItem.description
              }

              // Jeśli nie ma zmian, nie rób nic
              if (Object.keys(updateData).length === 0) {
                console.log('ℹ️ Brak zmian do zapisania')
                return
              }

              console.log('🔄 Aktualizuję zadanie w bazie:', updatedItem.title)
              console.log('📊 Oryginalne dane:', {
                status: originalTask.status,
                priority: originalTask.priority,
                description: originalTask.description
              })
              console.log('📝 Nowe dane:', updateData)

              // Aktualizuj w bazie danych
              const { error } = await supabase
                .from('tasks')
                .update(updateData)
                .eq('id', updatedItem.id)

              if (error) {
                console.error('❌ Błąd aktualizacji zadania:', error)
                return
              }

              // Odśwież dane z bazy
              await fetchData()
              
              console.log('✅ Zadanie zaktualizowane w bazie:', updatedItem.title)
            } catch (error) {
              console.error('❌ Błąd podczas aktualizacji zadania:', error)
            }
          }}
        />
      </div>

      {/* Lista zadań (alternatywny widok) */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Lista zadań</h2>
          <Button onClick={handleNewTask} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Nowe zadanie
          </Button>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Zadanie
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Priorytet
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Przypisane
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Data rozpoczęcia
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Data zakończenia
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Akcje
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredTasks.map((task) => (
                  <tr key={task.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4 align-top">
                      <div className="text-sm font-medium text-gray-900 line-clamp-2 max-w-xs sm:max-w-sm">
                        {editingTask === task.id ? (
                          <Input
                            value={editForm.title || task.title}
                            onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                            className="w-full"
                          />
                        ) : (
                          task.title
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      {editingTask === task.id ? (
                        <Select
                          value={editForm.status || task.status}
                          onValueChange={(value) => setEditForm(prev => ({ ...prev, status: value as 'new' | 'in_progress' | 'completed' | 'cancelled' }))}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="new">Nowe</SelectItem>
                            <SelectItem value="in_progress">W trakcie</SelectItem>
                            <SelectItem value="completed">Zakończone</SelectItem>
                            <SelectItem value="cancelled">Anulowane</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge className={getStatusColor(task.status)}>
                          {getStatusLabel(task.status)}
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      {editingTask === task.id ? (
                        <Select
                          value={editForm.priority || task.priority}
                          onValueChange={(value) => setEditForm(prev => ({ ...prev, priority: value as 'low' | 'medium' | 'high' }))}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Niskie</SelectItem>
                            <SelectItem value="medium">Średnie</SelectItem>
                            <SelectItem value="high">Wysokie</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge className={getPriorityColor(task.priority)}>
                          {getPriorityLabel(task.priority)}
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                      {editingTask === task.id ? (
                        <Select
                          value={
                            (editForm.assigneeId !== undefined
                              ? (editForm.assigneeId ?? UNASSIGNED)
                              : (typeof editForm.assignee === 'string' && editForm.assignee !== ''
                                  ? editForm.assignee
                                  : task.assigneeId ?? UNASSIGNED))
                          }
                          onValueChange={(value) =>
                            setEditForm(prev => ({
                              ...prev,
                              assignee: value,
                              assigneeId: value === UNASSIGNED ? undefined : value,
                            }))
                          }
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue placeholder="Wybierz osobę" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={UNASSIGNED}>Nieprzydzielone</SelectItem>
                            {users
                              .filter(u => u.id && u.full_name)               // odfiltruj puste
                              .map((u) => (
                                <SelectItem key={u.id} value={u.id}>          {/* value NIE może być '' */}
                                  {u.full_name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        task.assignee || 'Nieprzydzielone'
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                      {editingTask === task.id ? (
                        <Input
                          type="date"
                          value={editForm.startDate ? toDateInputValue(editForm.startDate) : toDateInputValue(task.startDate)}
                          onChange={(e) => {
                            const date = new Date(e.target.value + 'T12:00:00')
                            setEditForm(prev => ({ ...prev, startDate: date }))
                          }}
                          className="w-32"
                        />
                      ) : (
                        task.startDate.toLocaleDateString('pl-PL')
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                      {editingTask === task.id ? (
                        <Input
                          type="date"
                          value={editForm.endDate ? toDateInputValue(editForm.endDate) : toDateInputValue(task.endDate)}
                          onChange={(e) => {
                            const date = new Date(e.target.value + 'T12:00:00')
                            setEditForm(prev => ({ ...prev, endDate: date }))
                          }}
                          className="w-32"
                        />
                      ) : (
                        task.endDate.toLocaleDateString('pl-PL')
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                      {editingTask === task.id ? (
                        <div className="flex gap-2">
                          <Button size="sm" onClick={handleSaveEdit}>
                            Zapisz
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingTask(null)
                              setEditForm({})
                            }}
                          >
                            Anuluj
                          </Button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditTask(task)}
                          >
                            Edytuj
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteTaskById(task.id)}
                          >
                            Usuń
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showPdfExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6 space-y-4">
              <h2 className="text-xl font-semibold text-gray-900">Eksport do PDF</h2>
              <p className="text-sm text-gray-600">Wybierz dzień początkowy. Raport obejmie 7 kolejnych dni.</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="pdfStartDate">Początek zakresu</label>
                <Input
                  id="pdfStartDate"
                  type="date"
                  value={pdfStartDate}
                  onChange={(event) => {
                    setPdfStartDate(event.target.value)
                    setPdfError(null)
                  }}
                />
              </div>
              {pdfError && (
                <div className="text-sm text-red-600">{pdfError}</div>
              )}
              <div className="pt-1">
                <div className="gantt-preview-styles"><style>{PRINT_STYLES}</style></div>
                {pdfStartDateValue ? (
                  pdfTasksForExport.length > 0 ? (
                    <div className="gantt-export-preview -mx-6">
                      <div ref={previewRef} className="gantt-export-wrapper">
                        <div className="gantt-export-root">
                          <div className="gantt-export-card">
                            <div className="gantt-export-header">
                              <h3>Lista zadań - Wykres Gantta</h3>
                              <p>Zakres: {pdfRangeLabel}</p>
                            </div>
                            <div className="gantt-export-meta">
                              <span><strong>{pdfTasksForExport.length}</strong> zadań</span>
                              <span><strong>{pdfPreviewDates.length}</strong> dni</span>
                            </div>
                            <div className="gantt-export-table-wrapper">
                              <table className="gantt-export-table">
                                <thead>
                                  <tr>
                                    <th className="gantt-export-col-task">Zadanie</th>
                                    <th className="gantt-export-col-assignee">Przypisany</th>
                                    {pdfPreviewDates.map((date) => (
                                      <th key={date.getTime()} className="gantt-export-date">
                                        <span>{date.toLocaleDateString('pl-PL', { weekday: 'short' })}</span>
                                        <span>{date.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' })}</span>
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {pdfTasksForExport.map((task) => (
                                    <tr key={task.id}>
                                      <td className="gantt-export-task">{task.title || 'Brak tytułu'}</td>
                                      <td className="gantt-export-assignee">{task.assignee || 'Brak'}</td>
                                      {pdfPreviewDates.map((date) => {
                                        const isActive = task.startDate <= date && task.endDate >= date
                                        return (
                                          <td key={`${task.id}-${date.getTime()}`} className="gantt-export-cell">
                                            {isActive ? (
                                              <span className="gantt-export-cell-active">X</span>
                                            ) : (
                                              <span className="gantt-export-cell-empty">–</span>
                                            )}
                                          </td>
                                        )
                                      })}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="gantt-export-empty">Brak zadań w wybranym tygodniu. Zmień datę początkową, aby zobaczyć podgląd.</div>
                  )
                ) : (
                  <div className="gantt-export-warning">Wprowadź poprawną datę, aby zobaczyć podgląd.</div>
                )}
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowPdfExportModal(false)
                    setPdfError(null)
                  }}
                >
                  Anuluj
                </Button>
                <Button onClick={handlePdfDownload}>
                  Pobierz PDF
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal do tworzenia nowego zadania */}
      {showNewTaskModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900">Nowe zadanie</h2>
                <button
                  onClick={handleCloseNewTaskModal}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left column */}
                <div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Tytuł *</label>
                    <Input
                      value={newTaskForm.title || ''}
                      onChange={(e) => setNewTaskForm(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Wprowadź tytuł zadania"
                      className="w-full"
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                    <select
                      value={newTaskForm.status || 'new'}
                      onChange={(e) => setNewTaskForm(prev => ({ ...prev, status: e.target.value as GanttItem['status'] }))}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="new">Nowe</option>
                      <option value="in_progress">W trakcie</option>
                      <option value="completed">Zakończone</option>
                      <option value="cancelled">Anulowane</option>
                    </select>
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Priorytet</label>
                    <select
                      value={newTaskForm.priority || 'medium'}
                      onChange={(e) => setNewTaskForm(prev => ({ ...prev, priority: e.target.value as GanttItem['priority'] }))}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="low">Niskie</option>
                      <option value="medium">Średnie</option>
                      <option value="high">Wysokie</option>
                    </select>
                  </div>
                </div>

                {/* Right column */}
                <div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Data rozpoczęcia</label>
                    <Input
                      type="date"
                      value={newTaskForm.startDate ? toDateInputValue(newTaskForm.startDate) : ''}
                      onChange={(e) => {
                        const date = new Date(e.target.value + 'T12:00:00')
                        setNewTaskForm(prev => ({ ...prev, startDate: date }))
                      }}
                      className="w-full"
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Data zakończenia</label>
                    <Input
                      type="date"
                      value={newTaskForm.endDate ? toDateInputValue(newTaskForm.endDate) : ''}
                      onChange={(e) => {
                        const date = new Date(e.target.value + 'T12:00:00')
                        setNewTaskForm(prev => ({ ...prev, endDate: date }))
                      }}
                      className="w-full"
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Przypisane do</label>
                    <Select
                      value={(newTaskForm.assignee as string) ?? UNASSIGNED}
                      onValueChange={(value) =>
                        setNewTaskForm(prev => ({
                          ...prev,
                          assignee: value,
                          assigneeId: value === UNASSIGNED ? undefined : value,
                        }))
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Wybierz osobę" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={UNASSIGNED}>Nieprzydzielone</SelectItem>
                        {users
                          .filter(u => u.id && u.full_name)               // odfiltruj puste
                          .map((u) => (
                            <SelectItem key={u.id} value={u.id}>          {/* value NIE może być '' */}
                              {u.full_name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Opis</label>
                <textarea
                  value={newTaskForm.description || ''}
                  onChange={(e) => setNewTaskForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Wprowadź opis zadania (opcjonalnie)"
                  rows={3}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Buttons */}
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={handleCloseNewTaskModal}>
                  Anuluj
                </Button>
                <Button onClick={handleSaveNewTask}>
                  Utwórz zadanie
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Opakuj w React.memo żeby zapobiec niepotrzebnym re-renderom
export default React.memo(GanttPage)
