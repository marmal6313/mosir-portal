'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { TableVirtuoso, type TableComponents } from 'react-virtuoso'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { 
  getStatusColor, getStatusLabel, getPriorityColor, getPriorityLabel,
  STATUS_ORDER, PRIORITY_ORDER, formatDbDate, timeForSort
} from '@/lib/tasks-utils'

import { 
  X, 
  Filter, 
  Search, 
  CheckCircle2, 
  Circle, 
  PlayCircle,
  Target,
  FilterX,
  Plus,
  GanttChart,
  Eye
} from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

type TaskWithDetails = Database['public']['Views']['tasks_with_details']['Row']

type OwnerScope = 'all' | 'mine' | 'others' | 'department'

type FilterOptions = {
  status: string
  priority: string
  department: string
  owner: OwnerScope
  showCompleted: boolean
}

type SortOption = 'created_at' | 'due_date' | 'priority' | 'status'
type SortDirection = 'asc' | 'desc'

export default function DashboardTaskList() {
  const router = useRouter()
  const [tasks, setTasks] = useState<TaskWithDetails[]>([])
  const [filteredTasks, setFilteredTasks] = useState<TaskWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingTasks, setUpdatingTasks] = useState<Set<string>>(new Set())
  const [filters, setFilters] = useState<FilterOptions>({
    status: 'all',
    priority: 'all',
    department: 'all',
    owner: 'all',
    showCompleted: true
  })
  const [departments, setDepartments] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 250)
  const [sortBy, setSortBy] = useState<SortOption>('created_at')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set())
  const [showFilters, setShowFilters] = useState(false)
  const [userProfile, setUserProfile] = useState<Database['public']['Views']['users_with_details']['Row'] | null>(null)

  // domyślne wartości do „czystego" URL
  const DEFAULTS = {
    status: 'all',
    priority: 'all',
    department: 'all',
    owner: 'all' as OwnerScope,
    showCompleted: true,
    sortBy: 'created_at' as SortOption,
    sortDirection: 'desc' as SortDirection,
    q: '',
  }

  const routerNext = useRouter()
  const searchParams = useSearchParams()
  const [urlHydrated, setUrlHydrated] = useState(false)
  const pathname = usePathname()
  const [hydrated, setHydrated] = useState(false) // żeby nie nadpisywać stanu zanim nie wczytamy URL

  // ===== Wirtualizacja - zakres widocznych wierszy =====
  const [visibleRange, setVisibleRange] = useState<{ startIndex: number; endIndex: number }>({ startIndex: 0, endIndex: -1 })

  // pomocniczo: ID widocznych wierszy
  const visibleIds = useMemo(() => {
    if (!filteredTasks.length || visibleRange.endIndex < visibleRange.startIndex) return []
    return filteredTasks
      .slice(visibleRange.startIndex, visibleRange.endIndex + 1)
      .map((t) => t.id!)
      .filter(Boolean)
  }, [filteredTasks, visibleRange])

  // stan checkboxa w nagłówku dla "widocznych"
  const allVisibleSelected = useMemo(() => (
    visibleIds.length > 0 && visibleIds.every((id) => selectedTasks.has(id))
  ), [visibleIds, selectedTasks])

  const someVisibleSelected = useMemo(() => (
    visibleIds.some((id) => selectedTasks.has(id)) && !allVisibleSelected
  ), [visibleIds, selectedTasks, allVisibleSelected])

  // akcje na widocznych
  const selectVisible = useCallback(() => {
    if (!visibleIds.length) return
    setSelectedTasks(prev => new Set([...prev, ...visibleIds]))
  }, [visibleIds])

  const unselectVisible = useCallback(() => {
    if (!visibleIds.length) return
    setSelectedTasks(prev => {
      const next = new Set(prev)
      visibleIds.forEach(id => next.delete(id))
      return next
    })
  }, [visibleIds])

  // ===== Helpery selekcji =====
  // ID-y zadań w aktualnie przefiltrowanej liście (ignorujemy null)
  const filteredIds = useMemo(
    () => filteredTasks.map(t => t.id).filter((v): v is string => !!v),
    [filteredTasks]
  )

  // Ilu z przefiltrowanych jest zaznaczonych
  const selectedCountInFiltered = useMemo(
    () => filteredIds.reduce((acc: number, id: string) => acc + (selectedTasks.has(id) ? 1 : 0), 0),
    [filteredIds, selectedTasks]
  )

  // Stan checkboxa w headerze: false / true / 'indeterminate'
  const headerCheckboxState: boolean | 'indeterminate' =
    selectedCountInFiltered === 0
      ? false
      : selectedCountInFiltered === filteredIds.length
      ? true
      : 'indeterminate'

  // Zaznacz/odznacz wszystkie w AKTUALNYM filtrze
  const toggleSelectAllFiltered = (checked: boolean) => {
    setSelectedTasks(prev => {
      if (checked) {
        const next = new Set(prev)
        filteredIds.forEach(id => next.add(id))
        return next
      } else {
        const next = new Set(prev)
        filteredIds.forEach(id => next.delete(id))
        return next
      }
    })
  }

  // Zaznacz/odznacz pojedynczy wiersz
  const toggleSelectOne = (id: string, checked: boolean) => {
    setSelectedTasks(prev => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  // ===== Opcje – te same etykiety co w Gantcie =====

  // ===== Wczytywanie stanu z URL =====
  useEffect(() => {
    const sp = searchParams
    // filtry
    const st = sp.get('st') || 'all'
    const pr = sp.get('pr') || 'all'
    const dept = sp.get('dept') || 'all'
    const own = (sp.get('own') as OwnerScope) || 'all'
    const show = sp.get('show') !== '0' // domyślnie true

    setFilters({ status: st, priority: pr, department: dept, owner: own, showCompleted: show })

    // wyszukiwarka
    const q = sp.get('q') || ''
    setSearchQuery(q)

    // sortowanie
    const s = (sp.get('sort') as SortOption) || 'created_at'
    const d = (sp.get('dir') as SortDirection) || 'desc'
    setSortBy(s)
    setSortDirection(d)

    // zaznaczenia (limit do 100)
    const sel = sp.get('sel')
    if (sel) {
      const ids = sel.split(',').filter(Boolean).slice(0, 100)
      setSelectedTasks(new Set(ids))
    }

    setHydrated(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const STATUS_OPTIONS = [
    { value: 'all',         label: 'Wszystkie statusy' },
    { value: 'new',         label: 'Nowe' },
    { value: 'in_progress', label: 'W trakcie' },
    { value: 'completed',   label: 'Zakończone' },
    { value: 'cancelled',   label: 'Anulowane' },
  ] as const

  const PRIORITY_OPTIONS = [
    { value: 'all',    label: 'Wszystkie priorytety' },
    { value: 'low',    label: 'Niskie' },
    { value: 'medium', label: 'Średnie' },
    { value: 'high',   label: 'Wysokie' },
  ] as const

  const SORT_OPTIONS: { value: SortOption; label: string }[] = [
    { value: 'created_at', label: 'Data utworzenia' },
    { value: 'due_date',   label: 'Termin' },
    { value: 'priority',   label: 'Priorytet' },
    { value: 'status',     label: 'Status' },
  ]

  const OWNER_FILTER_OPTIONS: { value: OwnerScope; label: string; disabled?: boolean }[] = [
    { value: 'all', label: 'Wszyscy użytkownicy' },
    { value: 'mine', label: 'Moje zadania' },
    { value: 'others', label: 'Innych użytkowników' },
    { value: 'department', label: 'Mój dział', disabled: !userProfile?.department_id },
  ]

  const resetFilters = () => {
    setFilters({ status: 'all', priority: 'all', department: 'all', owner: 'all', showCompleted: true })
    setSearchQuery('')
    setSortBy('created_at')
    setSortDirection('desc')
  }




  const fetchDashboardData = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    
    const { data: profile } = await supabase
      .from('users_with_details')
      .select('*')
      .eq('id', user.id)
      .single()
    
    setUserProfile(profile)
    
    let query = supabase
      .from('tasks_with_details')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (profile?.role === 'kierownik' && profile.department_id) {
      query = query.eq('department_id', profile.department_id)
    } else if (profile?.role !== 'dyrektor') {
      if (profile?.department_id) {
        query = query.or(`department_id.eq.${profile.department_id},assigned_to.eq.${user.id}`)
      } else {
        query = query.eq('assigned_to', user.id)
      }
    }
    
    const { data: tasksData } = await query
    setTasks(tasksData || [])
    
    if (tasksData) {
      const uniqueDepartments = [...new Set(
        (tasksData ?? [])
          .map(t => t.department_name?.trim())
          .filter((v): v is string => !!v)
      )]
      setDepartments(uniqueDepartments)
    }
    
    setLoading(false)
  }, [])

  const applyFiltersAndSort = useCallback(() => {
    let filtered = [...tasks]
    
    // Wyszukiwanie
    if (debouncedSearchQuery) {
      const q = debouncedSearchQuery.toLowerCase()
      filtered = filtered.filter(t => 
        (t.title ?? '').toLowerCase().includes(q) ||
        (t.department_name ?? '').toLowerCase().includes(q) ||
        (t.assigned_to_name ?? '').toLowerCase().includes(q)
      )
    }
    
    // Filtry
    if (filters.status !== 'all') {
      filtered = filtered.filter(task => task.status === filters.status)
    }
    
    if (filters.priority !== 'all') {
      filtered = filtered.filter(task => task.priority === filters.priority)
    }
    
    if (filters.department !== 'all') {
      filtered = filtered.filter(task => task.department_name === filters.department)
    }
    
    // Filtr zadań zakończonych
    if (!filters.showCompleted) {
      filtered = filtered.filter(task => task.status !== 'completed')
    }

    if (filters.owner === 'mine' && userProfile?.id) {
      filtered = filtered.filter(task => task.assigned_to === userProfile.id)
    } else if (filters.owner === 'others' && userProfile?.id) {
      filtered = filtered.filter(task => task.assigned_to && task.assigned_to !== userProfile.id)
    } else if (filters.owner === 'department' && userProfile?.department_id) {
      filtered = filtered.filter(task => task.department_id === userProfile.department_id)
    }
    
    // Sortowanie
    filtered.sort((a, b) => {
      if (sortBy === 'due_date' || sortBy === 'created_at') {
        const aT = timeForSort(a[sortBy] as string | null)
        const bT = timeForSort(b[sortBy] as string | null)
        return sortDirection === 'asc' ? aT - bT : bT - aT
      }

      if (sortBy === 'priority') {
        const aV = PRIORITY_ORDER[(a.priority || 'low') as keyof typeof PRIORITY_ORDER] ?? 0
        const bV = PRIORITY_ORDER[(b.priority || 'low') as keyof typeof PRIORITY_ORDER] ?? 0
        return sortDirection === 'asc' ? aV - bV : bV - aV
      }

      if (sortBy === 'status') {
        const aV = STATUS_ORDER[(a.status || 'new') as keyof typeof STATUS_ORDER] ?? 0
        const bV = STATUS_ORDER[(b.status || 'new') as keyof typeof STATUS_ORDER] ?? 0
        return sortDirection === 'asc' ? aV - bV : bV - aV
      }

      // fallback: string/number
      const aV = (a[sortBy] as string | number | null) ?? ''
      const bV = (b[sortBy] as string | number | null) ?? ''
      return sortDirection === 'asc'
        ? (aV > bV ? 1 : aV < bV ? -1 : 0)
        : (aV < bV ? 1 : aV > bV ? -1 : 0)
    })
    
    setFilteredTasks(filtered)
  }, [tasks, filters, debouncedSearchQuery, sortBy, sortDirection, userProfile])

  // Zapis do URL gdy stan się zmieni (z użyciem debouncedSearchQuery)
  useEffect(() => {
    if (!urlHydrated) return
    const params = new URLSearchParams()

    if (debouncedSearchQuery && debouncedSearchQuery !== DEFAULTS.q) params.set('q', debouncedSearchQuery)
    if (filters.status !== DEFAULTS.status) params.set('status', filters.status)
    if (filters.priority !== DEFAULTS.priority) params.set('priority', filters.priority)
    if (filters.department !== DEFAULTS.department) params.set('department', filters.department)
    if (filters.owner !== DEFAULTS.owner) params.set('owner', filters.owner)
    if (filters.showCompleted !== DEFAULTS.showCompleted) params.set('sc', filters.showCompleted ? '1' : '0')
    if (sortBy !== DEFAULTS.sortBy) params.set('sortBy', sortBy)
    if (sortDirection !== DEFAULTS.sortDirection) params.set('sortDir', sortDirection)

    const qs = params.toString()
    // replace — bez przeładowania historii
    routerNext.replace(qs ? `?${qs}` : '?', { scroll: false })
  }, [debouncedSearchQuery, filters, sortBy, sortDirection, urlHydrated, routerNext])

  // ===== Zapisywanie stanu do URL (nowe parametry) =====
  useEffect(() => {
    if (!hydrated) return

    const p = new URLSearchParams()

    // filtry
    p.set('st', filters.status)
    p.set('pr', filters.priority)
    p.set('dept', filters.department)
    p.set('own', filters.owner)
    p.set('show', filters.showCompleted ? '1' : '0')

    // wyszukiwarka (nie wrzucaj pustego q)
    if (debouncedSearchQuery && debouncedSearchQuery.trim()) {
      p.set('q', debouncedSearchQuery.trim())
    }

    // sort
    p.set('sort', sortBy)
    p.set('dir', sortDirection)

    // zaznaczenia (limit)
    if (selectedTasks.size > 0) {
      const ids = Array.from(selectedTasks).slice(0, 100)
      p.set('sel', ids.join(','))
    }

    routerNext.replace(`${pathname}?${p.toString()}`, { scroll: false })
  }, [
    hydrated,
    filters.status,
    filters.priority,
    filters.department,
    filters.owner,
    filters.showCompleted,
    debouncedSearchQuery,
    sortBy,
    sortDirection,
    selectedTasks,
    pathname,
    routerNext
  ])

  useEffect(() => {
    fetchDashboardData()
  }, [fetchDashboardData])

  // Odczyt z URL na start / przy zmianie URL
  useEffect(() => {
    // podczas pierwszego wejścia odczytaj parametry i ustaw stan
    if (urlHydrated) return

    const getBool = (v: string | null, def: boolean) => (v === null ? def : v === '1' || v === 'true')
    const sp = searchParams
    const parsed = {
      status: sp.get('status') ?? DEFAULTS.status,
      priority: sp.get('priority') ?? DEFAULTS.priority,
      department: sp.get('department') ?? DEFAULTS.department,
      owner: (sp.get('owner') as OwnerScope) ?? DEFAULTS.owner,
      showCompleted: getBool(sp.get('sc'), DEFAULTS.showCompleted),
      sortBy: (sp.get('sortBy') as SortOption) ?? DEFAULTS.sortBy,
      sortDirection: (sp.get('sortDir') as SortDirection) ?? DEFAULTS.sortDirection,
      q: sp.get('q') ?? DEFAULTS.q,
    }

    setFilters(prev => ({
      ...prev,
      status: parsed.status,
      priority: parsed.priority,
      department: parsed.department,
      owner: parsed.owner,
      showCompleted: parsed.showCompleted
    }))
    setSortBy(parsed.sortBy)
    setSortDirection(parsed.sortDirection)
    setSearchQuery(parsed.q)

    setUrlHydrated(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  useEffect(() => {
    applyFiltersAndSort()
  }, [applyFiltersAndSort])

  const handleTaskClick = (taskId: string | null) => {
    if (taskId) {
      router.push(`/dashboard/tasks/${taskId}`)
    }
  }

  const isInteractiveElement = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false
    return Boolean(target.closest('button, a, input, [role="checkbox"], [data-prevent-row-click]'))
  }

  // ===== Komponenty tabeli dla TableVirtuoso =====
  const tableComponents: TableComponents<TaskWithDetails> = {
    Table: (props) => (
      <table {...props} className="w-full">
        {props.children}
      </table>
    ),
    TableHead: (props) => <thead className="bg-gray-50" {...props} />,
    TableRow: ({ item, children, ...props }) => (
      <tr
        {...props}
        className="hover:bg-gray-50 cursor-pointer"
        tabIndex={0}
        onClick={(event) => {
          if (isInteractiveElement(event.target)) return
          handleTaskClick(item.id ?? null)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            handleTaskClick(item.id ?? null)
          }
        }}
      >
        {children}
      </tr>
    ),
    TableBody: (props) => <tbody className="bg-white divide-y divide-gray-200" {...props} />,
  }

  const handleTaskCompletion = async (taskId: string | null, isCompleted: boolean) => {
    if (!taskId) return
    
    setUpdatingTasks(prev => new Set(prev).add(taskId))
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase
        .from('tasks')
        .update({ 
          status: isCompleted ? 'completed' : 'in_progress',
          updated_at: new Date().toISOString()
        })
        .eq('id', taskId)

      if (error) {
        console.error('Błąd podczas aktualizacji zadania:', error)
        return
      }

      setTasks(prevTasks => 
        prevTasks.map(task => 
          task.id === taskId 
            ? { ...task, status: isCompleted ? 'completed' : 'in_progress' }
            : task
        )
      )
    } catch (error) {
      console.error('Błąd podczas aktualizacji zadania:', error)
    } finally {
      setUpdatingTasks(prev => {
        const newSet = new Set(prev)
        newSet.delete(taskId)
        return newSet
      })
    }
  }

  const handleBulkAction = async (action: 'complete' | 'delete') => {
    if (selectedTasks.size === 0) return
    
    setUpdatingTasks(prev => new Set([...prev, ...selectedTasks]))
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      if (action === 'complete') {
        const { error } = await supabase
          .from('tasks')
          .update({ 
            status: 'completed',
            updated_at: new Date().toISOString()
          })
          .in('id', Array.from(selectedTasks))

        if (error) {
          console.error('Błąd podczas masowej aktualizacji zadań:', error)
          return
        }

        setTasks(prevTasks => 
          prevTasks.map(task => 
            selectedTasks.has(task.id || '') 
              ? { ...task, status: 'completed' }
              : task
          )
        )
      } else if (action === 'delete') {
        const { error } = await supabase
          .from('tasks')
          .delete()
          .in('id', Array.from(selectedTasks))

        if (error) {
          console.error('Błąd podczas usuwania zadań:', error)
          return
        }

        setTasks(prevTasks => 
          prevTasks.filter(task => !selectedTasks.has(task.id || ''))
        )
      }
      
      setSelectedTasks(new Set())
    } catch (error) {
      console.error('Błąd podczas masowej akcji:', error)
    } finally {
      setUpdatingTasks(new Set())
    }
  }

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case 'new': return <Circle className="h-4 w-4 text-blue-500" />
      case 'in_progress': return <PlayCircle className="h-4 w-4 text-yellow-500" />
      case 'completed': return <CheckCircle2 className="h-4 w-4 text-green-500" />
      default: return <Circle className="h-4 w-4 text-gray-500" />
    }
  }



  const useVirtual = filteredTasks.length > 60 // poniżej 60 zostaw klasyczną tabelę

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-gray-100 p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Ładowanie zadań...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-gray-100 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Nagłówek */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl">
                <Target className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Zadania</h1>
                <p className="text-gray-600">
                  {userProfile?.role === 'kierownik' 
                    ? `Zadania z działu: ${userProfile.department_name}`
                    : userProfile?.role === 'dyrektor'
                    ? 'Wszystkie zadania w systemie'
                    : 'Twoje zadania'
                  }
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Button
                onClick={() => router.push('/dashboard/tasks/add-task')}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Dodaj zadanie
              </Button>
              <Button
                onClick={() => router.push('/dashboard/gantt')}
                variant="outline"
                size="sm"
              >
                <GanttChart className="h-4 w-4 mr-2" />
                Gantt
              </Button>
            </div>
          </div>
          
          {/* Statystyki */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600">Wszystkie zadania</p>
                  <p className="text-2xl font-bold text-blue-900">{tasks.length}</p>
                </div>
                <Target className="h-8 w-8 text-blue-400" />
              </div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-yellow-600">W trakcie</p>
                  <p className="text-2xl font-bold text-yellow-900">{tasks.filter(t => t.status === 'in_progress').length}</p>
                </div>
                <PlayCircle className="h-8 w-8 text-yellow-400" />
              </div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-600">Zakończone</p>
                  <p className="text-2xl font-bold text-green-900">{tasks.filter(t => t.status === 'completed').length}</p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-green-400" />
              </div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-600">Nowe</p>
                  <p className="text-2xl font-bold text-purple-900">{tasks.filter(t => t.status === 'new').length}</p>
                </div>
                <Circle className="h-8 w-8 text-purple-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Filtry i wyszukiwanie */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Filter className="h-5 w-5" />
                <span className="font-semibold">Filtry i wyszukiwanie</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
              >
                {showFilters ? <FilterX className="h-4 w-4 mr-2" /> : <Filter className="h-4 w-4 mr-2" />}
                {showFilters ? 'Ukryj filtry' : 'Pokaż filtry'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Wyszukiwanie */}
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Wyszukaj zadania..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Filtry (toggle jak teraz) */}
            {showFilters && (
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
                {/* Status */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <Select
                    value={filters.status}
                    onValueChange={(v) => setFilters((p) => ({ ...p, status: v }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Priorytet */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Priorytet</label>
                  <Select
                    value={filters.priority}
                    onValueChange={(v) => setFilters((p) => ({ ...p, priority: v }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Priorytet" />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITY_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Departament */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Departament</label>
                  <Select
                    value={filters.department}
                    onValueChange={(v) => setFilters((p) => ({ ...p, department: v }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Departament" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Wszystkie departamenty</SelectItem>
                      {departments.map((dept) => (
                        <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Zakres przypisania */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Zakres</label>
                  <Select
                    value={filters.owner}
                    onValueChange={(v) => setFilters((p) => ({ ...p, owner: v as OwnerScope }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Zakres" />
                    </SelectTrigger>
                    <SelectContent>
                      {OWNER_FILTER_OPTIONS.map((option) => (
                        <SelectItem
                          key={option.value}
                          value={option.value}
                          disabled={option.disabled}
                        >
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Pokaż zakończone */}
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="showCompleted"
                    checked={filters.showCompleted}
                    onCheckedChange={(checked) => setFilters((p) => ({ ...p, showCompleted: !!checked }))}
                  />
                  <label htmlFor="showCompleted" className="text-sm font-medium text-gray-700">
                    Pokaż zakończone
                  </label>
                </div>
              </div>
            )}

            {/* Sortowanie – identyczne zachowanie jak w Gantcie */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-gray-700">Sortuj według:</span>

              <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
              >
                {sortDirection === 'asc' ? '↑ Rosnąco' : '↓ Malejąco'}
              </Button>

              <Button variant="outline" size="sm" onClick={resetFilters}>
                <FilterX className="h-4 w-4 mr-2" />
                Resetuj filtry
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Akcje masowe */}
        {selectedTasks.size > 0 && (
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-blue-700">
                    Wybrano {selectedTasks.size} zadań
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    onClick={() => handleBulkAction('complete')}
                    variant="outline"
                    size="sm"
                    className="text-green-600 border-green-600 hover:bg-green-50"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Oznacz jako zakończone
                  </Button>
                  <Button
                    onClick={() => handleBulkAction('delete')}
                    variant="outline"
                    size="sm"
                    className="text-red-600 border-red-600 hover:bg-red-50"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Usuń
                  </Button>
                  <Button
                    onClick={() => setSelectedTasks(new Set())}
                    variant="ghost"
                    size="sm"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Anuluj
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Lista zadań - w stylu tabeli z wykresu Gantta */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Lista zadań</h2>
                <p className="text-sm text-gray-600">
                  {filteredTasks.length === tasks.length 
                    ? `Wyświetlono wszystkie ${tasks.length} zadania`
                    : `Wyświetlono ${filteredTasks.length} z ${tasks.length} zadań`
                  }
                </p>
              </div>
              {/* przydatny skrót do zaznaczania widocznych */}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={selectVisible}>Zaznacz widoczne</Button>
                <Button variant="outline" size="sm" onClick={unselectVisible}>Odznacz widoczne</Button>
                {selectedTasks.size > 0 && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => setSelectedTasks(new Set())}>
                      Odznacz wszystkie
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setSelectedTasks(new Set(filteredTasks.filter(t => t.id).map(t => t.id!)))}>
                      Zaznacz wszystkie
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredTasks.length === 0 ? (
              <div className="text-center py-8">
                <Target className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                <p className="text-gray-600">Nie znaleziono zadań spełniających kryteria</p>
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  {useVirtual ? (
                    <div style={{ height: 600 }}>
                      <TableVirtuoso
                        data={filteredTasks}
                        components={tableComponents}
                        rangeChanged={(r) => setVisibleRange(r)}
                        fixedHeaderContent={() => (
                          <tr>
                            {/* ⬇️ NOWA kolumna z checkboxem dla "Zaznacz wszystko" */}
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              {/* checkbox nagłówka: steruje tylko WIDOCZNYMI */}
                              <Checkbox
                                checked={allVisibleSelected ? true : (someVisibleSelected ? 'indeterminate' as const : false)}
                                onCheckedChange={(checked) => {
                                  if (checked) selectVisible()
                                  else unselectVisible()
                                }}
                                data-prevent-row-click
                                onClick={(event) => event.stopPropagation()}
                              />
                          </th>

                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Zadanie</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priorytet</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Departament</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Przypisane</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Termin</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Akcje</th>
                          </tr>
                        )}
                        itemContent={(index, task) => {
                          const checked = selectedTasks.has(task.id || '')
                          return (
                            <>
                              <td className="px-4 py-4 whitespace-nowrap">
                                <Checkbox
                                  data-prevent-row-click
                                  onClick={(event) => event.stopPropagation()}
                                  checked={checked}
                                  onCheckedChange={(val) => {
                                    setSelectedTasks(prev => {
                                      const next = new Set(prev)
                                      const id = task.id || ''
                                      if (val) next.add(id)
                                      else next.delete(id)
                                      return next
                                    })
                                  }}
                                />
                              </td>

                              <td className="px-4 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900">{task.title || 'Brak tytułu'}</div>
                                {task.description && (
                                  <div className="text-xs text-gray-500 mt-1 line-clamp-2">{task.description}</div>
                                )}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap">
                                <Badge className={getStatusColor(task.status)}>{getStatusLabel(task.status)}</Badge>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap">
                                <Badge className={getPriorityColor(task.priority)}>{getPriorityLabel(task.priority)}</Badge>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                                {task.department_name || 'Brak departamentu'}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                                {task.assigned_to_name || 'Nieprzypisane'}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                                {task.due_date ? new Date(task.due_date).toLocaleDateString('pl-PL') : 'Brak terminu'}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    data-prevent-row-click
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      handleTaskClick(task.id)
                                    }}
                                  >
                                    <Eye className="h-4 w-4 mr-2" />
                                    Szczegóły
                                  </Button>
                                </div>
                              </td>
                            </>
                          )
                        }}
                      />
                    </div>
                  ) : (
                                        // klasyczna tabela jak dotąd
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            <Checkbox
                              checked={allVisibleSelected ? true : (someVisibleSelected ? 'indeterminate' as const : false)}
                              onCheckedChange={(checked) => {
                                if (checked) selectVisible()
                                else unselectVisible()
                              }}
                            />
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Zadanie</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priorytet</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Departament</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Przypisane</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Termin</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Akcje</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredTasks.map((task) => (
                          <tr
                            key={task.id}
                            className="hover:bg-gray-50 cursor-pointer"
                            tabIndex={0}
                            onClick={(event) => {
                              if (isInteractiveElement(event.target)) return
                              handleTaskClick(task.id ?? null)
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault()
                                handleTaskClick(task.id ?? null)
                              }
                            }}
                          >
                            <td className="px-4 py-4 whitespace-nowrap">
                              <Checkbox
                                data-prevent-row-click
                                onClick={(event) => event.stopPropagation()}
                                checked={selectedTasks.has(task.id || '')}
                                onCheckedChange={(val) => {
                                  setSelectedTasks(prev => {
                                    const next = new Set(prev)
                                    const id = task.id || ''
                                    if (val) next.add(id)
                                    else next.delete(id)
                                    return next
                                  })
                                }}
                              />
                            </td>

                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">{task.title || 'Brak tytułu'}</div>
                              {task.description && (
                                <div className="text-xs text-gray-500 mt-1 line-clamp-2">{task.description}</div>
                              )}
                            </td>

                            <td className="px-4 py-4 whitespace-nowrap">
                              <Badge className={getStatusColor(task.status)}>{getStatusLabel(task.status)}</Badge>
                            </td>

                            <td className="px-4 py-4 whitespace-nowrap">
                              <Badge className={getPriorityColor(task.priority)}>{getPriorityLabel(task.priority)}</Badge>
                            </td>

                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                              {task.department_name || 'Brak departamentu'}
                            </td>

                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                              {task.assigned_to_name || 'Nieprzypisane'}
                            </td>

                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                              {task.due_date ? new Date(task.due_date).toLocaleDateString('pl-PL') : 'Brak terminu'}
                            </td>

                            <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  data-prevent-row-click
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    handleTaskClick(task.id)
                                  }}
                                >
                                  <Eye className="h-4 w-4 mr-2" />
                                  Szczegóły
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    )}
                  </div>
                </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
