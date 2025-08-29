'use client'

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { 
  Calendar, 
  Filter, 
  ZoomIn, 
  ZoomOut, 
  RefreshCw,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'

interface Task {
  id: string | null
  title: string | null
  description: string | null
  status: string | null
  priority: string | null
  department_id: number | null
  department_name: string | null
  assigned_to: string | null
  assigned_to_name: string | null
  assigned_to_email: string | null
  created_by: string | null
  created_by_name: string | null
  due_date: string | null
  week_number: string | null
  created_at: string | null
  updated_at: string | null
}

interface GanttTask {
  id: string
  title: string
  department: string
  status: string
  priority: string
  assignedTo: string
  startDate: Date
  endDate: Date
  duration: number
  progress: number
  color: string
}

interface FilterOptions {
  department: string
  status: string
  priority: string
  assignedTo: string
}

interface TimeScale {
  unit: 'day' | 'week' | 'month'
  pixelsPerUnit: number
}

export default function GanttChart() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<FilterOptions>({
    department: 'all',
    status: 'all',
    priority: 'all',
    assignedTo: 'all'
  })
  const [timeScale, setTimeScale] = useState<TimeScale>({ unit: 'week', pixelsPerUnit: 100 })
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewRange, setViewRange] = useState(12) // weeks

  // Load tasks from database
  useEffect(() => {
    loadTasks()
  }, [])

  const loadTasks = async () => {
    try {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        .from('tasks_with_details')
        .select('*')
        .order('due_date', { ascending: true })

      if (error) throw error

      setTasks(data || [])
    } catch (err) {
      console.error('Błąd podczas ładowania zadań:', err)
      setError('Wystąpił błąd podczas ładowania zadań')
    } finally {
      setLoading(false)
    }
  }

  // Transform tasks for Gantt chart
  const ganttTasks = useMemo((): GanttTask[] => {
    return tasks
      .filter(task => {
        if (filters.department !== 'all' && task.department_name !== filters.department) return false
        if (filters.status !== 'all' && task.status !== filters.status) return false
        if (filters.priority !== 'all' && task.priority !== filters.priority) return false
        if (filters.assignedTo !== 'all' && task.assigned_to_name !== filters.assignedTo) return false
        return true
      })
      .map(task => {
        const startDate = new Date(task.created_at || '')
        
        // Oblicz szacowany czas trwania na podstawie priorytetu i statusu
        let estimatedDays = 3 // domyślnie 3 dni
        if (task.priority === 'high') estimatedDays = 1
        else if (task.priority === 'medium') estimatedDays = 3
        else if (task.priority === 'low') estimatedDays = 7
        
        // Jeśli zadanie jest ukończone, użyj rzeczywistego czasu
        if (task.status === 'completed' && task.updated_at) {
          const endDate = new Date(task.updated_at)
          estimatedDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
        }
        
        const endDate = task.due_date ? new Date(task.due_date) : new Date(startDate.getTime() + (estimatedDays * 24 * 60 * 60 * 1000))
        
        // Oblicz postęp na podstawie statusu
        let progress = 0
        if (task.status === 'completed') progress = 100
        else if (task.status === 'in_progress') progress = 50
        else if (task.status === 'new') progress = 0
        
        // Kolor na podstawie statusu i priorytetu
        let color = '#6B7280' // domyślnie szary
        if (task.status === 'completed') color = '#10B981' // zielony
        else if (task.status === 'in_progress') {
          if (task.priority === 'high') color = '#EF4444' // czerwony
          else if (task.priority === 'medium') color = '#F59E0B' // żółty
          else color = '#3B82F6' // niebieski
        }
        else if (task.status === 'new') {
          if (task.priority === 'high') color = '#DC2626' // ciemny czerwony
          else if (task.priority === 'medium') color = '#D97706' // ciemny żółty
          else color = '#1D4ED8' // ciemny niebieski
        }

        return {
          id: task.id || '',
          title: task.title || '',
          department: task.department_name || '',
          status: task.status || '',
          priority: task.priority || '',
          assignedTo: task.assigned_to_name || 'Nieprzydzielone',
          startDate,
          endDate,
          duration: estimatedDays,
          progress,
          color
        }
      })
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
  }, [tasks, filters])

  // Get unique values for filters
  const departments = useMemo(() => {
    const depts = tasks
      .map(t => t.department_name)
      .filter((dept): dept is string => dept !== null && dept !== undefined && dept !== '')
    return [...new Set(depts)]
  }, [tasks])
  
  const statuses = useMemo(() => {
    const stats = tasks
      .map(t => t.status)
      .filter((status): status is string => status !== null && status !== undefined && status !== '')
    return [...new Set(stats)]
  }, [tasks])
  
  const priorities = useMemo(() => {
    const priors = tasks
      .map(t => t.priority)
      .filter((priority): priority is string => priority !== null && priority !== undefined && priority !== '')
    return [...new Set(priors)]
  }, [tasks])
  
  const assignedUsers = useMemo(() => {
    const users = tasks
      .map(t => t.assigned_to_name)
      .filter((user): user is string => user !== null && user !== undefined && user !== '' && user !== 'Nieprzydzielone')
    return [...new Set(users)]
  }, [tasks])

  // Calculate chart dimensions
  const chartHeight = ganttTasks.length * 60 + 100
  const chartWidth = viewRange * timeScale.pixelsPerUnit

  // Generate time axis labels
  const timeAxisLabels = useMemo(() => {
    const labels = []
    const startDate = new Date(currentDate)
    startDate.setDate(startDate.getDate() - Math.floor(viewRange / 2))
    
    for (let i = 0; i <= viewRange; i++) {
      const date = new Date(startDate)
      if (timeScale.unit === 'day') {
        date.setDate(date.getDate() + i)
        labels.push({
          date,
          label: date.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' }),
          position: i * timeScale.pixelsPerUnit
        })
      } else if (timeScale.unit === 'week') {
        date.setDate(date.getDate() + (i * 7))
        labels.push({
          date,
          label: `T${Math.ceil((date.getTime() - new Date(date.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000))}`,
          position: i * timeScale.pixelsPerUnit
        })
      } else if (timeScale.unit === 'month') {
        date.setMonth(date.getMonth() + i)
        labels.push({
          date,
          label: date.toLocaleDateString('pl-PL', { month: 'short' }),
          position: i * timeScale.pixelsPerUnit
        })
      }
    }
    return labels
  }, [currentDate, viewRange, timeScale])

  // Calculate task positions
  const taskPositions = useMemo(() => {
    const startDate = new Date(currentDate)
    startDate.setDate(startDate.getDate() - Math.floor(viewRange / 2))
    
    return ganttTasks.map(task => {
      const startOffset = (task.startDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      const left = Math.max(0, startOffset * (timeScale.pixelsPerUnit / (timeScale.unit === 'day' ? 1 : timeScale.unit === 'week' ? 7 : 30)))
      const width = task.duration * (timeScale.pixelsPerUnit / (timeScale.unit === 'day' ? 1 : timeScale.unit === 'week' ? 7 : 30))
      
      return {
        ...task,
        left,
        width: Math.max(width, 20) // minimum 20px width
      }
    })
  }, [ganttTasks, currentDate, viewRange, timeScale])

  const navigateTime = (direction: 'left' | 'right') => {
    const newDate = new Date(currentDate)
    if (direction === 'left') {
      if (timeScale.unit === 'day') newDate.setDate(newDate.getDate() - 7)
      else if (timeScale.unit === 'week') newDate.setDate(newDate.getDate() - 14)
      else if (timeScale.unit === 'month') newDate.setMonth(newDate.getMonth() - 2)
    } else {
      if (timeScale.unit === 'day') newDate.setDate(newDate.getDate() + 7)
      else if (timeScale.unit === 'week') newDate.setDate(newDate.getDate() + 14)
      else if (timeScale.unit === 'month') newDate.setMonth(newDate.getMonth() + 2)
    }
    setCurrentDate(newDate)
  }

  const resetToToday = () => {
    setCurrentDate(new Date())
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Ładowanie wykresu Gantta...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-red-600 mb-4">❌</div>
          <p className="text-red-600">{error}</p>
          <Button onClick={loadTasks} variant="outline" size="sm" className="mt-4">
            <RefreshCw className="h-4 w-4 mr-2" />
            Spróbuj ponownie
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Calendar className="h-8 w-8 text-blue-600" />
            Wykres Gantta
          </h1>
          <p className="text-gray-600 mt-2">
            Harmonogram zadań z wizualizacją na osi czasu
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3">
          <Button onClick={resetToToday} variant="outline" size="sm">
            <Calendar className="h-4 w-4 mr-2" />
            Dziś
          </Button>
          
          <Button onClick={loadTasks} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Odśwież
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Filtry:</span>
            </div>
            
            <div>
              <Select value={filters.department} onValueChange={(value) => setFilters(prev => ({ ...prev, department: value }))}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Wszystkie działy" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Wszystkie działy</SelectItem>
                  {departments.map(dept => (
                    <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Select value={filters.status} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Wszystkie statusy" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Wszystkie statusy</SelectItem>
                  {statuses.map(status => (
                    <SelectItem key={status} value={status}>
                      {status === 'completed' ? 'Ukończone' : 
                       status === 'in_progress' ? 'W trakcie' : 
                       status === 'new' ? 'Nowe' : status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Select value={filters.priority} onValueChange={(value) => setFilters(prev => ({ ...prev, priority: value }))}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Wszystkie priorytety" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Wszystkie priorytety</SelectItem>
                  {priorities.map(priority => (
                    <SelectItem key={priority} value={priority}>
                      {priority === 'high' ? 'Wysoki' : 
                       priority === 'medium' ? 'Średni' : 
                       priority === 'low' ? 'Niski' : priority}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Select value={filters.assignedTo} onValueChange={(value) => setFilters(prev => ({ ...prev, assignedTo: value }))}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Wszyscy użytkownicy" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Wszyscy użytkownicy</SelectItem>
                  {assignedUsers.map(user => (
                    <SelectItem key={user} value={user}>{user}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Time Scale Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-gray-700">Skala czasu:</span>
              
              <Select value={timeScale.unit} onValueChange={(value: 'day' | 'week' | 'month') => 
                setTimeScale(prev => ({ ...prev, unit: value }))
              }>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Dni</SelectItem>
                  <SelectItem value="week">Tygodnie</SelectItem>
                  <SelectItem value="month">Miesiące</SelectItem>
                </SelectContent>
              </Select>

              <Select value={timeScale.pixelsPerUnit.toString()} onValueChange={(value) => 
                setTimeScale(prev => ({ ...prev, pixelsPerUnit: parseInt(value) }))
              }>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="50">50px</SelectItem>
                  <SelectItem value="100">100px</SelectItem>
                  <SelectItem value="150">150px</SelectItem>
                  <SelectItem value="200">200px</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => navigateTime('left')}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <span className="text-sm text-gray-600 min-w-[120px] text-center">
                {currentDate.toLocaleDateString('pl-PL', { 
                  day: '2-digit', 
                  month: '2-digit', 
                  year: 'numeric' 
                })}
              </span>
              
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => navigateTime('right')}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Gantt Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Harmonogram zadań</span>
            <div className="text-sm text-gray-500">
              {ganttTasks.length} zadań • {timeAxisLabels.length} jednostek czasu
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <div className="min-w-full" style={{ width: chartWidth + 200 }}>
              {/* Time Axis */}
              <div className="sticky top-0 bg-gray-50 border-b border-gray-200 shadow-sm">
                <div className="flex" style={{ paddingLeft: '200px' }}>
                  {timeAxisLabels.map((label, index) => (
                    <div
                      key={index}
                      className="border-l border-gray-200 text-xs text-gray-700 text-center py-3 font-medium"
                      style={{ width: timeScale.pixelsPerUnit }}
                    >
                      {label.label}
                      {index === 0 && (
                        <div className="text-xs text-gray-500 mt-1">Dzisiaj</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Tasks */}
              <div className="relative">
                {taskPositions.map((task, index) => (
                  <div
                    key={task.id}
                    className="flex items-center border-b border-gray-200 hover:bg-blue-50 transition-all duration-200 relative group"
                    style={{ height: '80px' }}
                  >
                    {/* Task Info */}
                    <div className="sticky left-0 bg-white border-r border-gray-200 px-4 py-2 min-w-[200px] z-10 group-hover:bg-blue-50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate group-hover:text-blue-700 transition-colors" title={task.title}>
                            {task.title}
                          </div>
                          <div className="text-xs text-gray-500 truncate group-hover:text-blue-600 transition-colors">
                            {task.department} • {task.assignedTo}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Badge 
                            variant={task.status === 'completed' ? 'default' : 'secondary'}
                            className={`text-xs ${
                              task.status === 'completed' 
                                ? 'bg-green-600 text-white' 
                                : task.status === 'in_progress'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-600 text-white'
                            }`}
                          >
                            {task.status === 'completed' ? 'Ukończone' : 
                             task.status === 'in_progress' ? 'W trakcie' : 'Nowe'}
                          </Badge>
                          <Badge 
                            variant="outline"
                            className={`text-xs ${
                              task.priority === 'high' 
                                ? 'border-red-500 text-red-700 bg-red-50' 
                                : task.priority === 'medium'
                                ? 'border-yellow-500 text-yellow-700 bg-yellow-50'
                                : 'border-green-500 text-green-700 bg-green-50'
                            }`}
                          >
                            {task.priority === 'high' ? 'Wysoki' : 
                             task.priority === 'medium' ? 'Średni' : 'Niski'}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {/* Task Bar */}
                    <div className="relative flex-1" style={{ height: '80px' }}>
                      <div
                        className="absolute top-1/2 transform -translate-y-1/2 rounded-lg cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-105 border-2 border-white"
                        style={{
                          left: `${task.left}px`,
                          width: `${task.width}px`,
                          height: '36px',
                          backgroundColor: task.color,
                          opacity: 0.95
                        }}
                        title={`${task.title} (${task.duration} dni, ${task.progress}% ukończone)`}
                      >
                        {/* Progress Bar */}
                        {task.progress > 0 && (
                          <div
                            className="h-full bg-white bg-opacity-50 rounded-l-lg"
                            style={{ width: `${task.progress}%` }}
                          />
                        )}
                        
                        {/* Task Label - lepsze pozycjonowanie i czytelność */}
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="px-2 py-1 text-xs font-semibold text-white text-center leading-tight max-w-full drop-shadow-sm">
                            {task.title.length > 25 ? 
                              task.title.substring(0, 25) + '...' : 
                              task.title
                            }
                          </div>
                        </div>
                        
                        {/* Duration indicator */}
                        <div className="absolute -bottom-7 left-0 text-xs text-gray-600 whitespace-nowrap font-medium">
                          {task.duration} {task.duration === 1 ? 'dzień' : task.duration < 5 ? 'dni' : 'dni'}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Legenda</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-green-500"></div>
              <span className="text-sm">Ukończone</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-red-500"></div>
              <span className="text-sm">W trakcie (Wysoki priorytet)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-yellow-500"></div>
              <span className="text-sm">W trakcie (Średni priorytet)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-blue-500"></div>
              <span className="text-sm">W trakcie (Niski priorytet)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-gray-600"></div>
              <span className="text-sm">Nowe (Wysoki priorytet)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-gray-500"></div>
              <span className="text-sm">Nowe (Średni priorytet)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-gray-400"></div>
              <span className="text-sm">Nowe (Niski priorytet)</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
