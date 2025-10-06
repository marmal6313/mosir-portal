'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthContext } from '@/hooks/useAuth'
import type { Database } from '@/types/database'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { 
  Calendar,
  Clock,
  User,
  CheckCircle,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Plus,
  Circle,
  List,
  RefreshCw,
  Building2,
  PlayCircle,
  BarChart3,
  Eye
} from 'lucide-react'
import { GanttChart, type GanttItem } from '@/components/GanttChart'
import { logger } from '@/lib/logger'

type TaskWithDetails = Database['public']['Views']['tasks_with_details']['Row']

export default function DashboardPage() {
  const { user, profile, loading } = useAuthContext()
  const router = useRouter()
  const [tasks, setTasks] = useState<TaskWithDetails[]>([])
  const [viewMode, setViewMode] = useState<'list' | 'gantt'>('list')
  const [hideCompleted, setHideCompleted] = useState(true)
  const [stats, setStats] = useState({
    totalTasks: 0,
    completedTasks: 0,
    pendingTasks: 0,
    highPriorityTasks: 0
  })
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const visibleTasks = useMemo(() => {
    if (!hideCompleted) return tasks
    return tasks.filter((task) => task.status !== 'completed')
  }, [tasks, hideCompleted])

  useEffect(() => {
    if (profile && user) {
      fetchTasks()
    }
  }, [profile, user])

  // Dodaj odświeżanie danych co 30 sekund
  useEffect(() => {
    if (!profile) return

    const interval = setInterval(() => {
      fetchTasks()
    }, 30000) // Odśwież co 30 sekund

    return () => clearInterval(interval)
  }, [profile])

  // Odśwież dane gdy strona staje się aktywna (po powrocie z edycji zadania)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && profile) {
        fetchTasks()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [profile])

  const fetchTasks = async () => {
    if (!profile || !user) {
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const timestamp = new Date().toISOString()
      
      let query = supabase
        .from('tasks_with_details')
        .select('*')
        .order('created_at', { ascending: false })

      // Logika pobierania zadań na podstawie roli
      if (profile.role === 'superadmin' || profile.role === 'dyrektor') {
        // Dyrektor/Superadmin widzi wszystkie zadania
      } else if (profile.role === 'kierownik') {
        // Kierownik widzi zadania swojego działu
        if (profile.department_id) {
          query = query.eq('department_id', profile.department_id)
        }
      } else {
        // Pracownik widzi zadania swojego działu i przypisane do niego
        if (profile.department_id) {
          query = query.eq('department_id', profile.department_id)
        }
        query = query.or(`assigned_to.eq.${user.id},created_by.eq.${user.id}`)
      }

      const { data: tasks, error } = await query

      if (error) {
        logger.error('Błąd pobierania zadań:', error)
        
        // Sprawdź czy to błąd połączenia
        if (error.message?.includes('fetch') || error.message?.includes('network') || error.message?.includes('Failed to fetch')) {
          setError('Brak połączenia z internetem. Sprawdź swoje połączenie i spróbuj ponownie.')
        } else {
          setError('Wystąpił błąd podczas pobierania zadań. Spróbuj ponownie.')
        }
        return
      }

      const safeTasks = tasks || []
      setTasks(safeTasks)

      // Ustaw statystyki do kafelków
      const newStats = {
        totalTasks: safeTasks.length,
        completedTasks: safeTasks.filter(t => t.status === 'completed').length,
        pendingTasks: safeTasks.filter(t => t.status === 'pending').length,
        highPriorityTasks: safeTasks.filter(t => t.priority === 'high').length,
      }
      setStats(newStats)
    } catch (error) {
      logger.error('Nieoczekiwany błąd podczas pobierania zadań:', error)
      
      // Sprawdź czy to błąd połączenia
      if (error instanceof TypeError && error.message?.includes('fetch')) {
        setError('Brak połączenia z internetem. Sprawdź swoje połączenie i spróbuj ponownie.')
      } else {
        setError('Wystąpił nieoczekiwany błąd. Spróbuj ponownie.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="h-4 w-4 text-green-600" />
      case 'in_progress': return <PlayCircle className="h-4 w-4 text-yellow-600" />
      case 'pending': return <Clock className="h-4 w-4 text-blue-600" />
      case 'new': return <Circle className="h-4 w-4 text-gray-400" />
      default: return <Circle className="h-4 w-4 text-gray-400" />
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

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 border-green-200'
      case 'in_progress': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'pending': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'new': return 'bg-blue-100 text-blue-800 border-blue-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStatusLabel = (status: string | null) => {
    switch (status) {
      case 'completed': return 'Zakończone'
      case 'in_progress': return 'W trakcie'
      case 'pending': return 'Oczekujące'
      case 'new': return 'Nowe'
      default: return 'Nieznany'
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Brak terminu'
    return new Date(dateString).toLocaleDateString('pl-PL')
  }

  const isOverdue = (dueDate: string | null) => {
    if (!dueDate) return false
    const task = tasks.find(t => t.due_date === dueDate)
    return new Date(dueDate) < new Date() && task && task.status !== 'completed'
  }

  const handleTaskClick = (taskId: string) => {
    router.push(`/dashboard/tasks/${taskId}`)
  }

  const ganttItems: GanttItem[] = useMemo(() => (
    visibleTasks
      .filter((task) => task.id)
      .map((task) => {
        const startDate = task.start_date ? new Date(task.start_date) : (task.created_at ? new Date(task.created_at) : new Date())
        const endDate = task.due_date ? new Date(task.due_date) : new Date(startDate.getTime() + 24 * 60 * 60 * 1000)

        return {
          id: task.id || '',
          title: task.title || 'Brak tytułu',
          startDate,
          endDate,
          progress: task.status === 'completed' ? 100 :
                   task.status === 'in_progress' ? 50 : 0,
          status: (task.status as 'new' | 'in_progress' | 'completed' | 'cancelled') || 'new',
          priority: (task.priority as 'low' | 'medium' | 'high') || 'medium',
          assignee: task.assigned_to_name || undefined,
          description: task.description || undefined,
          department: task.department_name || undefined,
        }
      })
  ), [visibleTasks])

  const handleGanttItemClick = (item: GanttItem) => {
    router.push(`/dashboard/tasks/${item.id}`)
  }

  const handleGanttItemUpdate = async (updatedItem: GanttItem) => {
    try {
      // Znajdź oryginalne zadanie
      const originalTask = tasks.find(t => t.id === updatedItem.id)
      if (!originalTask) return

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
      if (updatedItem.assignee !== originalTask.assigned_to_name) {
        // Musimy znaleźć ID użytkownika na podstawie nazwy
        // Na razie zapiszemy nazwę w polu description lub utworzymy nowe pole
        updateData.description = updatedItem.assignee || null
      }

      // Sprawdź opis
      if (updatedItem.description !== originalTask.description) {
        updateData.description = updatedItem.description
      }

      // Jeśli nie ma zmian, nie rób nic
      if (Object.keys(updateData).length === 0) {
        logger.debug('ℹ️ Brak zmian do zapisania')
        return
      }

      logger.debug('🔄 Aktualizuję zadanie:', updatedItem.title)
      logger.debug('📊 Oryginalne dane:', {
        status: originalTask.status,
        priority: originalTask.priority,
        description: originalTask.description
      })
      logger.debug('📝 Nowe dane:', updateData)

      // Aktualizuj w bazie danych
      const { error } = await supabase
        .from('tasks')
        .update(updateData)
        .eq('id', updatedItem.id)

      if (error) {
        logger.error('❌ Błąd aktualizacji zadania:', error)
        return
      }

      // Odśwież dane
      await fetchTasks()
      logger.debug('✅ Zadanie zaktualizowane:', updatedItem.title)
    } catch (error) {
      logger.error('❌ Błąd podczas aktualizacji zadania:', error)
    }
  }

  const handleGanttItemDelete = async (item: GanttItem) => {
    try {
      logger.debug('🗑️ Usuwam zadanie z bazy:', {
        id: item.id,
        title: item.title,
        idType: typeof item.id,
        idValue: item.id
      })
      
      // Sprawdź czy ID jest poprawne
      if (!item.id || item.id === 'undefined' || item.id === 'null') {
        logger.error('❌ Nieprawidłowe ID zadania:', item.id)
        alert('Nieprawidłowe ID zadania. Nie można usunąć.')
        return
      }

      // Najpierw usuń powiązane rekordy z task_changes
      logger.debug('🔍 Usuwam powiązane rekordy z task_changes...')
      const { error: changesError } = await supabase
        .from('task_changes')
        .delete()
        .eq('task_id', item.id)

      if (changesError) {
        logger.warn('⚠️ Błąd usuwania historii zmian:', changesError)
        // Kontynuuj mimo błędu - może tabela nie istnieje
      } else {
        logger.debug('✅ Historia zmian usunięta')
      }

      // Teraz usuń z bazy danych
      const { data, error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', item.id)
        .select() // Dodaj select() żeby zobaczyć co zostało usunięte

      logger.debug('🔍 Odpowiedź z bazy:', { data, error })

      if (error) {
        logger.error('❌ Błąd usuwania zadania:', {
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
        title: item.title
      })

      // Odśwież dane z bazy
      await fetchTasks()
      
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


  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Ładowanie...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-gray-100">
      <div className="px-4 sm:px-6 py-4 sm:py-6">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-sm sm:text-base text-gray-600 mt-1">
                Witaj w systemie zarządzania zadaniami MOSiR
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-gray-50">
                <Checkbox
                  id="dashboard-toggle-hide-completed"
                  checked={hideCompleted}
                  onCheckedChange={(checked) => setHideCompleted(checked === true)}
                />
                <label htmlFor="dashboard-toggle-hide-completed" className="text-xs sm:text-sm text-gray-700">
                  Ukryj zakończone
                </label>
              </div>

              <Button
                onClick={fetchTasks}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                <span className="hidden sm:inline">Odśwież</span>
                <span className="sm:hidden">Odśwież</span>
              </Button>
              
              {/* Przełącznik widoku */}
              <div className="flex items-center border border-gray-200 rounded-lg p-1 bg-gray-50">
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="h-8 px-3 text-xs"
                >
                  <List className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Lista</span>
                </Button>
                <Button
                  variant={viewMode === 'gantt' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('gantt')}
                  className="h-8 px-3 text-xs"
                >
                  <BarChart3 className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Gantt</span>
                </Button>
              </div>
              
              <Link href="/dashboard/tasks">
                <Button size="sm" className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">Nowe zadanie</span>
                  <span className="sm:hidden">Nowe</span>
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Statystyki */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm sm:text-base font-medium text-gray-600">Wszystkie zadania</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-2xl sm:text-3xl font-bold text-gray-900">{stats.totalTasks}</div>
                <BarChart3 className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm sm:text-base font-medium text-gray-600">Zakończone</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-2xl sm:text-3xl font-bold text-green-600">{stats.completedTasks}</div>
                <CheckCircle className="h-6 w-6 sm:h-8 sm:w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm sm:text-base font-medium text-gray-600">Oczekujące</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-2xl sm:text-3xl font-bold text-yellow-600">{stats.pendingTasks}</div>
                <Clock className="h-6 w-6 sm:h-8 sm:w-8 text-yellow-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm sm:text-base font-medium text-gray-600">Wysoki priorytet</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-2xl sm:text-3xl font-bold text-red-600">{stats.highPriorityTasks}</div>
                <AlertCircle className="h-6 w-6 sm:h-8 sm:w-8 text-red-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Komunikat o błędzie */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-red-800">{error}</p>
              </div>
              <Button
                onClick={fetchTasks}
                variant="outline"
                size="sm"
                className="text-red-700 border-red-300 hover:bg-red-100"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Spróbuj ponownie
              </Button>
            </div>
          </div>
        )}

        {/* Lista zadań lub wykres Gantta */}
        {viewMode === 'list' ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-4 sm:p-6 border-b border-gray-200">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                  Ostatnie zadania ({visibleTasks.length})
                </h3>
                <Link href="/dashboard/tasks">
                  <Button variant="outline" size="sm" className="w-full sm:w-auto">
                    <Eye className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Zobacz wszystkie</span>
                    <span className="sm:hidden">Wszystkie</span>
                  </Button>
                </Link>
              </div>
            </div>
            
            <div className="divide-y divide-gray-100">
              {isLoading ? (
                <div className="p-8 sm:p-12 text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Ładowanie zadań...</p>
                </div>
              ) : visibleTasks.length === 0 ? (
                <div className="p-8 sm:p-12 text-center">
                  <BarChart3 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Brak zadań</h3>
                  <p className="text-gray-500 mb-4">Nie ma jeszcze żadnych zadań do wyświetlenia</p>
                  <Link href="/dashboard/tasks">
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Utwórz pierwsze zadanie
                    </Button>
                  </Link>
                </div>
              ) : (
                visibleTasks.slice(0, 10).map((task: TaskWithDetails) => (
                  <div 
                    key={task.id} 
                    className="p-3 sm:p-4 hover:bg-gray-50 transition-colors cursor-pointer group"
                    onClick={() => handleTaskClick(task.id!)}
                  >
                    {/* Kompaktowy widok w jednej linii */}
                    <div className="flex items-center gap-3 sm:gap-4">
                      {/* Status */}
                      <div className="flex-shrink-0">
                        {getStatusIcon(task.status)}
                      </div>
                      
                      {/* Tytuł i podstawowe informacje */}
                      <div className="flex-1 min-w-0">
                        <h4 className={`text-sm sm:text-base font-medium mb-1 line-clamp-2 ${
                          task.status === 'completed' ? 'text-gray-500 line-through' : 'text-gray-900'
                        }`}>
                          {task.title}
                        </h4>
                        
                        {/* Kompaktowe metadane w jednej linii */}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {task.department_name || 'Brak działu'}
                          </span>
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {task.assigned_to_name || 'Nieprzydzielone'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(task.due_date)}
                          </span>
                        </div>
                      </div>
                      
                      {/* Priorytet i akcje */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge className={`${task.priority === 'high' ? 'bg-red-100 text-red-800 border-red-200' : task.priority === 'medium' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' : 'bg-green-100 text-green-800 border-green-200'} border text-xs px-2 py-1`}>
                          {getPriorityLabel(task.priority)}
                        </Badge>
                        
                        {/* Akcje - widoczne po najechaniu */}
                        <div className="hidden sm:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Link href={`/dashboard/tasks/${task.id}`}>
                            <Button variant="outline" size="sm" className="h-7 px-2 text-xs">
                              Szczegóły
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </div>
                    
                    {/* Dodatkowe informacje na mobilnych */}
                    <div className="sm:hidden mt-2 pt-2 border-t border-gray-100">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge className={`${getStatusColor(task.status)} border text-xs`}>
                            {getStatusLabel(task.status)}
                          </Badge>
                          {isOverdue(task.due_date) && (
                            <Badge className="bg-red-100 text-red-800 border-red-200 border text-xs">
                              Przeterminowane
                            </Badge>
                          )}
                        </div>
                        <Link href={`/dashboard/tasks/${task.id}`}>
                          <Button variant="outline" size="sm" className="h-7 px-2 text-xs">
                            Szczegóły
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          /* Wykres Gantta */
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-4 sm:p-6 border-b border-gray-200">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                  Wykres Gantta ({ganttItems.length} zadań)
                </h3>
                <div className="flex items-center gap-2">
                  <Link href="/dashboard/tasks">
                    <Button variant="outline" size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Nowe zadanie
                    </Button>
                  </Link>
                  <Link href="/dashboard/gantt">
                    <Button variant="outline" size="sm">
                      <Eye className="h-4 w-4 mr-2" />
                      Pełny widok
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
            
            <div className="p-4">
              {isLoading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Ładowanie harmonogramu...</p>
                </div>
              ) : ganttItems.length === 0 ? (
                <div className="p-8 text-center">
                  <BarChart3 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Brak zadań</h3>
                  <p className="text-gray-500 mb-4">Nie ma jeszcze żadnych zadań do wyświetlenia</p>
                  <Link href="/dashboard/tasks">
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Utwórz pierwsze zadanie
                    </Button>
                  </Link>
                </div>
              ) : (
                <GanttChart
                  items={ganttItems}
                  onBarClick={handleGanttItemClick}
                  onItemUpdate={handleGanttItemUpdate}
                  onItemDelete={handleGanttItemDelete}
                  canDelete={profile?.role === 'superadmin' || profile?.role === 'dyrektor'}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
