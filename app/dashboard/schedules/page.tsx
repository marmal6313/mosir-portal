'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/useToast'
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  RefreshCw,
  Download,
  Plus,
  Edit2,
  Trash2,
  Table,
  BarChart3,
  CalendarDays
} from 'lucide-react'

type WorkSchedule = Database['public']['Tables']['work_schedules']['Row'] & {
  user?: Database['public']['Tables']['users']['Row']
}

type User = Database['public']['Tables']['users']['Row']

type Department = {
  id: number
  name: string
}

type DaySchedule = {
  date: string
  schedule: WorkSchedule | null
}

// Shift type definitions matching Excel patterns
const SHIFT_TYPES = {
  '1': { label: '1 (06:00-13:00)', start: '06:00', end: '13:00', hours: 7, color: 'bg-blue-100 text-blue-800' },
  '2': { label: '2 (15:00-22:00)', start: '15:00', end: '22:00', hours: 7, color: 'bg-green-100 text-green-800' },
  '12': { label: '12 (09:00-21:00)', start: '09:00', end: '21:00', hours: 12, color: 'bg-purple-100 text-purple-800' },
  'wn': { label: 'wn (wolna niedziela)', start: '00:00', end: '00:00', hours: 0, color: 'bg-gray-100 text-gray-600' },
  'on': { label: 'on (odbiór niedzieli)', start: '00:00', end: '00:00', hours: 0, color: 'bg-cyan-100 text-cyan-800' },
  'wp': { label: 'wp (wolne)', start: '00:00', end: '00:00', hours: 0, color: 'bg-yellow-100 text-yellow-800' },
  'dw': { label: 'dw (dzień wolny)', start: '00:00', end: '00:00', hours: 0, color: 'bg-orange-100 text-orange-800' },
} as const

type ShiftTypeKey = keyof typeof SHIFT_TYPES

