'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuthContext } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { fetchUserDepartmentIds } from '@/hooks/useUserDepartments'
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Calendar, 
  CheckCircle, 
  Clock, 
  AlertTriangle,
  Download,
  Filter,
  RefreshCw,
  Building2,
  Target,
  Award,
  Activity,
  CheckSquare
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'

interface TaskStats {
  total: number
  completed: number
  inProgress: number
  pending: number
  overdue: number
}

interface DepartmentStats {
  department_name: string
  task_count: number
  completed_count: number
  completion_rate: number
}

interface UserPerformance {
  user_name: string
  completed_tasks: number
  total_tasks: number
  completion_rate: number
  avg_completion_time: number
}

interface MonthlyTrend {
  month: string
  completed_tasks: number
  new_tasks: number
}

export default function ReportsPage() {
  const { profile } = useAuthContext()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPeriod, setSelectedPeriod] = useState('30')
  const [selectedDepartment, setSelectedDepartment] = useState('all')
  const [taskStats, setTaskStats] = useState<TaskStats>({
    total: 0,
    completed: 0,
    inProgress: 0,
    pending: 0,
    overdue: 0
  })
  const [departmentStats, setDepartmentStats] = useState<DepartmentStats[]>([])
  const [userPerformance, setUserPerformance] = useState<UserPerformance[]>([])
  const [monthlyTrends, setMonthlyTrends] = useState<MonthlyTrend[]>([])

  useEffect(() => {
    if (profile) {
      loadReports()
    }
  }, [profile, selectedPeriod, selectedDepartment])

  const loadReports = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      console.log('🔍 Rozpoczynam ładowanie raportów...')
      await Promise.all([
        loadTaskStats(),
        loadDepartmentStats(),
        loadUserPerformance(),
        loadMonthlyTrends()
      ])
      console.log('✅ Raporty załadowane pomyślnie')
    } catch (error) {
      console.error('❌ Błąd podczas ładowania raportów:', error)
      console.error('❌ Szczegóły błędu:', JSON.stringify(error, null, 2))
      setError('Wystąpił błąd podczas ładowania raportów. Spróbuj odświeżyć stronę.')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadTaskStats = async () => {
    try {
      console.log('🔍 Ładowanie statystyk zadań...')
      const daysAgo = parseInt(selectedPeriod)
      const dateFilter = new Date()
      dateFilter.setDate(dateFilter.getDate() - daysAgo)

      let query = supabase
        .from('tasks')
        .select('*')

      // Filtruj po działach dla kierowników - multi-department
      if (profile?.role === 'kierownik' && profile.id) {
        try {
          const deptIds = await fetchUserDepartmentIds(profile.id)
          if (deptIds.length > 0) {
            console.log('🔍 Filtruję po działy:', deptIds)
            query = query.in('department_id', deptIds)
          }
        } catch (error) {
          console.error('❌ Błąd podczas pobierania department_ids:', error)
        }
      }

      const { data: tasks, error } = await query

      if (error) {
        console.error('❌ Błąd podczas pobierania zadań:', error)
        throw error
      }

      console.log('📊 Pobrane zadania:', tasks?.length || 0)

      const stats: TaskStats = {
        total: tasks?.length || 0,
        completed: tasks?.filter(t => t.status === 'completed').length || 0,
        inProgress: tasks?.filter(t => t.status === 'in_progress').length || 0,
        pending: tasks?.filter(t => t.status === 'pending').length || 0,
        overdue: tasks?.filter(t => {
          if (t.status === 'completed') return false
          if (!t.due_date) return false
          return new Date(t.due_date) < new Date()
        }).length || 0
      }

      console.log('📊 Statystyki zadań:', stats)
      setTaskStats(stats)
    } catch (error) {
      console.error('❌ Błąd w loadTaskStats:', error)
      throw error
    }
  }

  const loadDepartmentStats = async () => {
    try {
      console.log('🔍 Ładowanie statystyk działów...')
      let query = supabase
        .from('tasks')
        .select(`
          *,
          departments!inner(name)
        `)

      // Filtruj po działach dla kierowników - multi-department
      if (profile?.role === 'kierownik' && profile.id) {
        try {
          const deptIds = await fetchUserDepartmentIds(profile.id)
          if (deptIds.length > 0) {
            console.log('🔍 Filtruję po działy:', deptIds)
            query = query.in('department_id', deptIds)
          }
        } catch (error) {
          console.error('❌ Błąd podczas pobierania department_ids:', error)
        }
      }

      const { data: tasks, error } = await query

      if (error) {
        console.error('❌ Błąd podczas pobierania statystyk działów:', error)
        throw error
      }

      console.log('📊 Pobrane zadania dla statystyk działów:', tasks?.length || 0)

      const deptMap = new Map<string, { total: number; completed: number }>()

      tasks?.forEach(task => {
        const deptName = task.departments?.name || 'Nieznany'
        const current = deptMap.get(deptName) || { total: 0, completed: 0 }
        current.total++
        if (task.status === 'completed') current.completed++
        deptMap.set(deptName, current)
      })

      const stats: DepartmentStats[] = Array.from(deptMap.entries()).map(([name, data]) => ({
        department_name: name,
        task_count: data.total,
        completed_count: data.completed,
        completion_rate: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0
      }))

      console.log('📊 Statystyki działów:', stats)
      setDepartmentStats(stats)
    } catch (error) {
      console.error('❌ Błąd w loadDepartmentStats:', error)
      throw error
    }
  }

  const loadUserPerformance = async () => {
    try {
      console.log('🔍 Ładowanie wydajności użytkowników...')
      let query = supabase
        .from('tasks')
        .select(`
          *,
          assigned_user:users!assigned_to(first_name, last_name)
        `)

      // Filtruj po działach dla kierowników - multi-department
      if (profile?.role === 'kierownik' && profile.id) {
        try {
          const deptIds = await fetchUserDepartmentIds(profile.id)
          if (deptIds.length > 0) {
            console.log('🔍 Filtruję po działy:', deptIds)
            query = query.in('department_id', deptIds)
          }
        } catch (error) {
          console.error('❌ Błąd podczas pobierania department_ids:', error)
        }
      }

      const { data: tasks, error } = await query

      if (error) {
        console.error('❌ Błąd podczas pobierania wydajności użytkowników:', error)
        throw error
      }

      console.log('📊 Pobrane zadania dla wydajności użytkowników:', tasks?.length || 0)

      const userMap = new Map<string, { total: number; completed: number; totalTime: number }>()

      tasks?.forEach(task => {
        const user = task.assigned_user // assigned_user to obiekt
        const userName = user ? `${user.first_name} ${user.last_name}` : 'Nieznany'
        const current = userMap.get(userName) || { total: 0, completed: 0, totalTime: 0 }
        current.total++
        if (task.status === 'completed') {
          current.completed++
          // Oblicz czas wykonania (przykład)
          if (task.created_at && task.updated_at) {
            const created = new Date(task.created_at)
            const updated = new Date(task.updated_at)
            current.totalTime += updated.getTime() - created.getTime()
          }
        }
        userMap.set(userName, current)
      })

      const performance: UserPerformance[] = Array.from(userMap.entries()).map(([name, data]) => ({
        user_name: name,
        completed_tasks: data.completed,
        total_tasks: data.total,
        completion_rate: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0,
        avg_completion_time: data.completed > 0 ? Math.round(data.totalTime / data.completed / (1000 * 60 * 60 * 24)) : 0 // dni
      }))

      console.log('📊 Wydajność użytkowników:', performance)
      setUserPerformance(performance)
    } catch (error) {
      console.error('❌ Błąd w loadUserPerformance:', error)
      throw error
    }
  }

  const loadMonthlyTrends = async () => {
    try {
      console.log('🔍 Ładowanie trendów miesięcznych...')
      const months = ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 
                     'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień']
      
      const currentMonth = new Date().getMonth()
      const trends: MonthlyTrend[] = []

      for (let i = 5; i >= 0; i--) {
        const monthIndex = (currentMonth - i + 12) % 12
        trends.push({
          month: months[monthIndex],
          completed_tasks: Math.floor(Math.random() * 50) + 10, // Przykładowe dane
          new_tasks: Math.floor(Math.random() * 30) + 5
        })
      }

      console.log('📊 Trendy miesięczne:', trends)
      setMonthlyTrends(trends)
    } catch (error) {
      console.error('❌ Błąd w loadMonthlyTrends:', error)
      throw error
    }
  }

  const exportReport = (type: string) => {
    // Tutaj można dodać logikę eksportu do PDF/Excel
    console.log(`Eksportuję raport: ${type}`)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Ładowanie raportów...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="h-8 w-8 text-red-600 mb-4" />
          <p className="text-red-600">{error}</p>
          <Button onClick={loadReports} variant="outline" size="sm" className="mt-4">
            <RefreshCw className="h-4 w-4 mr-2" />
            Odśwież
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
            <BarChart3 className="h-8 w-8 text-blue-600" />
            Raporty i Analizy
          </h1>
          <p className="text-gray-600 mt-2">
            Kompleksowe analizy wydajności, postępów i trendów w systemie
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Ostatnie 7 dni</SelectItem>
              <SelectItem value="30">Ostatnie 30 dni</SelectItem>
              <SelectItem value="90">Ostatnie 3 miesiące</SelectItem>
              <SelectItem value="365">Ostatni rok</SelectItem>
            </SelectContent>
          </Select>
          
          <Button onClick={loadReports} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Odśwież
          </Button>
        </div>
      </div>

      {/* Filtry */}
      <Card className="bg-white rounded-lg p-4 border">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Filtry:</span>
          </div>
          
          <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Wszystkie działy" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Wszystkie działy</SelectItem>
              {departmentStats.map(dept => (
                <SelectItem key={dept.department_name} value={dept.department_name}>
                  {dept.department_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Główne statystyki */}
      {taskStats.total === 0 ? (
        <Card className="bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200">
          <CardContent className="text-center py-12">
            <Target className="h-16 w-16 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-semibold text-gray-600 mb-2">Brak zadań do analizy</h3>
            <p className="text-gray-500 mb-4">
              Nie ma jeszcze żadnych zadań w systemie. Dodaj pierwsze zadania, aby zobaczyć statystyki.
            </p>
            <Button onClick={() => window.location.href = '/dashboard/tasks/add-task'} variant="default">
              <CheckSquare className="h-4 w-4 mr-2" />
              Dodaj pierwsze zadanie
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-blue-800 flex items-center gap-2">
                <Target className="h-4 w-4" />
                Wszystkie zadania
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-900">{taskStats.total}</div>
              <p className="text-xs text-blue-700 mt-1">Łączna liczba</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-green-800 flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Ukończone
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-900">{taskStats.completed}</div>
              <p className="text-xs text-green-700 mt-1">
                {taskStats.total > 0 ? Math.round((taskStats.completed / taskStats.total) * 100) : 0}% ukończenia
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-yellow-800 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                W trakcie
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-900">{taskStats.inProgress}</div>
              <p className="text-xs text-yellow-700 mt-1">Aktywne zadania</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-800 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Oczekujące
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{taskStats.pending}</div>
              <p className="text-xs text-gray-700 mt-1">Do rozpoczęcia</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-red-800 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Po terminie
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-900">{taskStats.overdue}</div>
              <p className="text-xs text-red-700 mt-1">Wymagają uwagi</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Szczegółowe raporty */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Wydajność działów */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-600" />
              Wydajność działów
            </CardTitle>
            <CardDescription>
              Porównanie efektywności poszczególnych działów
            </CardDescription>
          </CardHeader>
          <CardContent>
            {departmentStats.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Building2 className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>Brak danych o działach</p>
                <p className="text-sm">Dodaj zadania do działów, aby zobaczyć statystyki</p>
              </div>
            ) : (
              <div className="space-y-4">
                {departmentStats.map((dept, index) => (
                  <div key={dept.department_name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${
                        index === 0 ? 'bg-green-500' : 
                        index === 1 ? 'bg-blue-500' : 
                        index === 2 ? 'bg-yellow-500' : 'bg-gray-400'
                      }`} />
                      <span className="font-medium">{dept.department_name}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{dept.completed_count}/{dept.task_count}</div>
                      <Badge variant={dept.completion_rate >= 80 ? 'default' : dept.completion_rate >= 60 ? 'secondary' : 'destructive'}>
                        {dept.completion_rate}%
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full mt-4"
              onClick={() => exportReport('departments')}
              disabled={departmentStats.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Eksportuj raport
            </Button>
          </CardContent>
        </Card>

        {/* Wydajność użytkowników */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-green-600" />
              Wydajność użytkowników
            </CardTitle>
            <CardDescription>
              Ranking pracowników według efektywności
            </CardDescription>
          </CardHeader>
          <CardContent>
            {userPerformance.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Users className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>Brak danych o użytkownikach</p>
                <p className="text-sm">Dodaj zadania przypisane do użytkowników, aby zobaczyć statystyki</p>
              </div>
            ) : (
              <div className="space-y-3">
                {userPerformance
                  .sort((a, b) => b.completion_rate - a.completion_rate)
                  .slice(0, 5)
                  .map((user, index) => (
                    <div key={user.user_name} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div className="flex items-center gap-3">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          index === 0 ? 'bg-yellow-500 text-white' :
                          index === 1 ? 'bg-gray-400 text-white' :
                          index === 2 ? 'bg-orange-500 text-white' : 'bg-gray-200'
                        }`}>
                          {index + 1}
                        </div>
                        <span className="font-medium">{user.user_name}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-600">{user.completed_tasks} z {user.total_tasks}</div>
                        <Badge variant={user.completion_rate >= 80 ? 'default' : 'secondary'}>
                          {user.completion_rate}%
                        </Badge>
                      </div>
                    </div>
                  ))}
              </div>
            )}
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full mt-4"
              onClick={() => exportReport('users')}
              disabled={userPerformance.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Eksportuj raport
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Trendy miesięczne */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-purple-600" />
            Trendy miesięczne
          </CardTitle>
          <CardDescription>
            Analiza zmian w liczbie zadań na przestrzeni miesięcy
          </CardDescription>
        </CardHeader>
        <CardContent>
          {monthlyTrends.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <TrendingUp className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>Brak danych o trendach</p>
              <p className="text-sm">Dodaj zadania, aby zobaczyć trendy miesięczne</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
              {monthlyTrends.map((trend) => (
                <div key={trend.month} className="text-center p-3 bg-gradient-to-b from-purple-50 to-purple-100 rounded-lg border border-purple-200">
                  <div className="text-sm font-medium text-purple-800 mb-2">{trend.month}</div>
                  <div className="space-y-2">
                    <div className="text-xs text-purple-600">
                      <div className="font-semibold">{trend.completed_tasks}</div>
                      <div>Ukończone</div>
                    </div>
                    <div className="text-xs text-purple-600">
                      <div className="font-semibold">{trend.new_tasks}</div>
                      <div>Nowe</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full mt-4"
            onClick={() => exportReport('trends')}
            disabled={monthlyTrends.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Eksportuj raport
          </Button>
        </CardContent>
      </Card>

      {/* Szybkie akcje */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-800">
            <Activity className="h-5 w-5" />
            Szybkie akcje
          </CardTitle>
          <CardDescription className="text-blue-700">
            Generuj i eksportuj raporty w różnych formatach
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Button variant="outline" size="sm" onClick={() => exportReport('summary')}>
              <Download className="h-4 w-4 mr-2" />
              Raport podsumowujący
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportReport('performance')}>
              <Award className="h-4 w-4 mr-2" />
              Raport wydajności
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportReport('timeline')}>
              <Calendar className="h-4 w-4 mr-2" />
              Harmonogram zadań
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportReport('analytics')}>
              <BarChart3 className="h-4 w-4 mr-2" />
              Analiza szczegółowa
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
