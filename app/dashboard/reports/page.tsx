'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuthContext } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { fetchUserDepartmentIds } from '@/hooks/useUserDepartments'
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown,
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
  FileSpreadsheet,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Info,
  ChevronRight
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer, AreaChart, Area
} from 'recharts'

// ── Types ──────────────────────────────────────────────

interface TaskRow {
  id: string
  title: string
  status: string
  priority: string
  department_id: number | null
  assigned_to: string | null
  created_at: string
  updated_at: string
  due_date: string | null
  departments?: { name: string } | null
  assigned_user?: { first_name: string; last_name: string } | null
}

interface TaskStats {
  total: number
  completed: number
  inProgress: number
  pending: number
  overdue: number
  completionRate: number
  avgCompletionDays: number
}

interface DepartmentStats {
  department_name: string
  total: number
  completed: number
  in_progress: number
  pending: number
  overdue: number
  completion_rate: number
}

interface UserPerformance {
  user_name: string
  completed: number
  total: number
  in_progress: number
  overdue: number
  completion_rate: number
  avg_days: number
}

interface MonthlyTrend {
  month: string
  month_short: string
  created: number
  completed: number
  overdue: number
}

interface DepartmentOption {
  id: number
  name: string
}

// ── Constants ──────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  completed: '#22c55e',
  in_progress: '#3b82f6',
  pending: '#f59e0b',
  overdue: '#ef4444',
}

const STATUS_LABELS: Record<string, string> = {
  completed: 'Ukończone',
  in_progress: 'W trakcie',
  pending: 'Oczekujące',
  overdue: 'Po terminie',
}

const PRIORITY_LABELS: Record<string, string> = {
  critical: 'Krytyczny',
  high: 'Wysoki',
  medium: 'Średni',
  low: 'Niski',
}

const CHART_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316']

// ── CSV Export ─────────────────────────────────────────