export default function SchedulesPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<User[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [schedules, setSchedules] = useState<WorkSchedule[]>([])

  // View mode
  const [viewMode, setViewMode] = useState<'grid' | 'timeline' | 'cards'>('grid')

  // Week navigation
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()))
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')

  // Copy week dialog
  const [copyWeekDialogOpen, setCopyWeekDialogOpen] = useState(false)
  const [copyWeekUserId, setCopyWeekUserId] = useState<string | null>(null)
  const [copyWeekTargetDate, setCopyWeekTargetDate] = useState('')

  useEffect(() => {
    fetchData()
  }, [weekStart, selectedDepartment])

  function getWeekStart(date: Date): Date {
    const d = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Monday as first day
    return new Date(d.setDate(diff))
  }

  function formatDate(date: Date): string {
    return date.toISOString().split('T')[0]
  }

  function getWeekDates(startDate: Date): Date[] {
    const dates = []
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate)
      date.setDate(startDate.getDate() + i)
      dates.push(date)
    }
    return dates
  }

  function previousWeek() {
    const newStart = new Date(weekStart)
    newStart.setDate(newStart.getDate() - 7)
    setWeekStart(newStart)
  }

  function nextWeek() {
    const newStart = new Date(weekStart)
    newStart.setDate(newStart.getDate() + 7)
    setWeekStart(newStart)
  }

  function goToToday() {
    setWeekStart(getWeekStart(new Date()))
  }

  async function fetchData() {
    setLoading(true)
    await Promise.all([fetchUsers(), fetchDepartments(), fetchSchedules()])
    setLoading(false)
  }

  async function fetchUsers() {
    const { data } = await supabase
      .from('users')
      .select('*')
      .order('last_name')
    if (data) setUsers(data)
  }

  async function fetchDepartments() {
    const { data } = await supabase
      .from('departments')
      .select('id, name')
      .order('name')
    if (data) setDepartments(data)
  }

  async function fetchSchedules() {
    const weekDates = getWeekDates(weekStart)
    const startDate = formatDate(weekDates[0])
    const endDate = formatDate(weekDates[6])

    const { data } = await supabase
      .from('work_schedules')
      .select(`
        *,
        user:users(*)
      `)
      .gte('schedule_date', startDate)
      .lte('schedule_date', endDate)
      .order('schedule_date')

    setSchedules(data || [])
  }

  async function saveSchedule(userId: string, date: string, shiftType: ShiftTypeKey) {
    const shift = SHIFT_TYPES[shiftType]
    const isOff = ['wn', 'on', 'wp', 'dw'].includes(shiftType)

    const payload = {
      user_id: userId,
      schedule_date: date,
      shift_start: shift.start,
      shift_end: shift.end,
      shift_type: shiftType,
      is_day_off: isOff,
      notes: shift.label
    }

    const { error } = await supabase
      .from('work_schedules')
      .upsert([payload], { onConflict: 'user_id,schedule_date' })

    if (error) {
      toast({ title: 'Błąd', description: error.message, variant: 'destructive' })
    } else {
      fetchSchedules()
    }
  }

  async function deleteSchedule(scheduleId: string) {
    const { error } = await supabase
      .from('work_schedules')
      .delete()
      .eq('id', scheduleId)

    if (error) {
      toast({ title: 'Błąd', description: error.message, variant: 'destructive' })
    } else {
      toast({ title: 'Sukces', description: 'Grafik usunięty' })
      fetchSchedules()
    }
  }

  async function copyWeek(userId: string, sourceWeekStart: Date, targetWeekStart: Date) {
    const sourceDates = getWeekDates(sourceWeekStart)
    const targetDates = getWeekDates(targetWeekStart)

    // Get source week schedules
    const { data: sourceSchedules } = await supabase
      .from('work_schedules')
      .select('*')
      .eq('user_id', userId)
      .gte('schedule_date', formatDate(sourceDates[0]))
      .lte('schedule_date', formatDate(sourceDates[6]))

    if (!sourceSchedules || sourceSchedules.length === 0) {
      toast({ title: 'Błąd', description: 'Brak grafików do skopiowania', variant: 'destructive' })
      return
    }

    // Create new schedules for target week
    const newSchedules = sourceSchedules.map((s, idx) => ({
      user_id: userId,
      schedule_date: formatDate(targetDates[idx]),
      shift_start: s.shift_start,
      shift_end: s.shift_end,
      shift_type: s.shift_type,
      is_day_off: s.is_day_off,
      notes: s.notes
    }))

    const { error } = await supabase
      .from('work_schedules')
      .upsert(newSchedules, { onConflict: 'user_id,schedule_date' })

    if (error) {
      toast({ title: 'Błąd', description: error.message, variant: 'destructive' })
    } else {
      toast({ title: 'Sukces', description: `Skopiowano ${newSchedules.length} grafików` })
      fetchSchedules()
      setCopyWeekDialogOpen(false)
    }
  }

  async function fillStandardWeek(userId: string, weekStart: Date) {
    // Find user to get their default shift preferences
    const user = users.find(u => u.id === userId)
    const shiftStart = user?.default_shift_start || '08:00'
    const shiftEnd = user?.default_shift_end || '16:00'
    const shiftType = user?.default_shift_type || 'standard'

    const dates = getWeekDates(weekStart)
    const newSchedules = dates.map((date, idx) => {
      const dayOfWeek = date.getDay()
      // Skip weekends
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        return null
      }
      return {
        user_id: userId,
        schedule_date: formatDate(date),
        shift_start: shiftStart,
        shift_end: shiftEnd,
        shift_type: shiftType,
        is_day_off: false,
        notes: `Standard ${shiftStart}-${shiftEnd}`
      }
    }).filter(Boolean)

    const { error } = await supabase
      .from('work_schedules')
      .upsert(newSchedules, { onConflict: 'user_id,schedule_date' })

    if (error) {
      toast({ title: 'Błąd', description: error.message, variant: 'destructive' })
    } else {
      toast({ title: 'Sukces', description: 'Wypełniono standardowym grafikiem' })
      fetchSchedules()
    }
  }

  function exportToPDF() {
    // Simple CSV export for now
    const weekDates = getWeekDates(weekStart)
    const filteredUsers = getFilteredUsers()

    let csv = 'Pracownik,' + weekDates.map(d => d.toLocaleDateString('pl-PL', { weekday: 'short', day: '2-digit', month: 'short' })).join(',') + ',SUMA\n'

    filteredUsers.forEach(user => {
      const userSchedules = getUserWeekSchedules(user.id)
      const totalHours = calculateWeekHours(userSchedules)

      const row = [
        `${user.first_name} ${user.last_name}`,
        ...weekDates.map(date => {
          const schedule = userSchedules.find(s => s.date === formatDate(date))?.schedule
          if (!schedule) return '-'
          const shiftKey = schedule.shift_type as ShiftTypeKey
          return SHIFT_TYPES[shiftKey]?.label.split(' ')[0] || schedule.shift_type
        }),
        `${totalHours}h`
      ]
      csv += row.join(',') + '\n'
    })

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `grafik_${formatDate(weekStart)}.csv`
    link.click()
  }

  function getUserWeekSchedules(userId: string): DaySchedule[] {
    const weekDates = getWeekDates(weekStart)
    return weekDates.map(date => {
      const dateStr = formatDate(date)
      const schedule = schedules.find(s => s.user_id === userId && s.schedule_date === dateStr)
      return { date: dateStr, schedule: schedule || null }
    })
  }

  function calculateWeekHours(daySchedules: DaySchedule[]): number {
    return daySchedules.reduce((sum, day) => {
      if (!day.schedule) return sum
      const shiftKey = day.schedule.shift_type as ShiftTypeKey
      return sum + (SHIFT_TYPES[shiftKey]?.hours || 0)
    }, 0)
  }

  function getFilteredUsers(): User[] {
    let filtered = users

    if (selectedDepartment !== 'all') {
      filtered = filtered.filter(u => u.department_id?.toString() === selectedDepartment)
    }

    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      filtered = filtered.filter(u =>
        `${u.first_name} ${u.last_name}`.toLowerCase().includes(search) ||
        u.email?.toLowerCase().includes(search)
      )
    }

    return filtered
  }

  function getAllowedShiftTypes(user: User): ShiftTypeKey[] {
    if (!user.allowed_shift_types || user.allowed_shift_types.length === 0) {
      return Object.keys(SHIFT_TYPES) as ShiftTypeKey[]
    }
    return user.allowed_shift_types.filter(type => type in SHIFT_TYPES) as ShiftTypeKey[]
  }

  const weekDates = getWeekDates(weekStart)
  const filteredUsers = getFilteredUsers()

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Grafiki pracy</h1>
        <p className="text-muted-foreground">System harmonogramowania z 3 widokami</p>
      </div>

      {/* Week Navigation */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Button onClick={previousWeek} variant="outline" size="sm">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button onClick={goToToday} variant="outline" size="sm">
                Dzisiaj
              </Button>
              <Button onClick={nextWeek} variant="outline" size="sm">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="text-lg font-semibold">
              Tydzień: {weekDates[0].toLocaleDateString('pl-PL', { day: '2-digit', month: 'long' })} - {weekDates[6].toLocaleDateString('pl-PL', { day: '2-digit', month: 'long', year: 'numeric' })}
            </div>

            <Button onClick={exportToPDF} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Eksport CSV
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Dział</Label>
              <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Wszystkie działy</SelectItem>
                  {departments.map(d => (
                    <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Szukaj pracownika</Label>
              <Input
                placeholder="Imię, nazwisko..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex items-end">
              <Button onClick={fetchData} variant="outline" className="w-full">
                <RefreshCw className="h-4 w-4 mr-2" />
                Odśwież
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Legenda</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            {Object.entries(SHIFT_TYPES).map(([key, shift]) => (
              <div key={key} className="flex items-center gap-2">
                <Badge className={shift.color}>{key}</Badge>
                <span className="text-muted-foreground">{shift.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* View Tabs */}
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'grid' | 'timeline' | 'cards')}>
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="grid" className="flex items-center gap-2">
            <Table className="h-4 w-4" />
            <span className="hidden sm:inline">Excel Grid</span>
          </TabsTrigger>
          <TabsTrigger value="timeline" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Timeline</span>
          </TabsTrigger>
          <TabsTrigger value="cards" className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            <span className="hidden sm:inline">Karty</span>
          </TabsTrigger>
        </TabsList>

        {/* Excel-like Grid View */}
        <TabsContent value="grid" className="space-y-4">
          {loading ? (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">Ładowanie...</p>
              </CardContent>
            </Card>
          ) : filteredUsers.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">Brak pracowników</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="sticky left-0 z-10 bg-muted/50 border-r p-3 text-left font-semibold min-w-[200px]">
                          Pracownik
                        </th>
                        {weekDates.map(date => {
                          const dayName = date.toLocaleDateString('pl-PL', { weekday: 'short' })
                          const dayNum = date.getDate()
                          const monthName = date.toLocaleDateString('pl-PL', { month: 'short' })
                          const isWeekend = date.getDay() === 0 || date.getDay() === 6
                          return (
                            <th
                              key={formatDate(date)}
                              className={`border-r p-2 text-center text-xs font-semibold min-w-[100px] ${
                                isWeekend ? 'bg-muted' : ''
                              }`}
                            >
                              <div>{dayName}</div>
                              <div className="text-base font-bold">{dayNum}</div>
                              <div className="text-muted-foreground">{monthName}</div>
                            </th>
                          )
                        })}
                        <th className="border-r p-3 text-center font-semibold min-w-[80px] bg-yellow-50">
                          SUMA
                        </th>
                        <th className="p-3 text-center font-semibold min-w-[120px]">
                          Akcje
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map(user => {
                        const userSchedules = getUserWeekSchedules(user.id)
                        const totalHours = calculateWeekHours(userSchedules)

                        return (
                          <tr key={user.id} className="border-b hover:bg-muted/30">
                            <td className="sticky left-0 z-10 bg-background border-r p-3">
                              <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{user.first_name} {user.last_name}</span>
                                  {user.is_office_worker && (
                                    <Badge variant="outline" className="text-xs">Biuro</Badge>
                                  )}
                                </div>
                                <span className="text-xs text-muted-foreground">{user.position || user.email}</span>
                              </div>
                            </td>
                            {weekDates.map((date, idx) => {
                              const dateStr = formatDate(date)
                              const daySchedule = userSchedules[idx]
                              const schedule = daySchedule.schedule
                              const isWeekend = date.getDay() === 0 || date.getDay() === 6

                              return (
                                <td
                                  key={dateStr}
                                  className={`border-r p-2 text-center ${isWeekend ? 'bg-muted/30' : ''}`}
                                >
                                  {schedule ? (
                                    <div className="space-y-1">
                                      <Select
                                        value={schedule.shift_type}
                                        onValueChange={(value) => saveSchedule(user.id, dateStr, value as ShiftTypeKey)}
                                      >
                                        <SelectTrigger className="h-8 text-xs">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {getAllowedShiftTypes(user).map(key => (
                                            <SelectItem key={key} value={key}>{key}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      <div className="text-xs text-muted-foreground">
                                        {SHIFT_TYPES[schedule.shift_type as ShiftTypeKey]?.hours || 0}h
                                      </div>
                                    </div>
                                  ) : (
                                    <Select onValueChange={(value) => saveSchedule(user.id, dateStr, value as ShiftTypeKey)}>
                                      <SelectTrigger className="h-8 text-xs">
                                        <SelectValue placeholder="-" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {getAllowedShiftTypes(user).map(key => (
                                          <SelectItem key={key} value={key}>{key}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  )}
                                </td>
                              )
                            })}
                            <td className="border-r p-3 text-center bg-yellow-50">
                              <div className="text-lg font-bold">{totalHours}h</div>
                            </td>
                            <td className="p-2">
                              <div className="flex gap-1 justify-center">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => fillStandardWeek(user.id, weekStart)}
                                  title="Wypełnij standardem"
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setCopyWeekUserId(user.id)
                                    setCopyWeekDialogOpen(true)
                                  }}
                                  title="Kopiuj tydzień"
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Timeline/Gantt View */}
        <TabsContent value="timeline" className="space-y-4">
          {loading ? (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">Ładowanie...</p>
              </CardContent>
            </Card>
          ) : filteredUsers.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">Brak pracowników</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredUsers.map(user => {
                const userSchedules = getUserWeekSchedules(user.id)
                const totalHours = calculateWeekHours(userSchedules)

                return (
                  <Card key={user.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        {/* User info column */}
                        <div className="w-48 flex-shrink-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-sm">{user.first_name} {user.last_name}</span>
                            {user.is_office_worker && (
                              <Badge variant="outline" className="text-xs">Biuro</Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mb-2">{user.position || user.email}</div>
                          <Badge variant="outline" className="font-bold">{totalHours}h</Badge>
                          <div className="flex gap-1 mt-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => fillStandardWeek(user.id, weekStart)}
                              className="text-xs px-2 py-1 h-auto"
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Standard
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setCopyWeekUserId(user.id)
                                setCopyWeekDialogOpen(true)
                              }}
                              className="text-xs px-2 py-1 h-auto"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>

                        {/* Timeline column */}
                        <div className="flex-1">
                          <div className="grid grid-cols-7 gap-1 mb-2">
                            {weekDates.map(date => {
                              const dayName = date.toLocaleDateString('pl-PL', { weekday: 'short' })
                              const dayNum = date.getDate()
                              return (
                                <div key={formatDate(date)} className="text-center">
                                  <div className="text-xs text-muted-foreground">{dayName}</div>
                                  <div className="text-sm font-bold">{dayNum}</div>
                                </div>
                              )
                            })}
                          </div>
                          <div className="relative h-20 border rounded bg-gradient-to-r from-gray-50 to-white">
                            {/* Time grid background */}
                            <div className="absolute inset-0 grid grid-cols-7">
                              {weekDates.map((date, idx) => {
                                const isWeekend = date.getDay() === 0 || date.getDay() === 6
                                return (
                                  <div
                                    key={idx}
                                    className={`border-r last:border-r-0 ${isWeekend ? 'bg-muted/30' : ''}`}
                                  />
                                )
                              })}
                            </div>

                            {/* Shift blocks */}
                            <div className="absolute inset-0 grid grid-cols-7 gap-1 p-1">
                              {userSchedules.map((daySchedule, idx) => {
                                const schedule = daySchedule.schedule
                                const dateStr = formatDate(weekDates[idx])

                                return (
                                  <div key={dateStr} className="relative">
                                    {schedule ? (
                                      <div className="h-full flex flex-col gap-1">
                                        <div
                                          className={`flex-1 rounded p-1 ${
                                            SHIFT_TYPES[schedule.shift_type as ShiftTypeKey]?.color || 'bg-gray-200'
                                          } flex flex-col items-center justify-center cursor-pointer hover:opacity-80 transition-opacity`}
                                          onClick={() => {
                                            // Quick edit on click
                                          }}
                                        >
                                          <div className="text-xs font-bold">{schedule.shift_type}</div>
                                          <div className="text-xs">
                                            {schedule.shift_start.substring(0, 5)}
                                          </div>
                                          <div className="text-xs">
                                            {schedule.shift_end.substring(0, 5)}
                                          </div>
                                        </div>
                                        <div className="flex gap-0.5">
                                          <Select
                                            value={schedule.shift_type}
                                            onValueChange={(value) => saveSchedule(user.id, dateStr, value as ShiftTypeKey)}
                                          >
                                            <SelectTrigger className="h-6 text-xs flex-1">
                                              <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {getAllowedShiftTypes(user).map(key => (
                                                <SelectItem key={key} value={key}>{key}</SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-6 w-6 p-0"
                                            onClick={() => deleteSchedule(schedule.id)}
                                          >
                                            <Trash2 className="h-3 w-3 text-destructive" />
                                          </Button>
                                        </div>
                                      </div>
                                    ) : (
                                      <Select onValueChange={(value) => saveSchedule(user.id, dateStr, value as ShiftTypeKey)}>
                                        <SelectTrigger className="h-full text-xs">
                                          <SelectValue placeholder="+" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {getAllowedShiftTypes(user).map(key => (
                                            <SelectItem key={key} value={key}>{key}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        {/* Weekly Cards View */}
        <TabsContent value="cards" className="space-y-4">
          {loading ? (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">Ładowanie...</p>
              </CardContent>
            </Card>
          ) : filteredUsers.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">Brak pracowników</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredUsers.map(user => {
                const userSchedules = getUserWeekSchedules(user.id)
                const totalHours = calculateWeekHours(userSchedules)

                return (
                  <Card key={user.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-lg">{user.first_name} {user.last_name}</CardTitle>
                            {user.is_office_worker && (
                              <Badge variant="outline" className="text-xs">Biuro</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {user.email}
                            {user.default_shift_start && user.default_shift_end && (
                              <span className="ml-2">• {user.default_shift_start.substring(0, 5)}-{user.default_shift_end.substring(0, 5)}</span>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-lg font-bold">
                            {totalHours}h
                          </Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => fillStandardWeek(user.id, weekStart)}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Standard
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setCopyWeekUserId(user.id)
                              setCopyWeekDialogOpen(true)
                            }}
                          >
                            <Copy className="h-4 w-4 mr-1" />
                            Kopiuj tydzień
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-7 gap-2">
                        {weekDates.map((date, idx) => {
                          const dateStr = formatDate(date)
                          const daySchedule = userSchedules[idx]
                          const schedule = daySchedule.schedule
                          const dayName = date.toLocaleDateString('pl-PL', { weekday: 'short' })
                          const dayNum = date.getDate()
                          const isWeekend = date.getDay() === 0 || date.getDay() === 6

                          return (
                            <div
                              key={dateStr}
                              className={`border rounded p-2 ${isWeekend ? 'bg-muted/50' : ''}`}
                            >
                              <div className="text-center mb-2">
                                <div className="text-xs font-medium text-muted-foreground">{dayName}</div>
                                <div className="text-sm font-bold">{dayNum}</div>
                              </div>

                              {schedule ? (
                                <div className="space-y-1">
                                  <Badge className={`w-full justify-center ${SHIFT_TYPES[schedule.shift_type as ShiftTypeKey]?.color || 'bg-gray-100'}`}>
                                    {schedule.shift_type}
                                  </Badge>
                                  <div className="text-xs text-center text-muted-foreground">
                                    {schedule.shift_start.substring(0, 5)} - {schedule.shift_end.substring(0, 5)}
                                  </div>
                                  <div className="flex gap-1">
                                    <Select
                                      value={schedule.shift_type}
                                      onValueChange={(value) => saveSchedule(user.id, dateStr, value as ShiftTypeKey)}
                                    >
                                      <SelectTrigger className="h-7 text-xs">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {getAllowedShiftTypes(user).map(key => (
                                          <SelectItem key={key} value={key}>{key}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 w-7 p-0"
                                      onClick={() => deleteSchedule(schedule.id)}
                                    >
                                      <Trash2 className="h-3 w-3 text-destructive" />
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <Select onValueChange={(value) => saveSchedule(user.id, dateStr, value as ShiftTypeKey)}>
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="Dodaj" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {getAllowedShiftTypes(user).map(key => (
                                      <SelectItem key={key} value={key}>{key}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Copy Week Dialog */}
      <Dialog open={copyWeekDialogOpen} onOpenChange={setCopyWeekDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kopiuj tydzień</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Skopiuj grafiki z obecnego tygodnia ({formatDate(weekStart)}) do wybranego tygodnia:
            </p>
            <div>
              <Label>Data docelowa (wybierz dowolny dzień z tygodnia)</Label>
              <Input
                type="date"
                value={copyWeekTargetDate}
                onChange={(e) => setCopyWeekTargetDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCopyWeekDialogOpen(false)}>
              Anuluj
            </Button>
            <Button
              onClick={() => {
                if (copyWeekUserId && copyWeekTargetDate) {
                  const targetWeek = getWeekStart(new Date(copyWeekTargetDate))
                  copyWeek(copyWeekUserId, weekStart, targetWeek)
                }
              }}
            >
              Kopiuj
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
