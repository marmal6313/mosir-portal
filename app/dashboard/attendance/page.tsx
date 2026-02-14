'use client'

import { useEffect, useState, useMemo } from 'react'
import { TableVirtuoso, type TableComponents } from 'react-virtuoso'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar, Clock, Users, AlertCircle, CheckCircle, XCircle, Filter, Download } from 'lucide-react'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'

type AttendanceRecord = Database['public']['Tables']['attendance_records']['Row'] & {
  user?: Database['public']['Tables']['users']['Row']
}

type AttendanceSummary = Database['public']['Tables']['attendance_summary']['Row'] & {
  user?: Database['public']['Tables']['users']['Row']
}

type Stats = {
  totalRecords: number
  presentToday: number
  lateToday: number
  absentToday: number
}

export default function AttendancePage() {
  const [loading, setLoading] = useState(true)
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [summary, setSummary] = useState<AttendanceSummary[]>([])
  const [users, setUsers] = useState<Database['public']['Tables']['users']['Row'][]>([])
  const [stats, setStats] = useState<Stats>({ totalRecords: 0, presentToday: 0, lateToday: 0, absentToday: 0 })

  // Filters
  const [viewMode, setViewMode] = useState<'records' | 'summary'>('summary')
  const [dateFrom, setDateFrom] = useState(() => {
    const date = new Date()
    date.setDate(date.getDate() - 7)
    return date.toISOString().split('T')[0]
  })
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0])
  const [selectedUser, setSelectedUser] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearch = useDebouncedValue(searchTerm, 300)

  // Fetch users
  useEffect(() => {
    async function fetchUsers() {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .order('last_name')

        if (error) {
          console.error('Error fetching users:', error)
          return
        }

        if (data) setUsers(data)
      } catch (error) {
        console.error('Exception fetching users:', error)
      }
    }
    fetchUsers()
  }, [])

  // Fetch data
  useEffect(() => {
    fetchData()
  }, [viewMode, dateFrom, dateTo, selectedUser, debouncedSearch])

  async function fetchData() {
    try {
      setLoading(true)
      console.log('Fetching attendance data...')

      if (viewMode === 'records') {
        await fetchRecords()
      } else {
        await fetchSummary()
      }

      await fetchStats()
      console.log('Attendance data fetched successfully')
    } catch (error) {
      console.error('Error fetching attendance data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function fetchRecords() {
    let query = supabase
      .from('attendance_records')
      .select(`
        *,
        user:users(*)
      `)
      .gte('event_timestamp', `${dateFrom}T00:00:00`)
      .lte('event_timestamp', `${dateTo}T23:59:59`)
      .order('event_timestamp', { ascending: false })

    if (selectedUser !== 'all') {
      query = query.eq('user_id', selectedUser)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching attendance records:', error)
      throw error
    }

    let filtered = data || []
    if (debouncedSearch) {
      const search = debouncedSearch.toLowerCase()
      filtered = filtered.filter(r =>
        `${r.user?.first_name} ${r.user?.last_name}`.toLowerCase().includes(search) ||
        r.user?.email?.toLowerCase().includes(search)
      )
    }

    setRecords(filtered)
  }

  async function fetchSummary() {
    let query = supabase
      .from('attendance_summary')
      .select(`
        *,
        user:users(*)
      `)
      .gte('date', dateFrom)
      .lte('date', dateTo)
      .order('date', { ascending: false })

    if (selectedUser !== 'all') {
      query = query.eq('user_id', selectedUser)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching attendance summary:', error)
      throw error
    }

    let filtered = data || []
    if (debouncedSearch) {
      const search = debouncedSearch.toLowerCase()
      filtered = filtered.filter(s =>
        `${s.user?.first_name} ${s.user?.last_name}`.toLowerCase().includes(search) ||
        s.user?.email?.toLowerCase().includes(search)
      )
    }

    setSummary(filtered)
  }

  async function fetchStats() {
    const today = new Date().toISOString().split('T')[0]

    const { count: totalRecords, error: countError } = await supabase
      .from('attendance_records')
      .select('*', { count: 'exact', head: true })

    if (countError) {
      console.error('Error fetching attendance count:', countError)
      throw countError
    }

    const { data: todaySummary, error: summaryError } = await supabase
      .from('attendance_summary')
      .select('*')
      .eq('date', today)

    if (summaryError) {
      console.error('Error fetching today summary:', summaryError)
      throw summaryError
    }

    const presentToday = todaySummary?.filter(s => s.is_present).length || 0
    const lateToday = todaySummary?.filter(s => s.is_late).length || 0
    const absentToday = todaySummary?.filter(s => s.is_absent).length || 0

    setStats({ totalRecords: totalRecords || 0, presentToday, lateToday, absentToday })
  }

  function exportToCSV() {
    const data = viewMode === 'records' ? records : summary
    if (data.length === 0) return

    let csv = ''
    if (viewMode === 'records') {
      csv = 'Data,Godzina,Pracownik,Typ,Drzwi\n'
      records.forEach(r => {
        const date = new Date(r.event_timestamp).toLocaleDateString('pl-PL')
        const time = new Date(r.event_timestamp).toLocaleTimeString('pl-PL')
        const userName = r.user ? `${r.user.first_name} ${r.user.last_name}` : 'N/A'
        csv += `${date},${time},${userName},${r.event_type},${r.racs_door_name || 'N/A'}\n`
      })
    } else {
      csv = 'Data,Pracownik,Wejście,Wyjście,Godziny,Status\n'
      summary.forEach(s => {
        const date = new Date(s.date).toLocaleDateString('pl-PL')
        const entry = s.first_entry ? new Date(s.first_entry).toLocaleTimeString('pl-PL') : '-'
        const exit = s.last_exit ? new Date(s.last_exit).toLocaleTimeString('pl-PL') : '-'
        const status = s.is_absent ? 'Nieobecny' : s.is_late ? 'Spóźniony' : 'Obecny'
        const userName = s.user ? `${s.user.first_name} ${s.user.last_name}` : 'N/A'
        csv += `${date},${userName},${entry},${exit},${s.total_hours || 0}h,${status}\n`
      })
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `obecnosc_${dateFrom}_${dateTo}.csv`
    link.click()
  }

  const VirtuosoTableComponents: TableComponents<AttendanceRecord | AttendanceSummary> = {
    Table: (props) => <table {...props} className="w-full border-collapse" />,
    TableHead: (props) => <thead {...props} className="bg-muted sticky top-0 z-10" />,
    TableRow: (props) => <tr {...props} className="border-b hover:bg-muted/50" />,
    TableBody: (props) => <tbody {...props} />,
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">System Obecności</h1>
        <p className="text-muted-foreground">Obecności pracowników z systemu Roger RACS-5</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Wszystkie zdarzenia</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalRecords}</div>
            <p className="text-xs text-muted-foreground">Zsynchronizowane</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Obecni dzisiaj</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.presentToday}</div>
            <p className="text-xs text-muted-foreground">Pracowników</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Spóźnienia</CardTitle>
            <AlertCircle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.lateToday}</div>
            <p className="text-xs text-muted-foreground">Dzisiaj</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Nieobecni</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.absentToday}</div>
            <p className="text-xs text-muted-foreground">Dzisiaj</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Select value={viewMode} onValueChange={(v: any) => setViewMode(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="summary">Podsumowanie dzienne</SelectItem>
                <SelectItem value="records">Wszystkie zdarzenia</SelectItem>
              </SelectContent>
            </Select>

            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              placeholder="Data od"
            />

            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              placeholder="Data do"
            />

            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger>
                <SelectValue placeholder="Wszyscy pracownicy" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Wszyscy pracownicy</SelectItem>
                {users.map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              placeholder="Szukaj..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex gap-2 mt-4">
            <Button onClick={() => fetchData()} variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-2" />
              Odśwież
            </Button>
            <Button onClick={exportToCSV} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Eksportuj CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center">
              <p className="text-muted-foreground">Ładowanie...</p>
            </div>
          ) : viewMode === 'summary' ? (
            <TableVirtuoso
              data={summary}
              components={VirtuosoTableComponents}
              style={{ height: '600px' }}
              fixedHeaderContent={() => (
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Data</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Pracownik</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Pierwsze wejście</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Ostatnie wyjście</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Godziny</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                </tr>
              )}
              itemContent={(index, item) => {
                const s = item as AttendanceSummary
                return (
                  <>
                    <td className="px-4 py-3 text-sm">
                      {new Date(s.date).toLocaleDateString('pl-PL')}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium">
                      {s.user ? `${s.user.first_name} ${s.user.last_name}` : 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {s.first_entry ? new Date(s.first_entry).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }) : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {s.last_exit ? new Date(s.last_exit).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }) : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {s.total_hours ? `${s.total_hours}h` : '-'}
                    </td>
                    <td className="px-4 py-3">
                      {s.is_absent ? (
                        <Badge variant="destructive">Nieobecny</Badge>
                      ) : s.is_late ? (
                        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Spóźniony</Badge>
                      ) : s.is_early_leave ? (
                        <Badge variant="secondary" className="bg-orange-100 text-orange-800">Wczesne wyjście</Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-green-100 text-green-800">Obecny</Badge>
                      )}
                    </td>
                  </>
                )
              }}
            />
          ) : (
            <TableVirtuoso
              data={records}
              components={VirtuosoTableComponents}
              style={{ height: '600px' }}
              fixedHeaderContent={() => (
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Data i godzina</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Pracownik</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Typ</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Drzwi</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Kod zdarzenia</th>
                </tr>
              )}
              itemContent={(index, item) => {
                const r = item as AttendanceRecord
                return (
                  <>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex flex-col">
                        <span>{new Date(r.event_timestamp).toLocaleDateString('pl-PL')}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(r.event_timestamp).toLocaleTimeString('pl-PL')}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium">
                      {r.user ? `${r.user.first_name} ${r.user.last_name}` : 'N/A'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={r.event_type === 'entry' ? 'default' : r.event_type === 'exit' ? 'secondary' : 'destructive'}>
                        {r.event_type === 'entry' ? 'Wejście' : r.event_type === 'exit' ? 'Wyjście' : 'Odmowa'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {r.racs_door_name || `ID: ${r.racs_door_id || 'N/A'}`}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {r.racs_event_code || 'N/A'}
                    </td>
                  </>
                )
              }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