function downloadCSV(filename: string, headers: string[], rows: string[][]) {
  const BOM = '\uFEFF'
  const csvContent = BOM + [
    headers.join(';'),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
  ].join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

// ── Component ──────────────────────────────────────────

export default function ReportsPage() {
  const { profile } = useAuthContext()

  // State
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPeriod, setSelectedPeriod] = useState('30')
  const [selectedDepartment, setSelectedDepartment] = useState('all')
  const [departments, setDepartments] = useState<DepartmentOption[]>([])
  const [allTasks, setAllTasks] = useState<TaskRow[]>([])
  const [activeTab, setActiveTab] = useState('overview')

  // ── Data Loading ─────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!profile) return
    setLoading(true)
    setError(null)

    try {
      // Load departments
      const { data: deptData } = await supabase.from('departments').select('id, name').order('name')
      if (deptData) setDepartments(deptData)

      // Load tasks with relations
      let query = supabase
        .from('tasks')
        .select(`
          id, title, status, priority, department_id, assigned_to,
          created_at, updated_at, due_date,
          departments!inner(name),
          assigned_user:users!assigned_to(first_name, last_name)
        `)

      // Multi-department filter for kierownik/pracownik
      if ((profile.role === 'kierownik' || profile.role === 'pracownik') && profile.id) {
        const deptIds = await fetchUserDepartmentIds(profile.id)
        if (deptIds.length > 0) {
          query = query.in('department_id', deptIds)
        }
      }

      // Period filter
      const daysAgo = parseInt(selectedPeriod)
      if (daysAgo < 9999) {
        const dateFilter = new Date()
        dateFilter.setDate(dateFilter.getDate() - daysAgo)
        query = query.gte('created_at', dateFilter.toISOString())
      }

      const { data: tasks, error: tasksError } = await query
      if (tasksError) throw tasksError

      setAllTasks((tasks as TaskRow[]) || [])
    } catch (err) {
      console.error('Error loading reports:', err)
      setError('Wystąpił błąd podczas ładowania raportów.')
    } finally {
      setLoading(false)
    }
  }, [profile, selectedPeriod])

  useEffect(() => {
    if (profile) loadData()
  }, [profile, selectedPeriod, loadData])

  // ── Filtered Tasks ───────────────────────────────────

  const filteredTasks = useMemo(() => {
    if (selectedDepartment === 'all') return allTasks
    const deptId = parseInt(selectedDepartment)
    return allTasks.filter(t => t.department_id === deptId)
  }, [allTasks, selectedDepartment])

  // ── Computed Stats ───────────────────────────────────

  const taskStats = useMemo<TaskStats>(() => {
    const now = new Date()
    const tasks = filteredTasks
    const total = tasks.length
    const completed = tasks.filter(t => t.status === 'completed').length
    const inProgress = tasks.filter(t => t.status === 'in_progress').length
    const pending = tasks.filter(t => t.status === 'pending').length
    const overdue = tasks.filter(t => {
      if (t.status === 'completed') return false
      if (!t.due_date) return false
      return new Date(t.due_date) < now
    }).length

    // Average completion time
    const completedTasks = tasks.filter(t => t.status === 'completed' && t.created_at && t.updated_at)
    let avgDays = 0
    if (completedTasks.length > 0) {
      const totalMs = completedTasks.reduce((sum, t) => {
        return sum + (new Date(t.updated_at).getTime() - new Date(t.created_at).getTime())
      }, 0)
      avgDays = Math.round(totalMs / completedTasks.length / (1000 * 60 * 60 * 24) * 10) / 10
    }

    return {
      total,
      completed,
      inProgress,
      pending,
      overdue,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      avgCompletionDays: avgDays,
    }
  }, [filteredTasks])

  const departmentStats = useMemo<DepartmentStats[]>(() => {
    const now = new Date()
    const map = new Map<string, { total: number; completed: number; in_progress: number; pending: number; overdue: number }>()

    filteredTasks.forEach(task => {
      const name = task.departments?.name || 'Nieznany'
      const cur = map.get(name) || { total: 0, completed: 0, in_progress: 0, pending: 0, overdue: 0 }
      cur.total++
      if (task.status === 'completed') cur.completed++
      else if (task.status === 'in_progress') cur.in_progress++
      else cur.pending++
      if (task.status !== 'completed' && task.due_date && new Date(task.due_date) < now) cur.overdue++
      map.set(name, cur)
    })

    return Array.from(map.entries())
      .map(([name, d]) => ({
        department_name: name,
        ...d,
        completion_rate: d.total > 0 ? Math.round((d.completed / d.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total)
  }, [filteredTasks])

  const userPerformance = useMemo<UserPerformance[]>(() => {
    const now = new Date()
    const map = new Map<string, { completed: number; total: number; in_progress: number; overdue: number; totalMs: number }>()

    filteredTasks.forEach(task => {
      const user = task.assigned_user
      const name = user ? `${user.first_name} ${user.last_name}` : 'Nieprzypisane'
      const cur = map.get(name) || { completed: 0, total: 0, in_progress: 0, overdue: 0, totalMs: 0 }
      cur.total++
      if (task.status === 'completed') {
        cur.completed++
        if (task.created_at && task.updated_at) {
          cur.totalMs += new Date(task.updated_at).getTime() - new Date(task.created_at).getTime()
        }
      }
      if (task.status === 'in_progress') cur.in_progress++
      if (task.status !== 'completed' && task.due_date && new Date(task.due_date) < now) cur.overdue++
      map.set(name, cur)
    })

    return Array.from(map.entries())
      .map(([name, d]) => ({
        user_name: name,
        completed: d.completed,
        total: d.total,
        in_progress: d.in_progress,
        overdue: d.overdue,
        completion_rate: d.total > 0 ? Math.round((d.completed / d.total) * 100) : 0,
        avg_days: d.completed > 0 ? Math.round(d.totalMs / d.completed / (1000 * 60 * 60 * 24) * 10) / 10 : 0,
      }))
      .sort((a, b) => b.completion_rate - a.completion_rate || b.completed - a.completed)
  }, [filteredTasks])

  const monthlyTrends = useMemo<MonthlyTrend[]>(() => {
    const months = ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
      'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień']
    const monthsShort = ['Sty', 'Lut', 'Mar', 'Kwi', 'Maj', 'Cze', 'Lip', 'Sie', 'Wrz', 'Paź', 'Lis', 'Gru']

    const now = new Date()
    const map = new Map<string, { created: number; completed: number; overdue: number }>()

    // Initialize last 6 months
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      map.set(key, { created: 0, completed: 0, overdue: 0 })
    }

    filteredTasks.forEach(task => {
      if (task.created_at) {
        const d = new Date(task.created_at)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        const cur = map.get(key)
        if (cur) cur.created++
      }
      if (task.status === 'completed' && task.updated_at) {
        const d = new Date(task.updated_at)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        const cur = map.get(key)
        if (cur) cur.completed++
      }
    })

    // Count overdue per month (tasks that were overdue at month end)
    const nowTime = now.getTime()
    filteredTasks.forEach(task => {
      if (task.status !== 'completed' && task.due_date) {
        const due = new Date(task.due_date)
        if (due.getTime() < nowTime) {
          const key = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}`
          const cur = map.get(key)
          if (cur) cur.overdue++
        }
      }
    })

    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, d]) => {
        const [, m] = key.split('-')
        const monthIdx = parseInt(m) - 1
        return {
          month: months[monthIdx],
          month_short: monthsShort[monthIdx],
          ...d,
        }
      })
  }, [filteredTasks])

  // Status distribution for pie chart
  const statusDistribution = useMemo(() => {
    const now = new Date()
    const overdueCount = filteredTasks.filter(t =>
      t.status !== 'completed' && t.due_date && new Date(t.due_date) < now
    ).length

    return [
      { name: 'Ukończone', value: taskStats.completed, color: STATUS_COLORS.completed },
      { name: 'W trakcie', value: taskStats.inProgress, color: STATUS_COLORS.in_progress },
      { name: 'Oczekujące', value: taskStats.pending - overdueCount > 0 ? taskStats.pending : taskStats.pending, color: STATUS_COLORS.pending },
      { name: 'Po terminie', value: overdueCount, color: STATUS_COLORS.overdue },
    ].filter(d => d.value > 0)
  }, [filteredTasks, taskStats])

  // Priority distribution
  const priorityDistribution = useMemo(() => {
    const map = new Map<string, number>()
    filteredTasks.forEach(t => {
      const p = t.priority || 'medium'
      map.set(p, (map.get(p) || 0) + 1)
    })
    return Array.from(map.entries()).map(([name, value]) => ({
      name: PRIORITY_LABELS[name] || name,
      value,
    }))
  }, [filteredTasks])

  // ── Insights ─────────────────────────────────────────

  const insights = useMemo(() => {
    const items: { type: 'positive' | 'warning' | 'neutral'; text: string }[] = []

    if (taskStats.completionRate >= 80) {
      items.push({ type: 'positive', text: `Wskaźnik realizacji ${taskStats.completionRate}% — doskonały wynik.` })
    } else if (taskStats.completionRate >= 50) {
      items.push({ type: 'neutral', text: `Wskaźnik realizacji ${taskStats.completionRate}% — w normie.` })
    } else if (taskStats.total > 0) {
      items.push({ type: 'warning', text: `Wskaźnik realizacji ${taskStats.completionRate}% — wymaga poprawy.` })
    }

    if (taskStats.overdue > 0) {
      const pct = taskStats.total > 0 ? Math.round((taskStats.overdue / taskStats.total) * 100) : 0
      items.push({ type: 'warning', text: `${taskStats.overdue} zadań po terminie (${pct}% wszystkich).` })
    } else if (taskStats.total > 0) {
      items.push({ type: 'positive', text: 'Brak zadań po terminie — wszystko na czas.' })
    }

    if (taskStats.avgCompletionDays > 0) {
      items.push({ type: 'neutral', text: `Średni czas realizacji: ${taskStats.avgCompletionDays} dni.` })
    }

    const topDept = departmentStats[0]
    if (topDept && departmentStats.length > 1) {
      const best = departmentStats.reduce((a, b) => a.completion_rate > b.completion_rate ? a : b)
      items.push({ type: 'positive', text: `Najlepszy dział: ${best.department_name} (${best.completion_rate}% realizacji).` })
    }

    if (userPerformance.length > 0) {
      const topUser = userPerformance[0]
      if (topUser.user_name !== 'Nieprzypisane' && topUser.completed > 0) {
        items.push({ type: 'positive', text: `Najaktywniejszy: ${topUser.user_name} (${topUser.completed} ukończonych, ${topUser.completion_rate}%).` })
      }
    }

    return items
  }, [taskStats, departmentStats, userPerformance])

  // ── Export Handlers ──────────────────────────────────

  const exportTasksSummary = () => {
    downloadCSV('raport_podsumowanie', [
      'Metryka', 'Wartość'
    ], [
      ['Wszystkie zadania', String(taskStats.total)],
      ['Ukończone', String(taskStats.completed)],
      ['W trakcie', String(taskStats.inProgress)],
      ['Oczekujące', String(taskStats.pending)],
      ['Po terminie', String(taskStats.overdue)],
      ['Wskaźnik realizacji (%)', String(taskStats.completionRate)],
      ['Średni czas realizacji (dni)', String(taskStats.avgCompletionDays)],
    ])
  }

  const exportDepartments = () => {
    downloadCSV('raport_dzialy', [
      'Dział', 'Łącznie', 'Ukończone', 'W trakcie', 'Oczekujące', 'Po terminie', 'Realizacja (%)'
    ], departmentStats.map(d => [
      d.department_name, String(d.total), String(d.completed),
      String(d.in_progress), String(d.pending), String(d.overdue), String(d.completion_rate)
    ]))
  }

  const exportUsers = () => {
    downloadCSV('raport_pracownicy', [
      'Pracownik', 'Łącznie', 'Ukończone', 'W trakcie', 'Po terminie', 'Realizacja (%)', 'Śr. czas (dni)'
    ], userPerformance.map(u => [
      u.user_name, String(u.total), String(u.completed),
      String(u.in_progress), String(u.overdue), String(u.completion_rate), String(u.avg_days)
    ]))
  }

  const exportAllTasks = () => {
    downloadCSV('raport_zadania_szczegolowy', [
      'Tytuł', 'Status', 'Priorytet', 'Dział', 'Przypisany', 'Utworzone', 'Termin', 'Zaktualizowane'
    ], filteredTasks.map(t => [
      t.title,
      STATUS_LABELS[t.status] || t.status,
      PRIORITY_LABELS[t.priority] || t.priority,
      t.departments?.name || '-',
      t.assigned_user ? `${t.assigned_user.first_name} ${t.assigned_user.last_name}` : '-',
      t.created_at ? new Date(t.created_at).toLocaleDateString('pl-PL') : '-',
      t.due_date ? new Date(t.due_date).toLocaleDateString('pl-PL') : '-',
      t.updated_at ? new Date(t.updated_at).toLocaleDateString('pl-PL') : '-',
    ]))
  }

  const exportFullReport = () => {
    // Export everything in one file
    const headers = [
      '=== PODSUMOWANIE ===', '', 'Metryka', 'Wartość'
    ]
    const rows: string[][] = [
      ['Wszystkie zadania', String(taskStats.total), '', ''],
      ['Ukończone', String(taskStats.completed), '', ''],
      ['W trakcie', String(taskStats.inProgress), '', ''],
      ['Oczekujące', String(taskStats.pending), '', ''],
      ['Po terminie', String(taskStats.overdue), '', ''],
      ['Realizacja (%)', String(taskStats.completionRate), '', ''],
      ['Śr. czas (dni)', String(taskStats.avgCompletionDays), '', ''],
      ['', '', '', ''],
      ['=== DZIAŁY ===', '', '', ''],
      ['Dział', 'Łącznie', 'Ukończone', 'Realizacja (%)'],
      ...departmentStats.map(d => [d.department_name, String(d.total), String(d.completed), String(d.completion_rate)]),
      ['', '', '', ''],
      ['=== PRACOWNICY ===', '', '', ''],
      ['Pracownik', 'Łącznie', 'Ukończone', 'Realizacja (%)'],
      ...userPerformance.map(u => [u.user_name, String(u.total), String(u.completed), String(u.completion_rate)]),
    ]

    downloadCSV('raport_pelny', ['Kolumna 1', 'Kolumna 2', 'Kolumna 3', 'Kolumna 4'], rows)
  }

  // ── Custom Tooltip for Recharts ──────────────────────

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
    if (!active || !payload) return null
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
        <p className="font-medium text-gray-900 mb-1">{label}</p>
        {payload.map((entry, i) => (
          <p key={i} style={{ color: entry.color }} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: entry.color }} />
            {entry.name}: <span className="font-semibold">{entry.value}</span>
          </p>
        ))}
      </div>
    )
  }

  // ── Render ───────────────────────────────────────────

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
          <AlertTriangle className="h-8 w-8 text-red-600 mx-auto mb-4" />
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={loadData} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Spróbuj ponownie
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* ── Header ── */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-3">
            <BarChart3 className="h-7 w-7 md:h-8 md:w-8 text-blue-600" />
            Raporty i Analizy
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            {filteredTasks.length} zadań w wybranym okresie
            {selectedDepartment !== 'all' && ` • ${departments.find(d => d.id === parseInt(selectedDepartment))?.name}`}
          </p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-44">
              <Calendar className="h-4 w-4 mr-2 text-gray-400" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Ostatnie 7 dni</SelectItem>
              <SelectItem value="30">Ostatnie 30 dni</SelectItem>
              <SelectItem value="90">Ostatnie 3 miesiące</SelectItem>
              <SelectItem value="365">Ostatni rok</SelectItem>
              <SelectItem value="9999">Wszystko</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
            <SelectTrigger className="w-48">
              <Building2 className="h-4 w-4 mr-2 text-gray-400" />
              <SelectValue placeholder="Wszystkie działy" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Wszystkie działy</SelectItem>
              {departments.map(dept => (
                <SelectItem key={dept.id} value={String(dept.id)}>
                  {dept.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button onClick={loadData} variant="outline" size="icon" title="Odśwież">
            <RefreshCw className="h-4 w-4" />
            </Button>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPICard
          title="Wszystkie"
          value={taskStats.total}
          icon={<Target className="h-4 w-4" />}
          color="blue"
        />
        <KPICard
          title="Ukończone"
          value={taskStats.completed}
          subtitle={`${taskStats.completionRate}%`}
          icon={<CheckCircle className="h-4 w-4" />}
          color="green"
        />
        <KPICard
          title="W trakcie"
          value={taskStats.inProgress}
          icon={<Activity className="h-4 w-4" />}
          color="sky"
        />
        <KPICard
          title="Oczekujące"
          value={taskStats.pending}
          icon={<Clock className="h-4 w-4" />}
          color="amber"
        />
        <KPICard
          title="Po terminie"
          value={taskStats.overdue}
          icon={<AlertTriangle className="h-4 w-4" />}
          color="red"
          highlight={taskStats.overdue > 0}
        />
        <KPICard
          title="Śr. czas"
          value={taskStats.avgCompletionDays}
          subtitle="dni"
          icon={<TrendingUp className="h-4 w-4" />}
          color="violet"
        />
      </div>

      {/* ── Insights ── */}
      {insights.length > 0 && (
        <Card className="border-blue-100 bg-blue-50/30">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-2">
              <Info className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-semibold text-blue-800">Podsumowanie</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {insights.map((insight, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  {insight.type === 'positive' && <ArrowUpRight className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />}
                  {insight.type === 'warning' && <ArrowDownRight className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />}
                  {insight.type === 'neutral' && <Minus className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />}
                  <span className="text-gray-700">{insight.text}</span>
                </div>
              ))}
            </div>
            </CardContent>
          </Card>
      )}

      {/* ── Tabs ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="overview" className="gap-1.5">
            <BarChart3 className="h-4 w-4 hidden sm:block" />
            Przegląd
          </TabsTrigger>
          <TabsTrigger value="departments" className="gap-1.5">
            <Building2 className="h-4 w-4 hidden sm:block" />
            Działy
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-1.5">
            <Users className="h-4 w-4 hidden sm:block" />
            Pracownicy
          </TabsTrigger>
          <TabsTrigger value="export" className="gap-1.5">
            <Download className="h-4 w-4 hidden sm:block" />
            Eksport
          </TabsTrigger>
        </TabsList>

        {/* ── Tab: Overview ── */}
        <TabsContent value="overview" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Status Pie Chart */}
            <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="h-5 w-5 text-blue-600" />
                  Rozkład statusów
              </CardTitle>
            </CardHeader>
            <CardContent>
                {statusDistribution.length === 0 ? (
                  <EmptyState text="Brak zadań" />
                ) : (
                  <div className="flex items-center gap-4">
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={statusDistribution}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={85}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {statusDistribution.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-2 min-w-[120px]">
                      {statusDistribution.map((entry, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                          <span className="text-gray-600">{entry.name}</span>
                          <span className="font-semibold ml-auto">{entry.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </CardContent>
          </Card>

            {/* Priority Distribution */}
            <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                  Rozkład priorytetów
              </CardTitle>
            </CardHeader>
            <CardContent>
                {priorityDistribution.length === 0 ? (
                  <EmptyState text="Brak zadań" />
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={priorityDistribution} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" />
                      <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 13 }} />
                      <RechartsTooltip content={<CustomTooltip />} />
                      <Bar dataKey="value" name="Zadania" radius={[0, 6, 6, 0]}>
                        {priorityDistribution.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
            </CardContent>
          </Card>
          </div>

          {/* Monthly Trends */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-purple-600" />
                Trendy miesięczne
              </CardTitle>
              <CardDescription>Liczba utworzonych i ukończonych zadań w ostatnich miesiącach</CardDescription>
            </CardHeader>
            <CardContent>
              {monthlyTrends.every(m => m.created === 0 && m.completed === 0) ? (
                <EmptyState text="Brak danych w wybranym okresie" />
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={monthlyTrends}>
                    <defs>
                      <linearGradient id="colorCreated" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month_short" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <RechartsTooltip content={<CustomTooltip />} />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="created"
                      name="Utworzone"
                      stroke="#3b82f6"
                      fill="url(#colorCreated)"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="completed"
                      name="Ukończone"
                      stroke="#22c55e"
                      fill="url(#colorCompleted)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Departments ── */}
        <TabsContent value="departments" className="space-y-6 mt-4">
        <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-600" />
              Wydajność działów
            </CardTitle>
                <CardDescription>{departmentStats.length} działów</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={exportDepartments} disabled={departmentStats.length === 0}>
                <Download className="h-4 w-4 mr-2" />
                CSV
              </Button>
          </CardHeader>
          <CardContent>
            {departmentStats.length === 0 ? (
                <EmptyState text="Brak danych o działach" />
              ) : (
                <>
                  {/* Bar Chart */}
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={departmentStats} barGap={4} barCategoryGap="20%">
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="department_name" tick={{ fontSize: 12 }} interval={0} angle={departmentStats.length > 4 ? -25 : 0} textAnchor={departmentStats.length > 4 ? 'end' : 'middle'} height={departmentStats.length > 4 ? 60 : 30} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <RechartsTooltip content={<CustomTooltip />} />
                      <Legend />
                      <Bar dataKey="completed" name="Ukończone" fill="#22c55e" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="in_progress" name="W trakcie" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="pending" name="Oczekujące" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="overdue" name="Po terminie" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>

                  {/* Table */}
                  <div className="mt-6 rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Dział</TableHead>
                          <TableHead className="text-center">Łącznie</TableHead>
                          <TableHead className="text-center">Ukończone</TableHead>
                          <TableHead className="text-center">W trakcie</TableHead>
                          <TableHead className="text-center">Po terminie</TableHead>
                          <TableHead className="text-right">Realizacja</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {departmentStats.map(dept => (
                          <TableRow key={dept.department_name}>
                            <TableCell className="font-medium">{dept.department_name}</TableCell>
                            <TableCell className="text-center">{dept.total}</TableCell>
                            <TableCell className="text-center text-green-700">{dept.completed}</TableCell>
                            <TableCell className="text-center text-blue-700">{dept.in_progress}</TableCell>
                            <TableCell className="text-center">
                              {dept.overdue > 0 ? (
                                <Badge variant="destructive" className="text-xs">{dept.overdue}</Badge>
                              ) : (
                                <span className="text-gray-400">0</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center gap-2 justify-end">
                                <Progress value={dept.completion_rate} className="w-16 h-2" />
                                <span className={`text-sm font-semibold ${
                                  dept.completion_rate >= 80 ? 'text-green-700' :
                                  dept.completion_rate >= 50 ? 'text-amber-700' : 'text-red-700'
                                }`}>
                        {dept.completion_rate}%
                                </span>
                    </div>
                            </TableCell>
                          </TableRow>
                ))}
                      </TableBody>
                    </Table>
              </div>
                </>
              )}
          </CardContent>
        </Card>
        </TabsContent>

        {/* ── Tab: Users ── */}
        <TabsContent value="users" className="space-y-6 mt-4">
        <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-5 w-5 text-green-600" />
                  Wydajność pracowników
            </CardTitle>
                <CardDescription>{userPerformance.length} pracowników</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={exportUsers} disabled={userPerformance.length === 0}>
                <Download className="h-4 w-4 mr-2" />
                CSV
              </Button>
          </CardHeader>
          <CardContent>
            {userPerformance.length === 0 ? (
                <EmptyState text="Brak danych o pracownikach" />
              ) : (
                <>
                  {/* Bar Chart */}
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={userPerformance.slice(0, 10)} barGap={4} barCategoryGap="20%">
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="user_name" tick={{ fontSize: 11 }} interval={0} angle={userPerformance.length > 4 ? -25 : 0} textAnchor={userPerformance.length > 4 ? 'end' : 'middle'} height={userPerformance.length > 4 ? 70 : 30} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <RechartsTooltip content={<CustomTooltip />} />
                      <Legend />
                      <Bar dataKey="completed" name="Ukończone" fill="#22c55e" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="in_progress" name="W trakcie" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="overdue" name="Po terminie" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>

                  {/* Full Table */}
                  <div className="mt-6 rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-8">#</TableHead>
                          <TableHead>Pracownik</TableHead>
                          <TableHead className="text-center">Łącznie</TableHead>
                          <TableHead className="text-center">Ukończone</TableHead>
                          <TableHead className="text-center">W trakcie</TableHead>
                          <TableHead className="text-center">Po terminie</TableHead>
                          <TableHead className="text-center">Śr. czas</TableHead>
                          <TableHead className="text-right">Realizacja</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {userPerformance.map((user, i) => (
                          <TableRow key={user.user_name}>
                            <TableCell>
                              {i === 0 && user.completed > 0 ? (
                                <Award className="h-4 w-4 text-yellow-500" />
                              ) : (
                                <span className="text-gray-400 text-xs">{i + 1}</span>
                              )}
                            </TableCell>
                            <TableCell className="font-medium">{user.user_name}</TableCell>
                            <TableCell className="text-center">{user.total}</TableCell>
                            <TableCell className="text-center text-green-700">{user.completed}</TableCell>
                            <TableCell className="text-center text-blue-700">{user.in_progress}</TableCell>
                            <TableCell className="text-center">
                              {user.overdue > 0 ? (
                                <Badge variant="destructive" className="text-xs">{user.overdue}</Badge>
                              ) : (
                                <span className="text-gray-400">0</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center text-gray-600">
                              {user.avg_days > 0 ? `${user.avg_days} d` : '-'}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center gap-2 justify-end">
                                <Progress value={user.completion_rate} className="w-16 h-2" />
                                <span className={`text-sm font-semibold ${
                                  user.completion_rate >= 80 ? 'text-green-700' :
                                  user.completion_rate >= 50 ? 'text-amber-700' : 'text-red-700'
                                }`}>
                          {user.completion_rate}%
                                </span>
                      </div>
                            </TableCell>
                          </TableRow>
                  ))}
                      </TableBody>
                    </Table>
              </div>
                </>
              )}
          </CardContent>
        </Card>
        </TabsContent>

        {/* ── Tab: Export ── */}
        <TabsContent value="export" className="mt-4">
      <Card>
        <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                Eksport raportów
          </CardTitle>
          <CardDescription>
                Pobierz dane w formacie CSV (kompatybilny z Excel, Google Sheets)
          </CardDescription>
        </CardHeader>
        <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <ExportCard
                  title="Raport podsumowujący"
                  description="KPI, statystyki ogólne, wskaźniki realizacji"
                  icon={<BarChart3 className="h-5 w-5 text-blue-600" />}
                  onClick={exportTasksSummary}
                  disabled={taskStats.total === 0}
                />
                <ExportCard
                  title="Raport działów"
                  description="Wydajność działów, porównanie, realizacja"
                  icon={<Building2 className="h-5 w-5 text-indigo-600" />}
                  onClick={exportDepartments}
                  disabled={departmentStats.length === 0}
                />
                <ExportCard
                  title="Raport pracowników"
                  description="Ranking, ukończone zadania, średni czas"
                  icon={<Users className="h-5 w-5 text-green-600" />}
                  onClick={exportUsers}
                  disabled={userPerformance.length === 0}
                />
                <ExportCard
                  title="Szczegółowa lista zadań"
                  description="Wszystkie zadania z filtrów — status, priorytet, daty"
                  icon={<FileSpreadsheet className="h-5 w-5 text-amber-600" />}
                  onClick={exportAllTasks}
                  disabled={filteredTasks.length === 0}
                />
                <ExportCard
                  title="Pełny raport"
                  description="Podsumowanie + działy + pracownicy w jednym pliku"
                  icon={<Download className="h-5 w-5 text-purple-600" />}
                  onClick={exportFullReport}
                  disabled={taskStats.total === 0}
                  highlight
                />
            </div>
        </CardContent>
      </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────

function KPICard({
  title,
  value,
  subtitle,
  icon,
  color,
  highlight = false,
}: {
  title: string
  value: number
  subtitle?: string
  icon: React.ReactNode
  color: 'blue' | 'green' | 'sky' | 'amber' | 'red' | 'violet'
  highlight?: boolean
}) {
  const colorMap = {
    blue: 'from-blue-50 to-blue-100 border-blue-200 text-blue-800',
    green: 'from-green-50 to-green-100 border-green-200 text-green-800',
    sky: 'from-sky-50 to-sky-100 border-sky-200 text-sky-800',
    amber: 'from-amber-50 to-amber-100 border-amber-200 text-amber-800',
    red: 'from-red-50 to-red-100 border-red-200 text-red-800',
    violet: 'from-violet-50 to-violet-100 border-violet-200 text-violet-800',
  }

  return (
    <Card className={`bg-gradient-to-br ${colorMap[color]} ${highlight ? 'ring-2 ring-red-300 animate-pulse' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-1 opacity-80 text-xs font-medium">
          {icon}
          {title}
          </div>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && <div className="text-xs opacity-70 mt-0.5">{subtitle}</div>}
        </CardContent>
      </Card>
  )
}

function ExportCard({
  title,
  description,
  icon,
  onClick,
  disabled = false,
  highlight = false,
}: {
  title: string
  description: string
  icon: React.ReactNode
  onClick: () => void
  disabled?: boolean
  highlight?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        flex items-start gap-4 p-4 rounded-lg border text-left transition-all
        ${disabled
          ? 'opacity-50 cursor-not-allowed bg-gray-50 border-gray-200'
          : highlight
            ? 'bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200 hover:shadow-md hover:border-purple-300'
            : 'bg-white border-gray-200 hover:shadow-md hover:border-blue-300'
        }
      `}
    >
      <div className="shrink-0 mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-gray-900 flex items-center gap-1">
          {title}
          {highlight && <Badge className="text-[10px] ml-1">Rekomendowany</Badge>}
        </div>
        <div className="text-sm text-gray-500 mt-0.5">{description}</div>
      </div>
      <ChevronRight className="h-4 w-4 text-gray-400 shrink-0 mt-1" />
    </button>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="text-center py-12 text-gray-400">
      <BarChart3 className="h-10 w-10 mx-auto mb-2 opacity-30" />
      <p className="text-sm">{text}</p>
    </div>
  )
}
