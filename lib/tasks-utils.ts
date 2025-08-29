// === Status / Priority maps (jedno źródło prawdy) ===
export const STATUS_ORDER = { new: 1, in_progress: 2, completed: 3, cancelled: 4 } as const
export const PRIORITY_ORDER = { high: 3, medium: 2, low: 1 } as const

export type TaskStatus = keyof typeof STATUS_ORDER
export type TaskPriority = keyof typeof PRIORITY_ORDER

export const getStatusLabel = (s?: string | null) => {
  switch (s as TaskStatus) {
    case 'new': return 'Nowe'
    case 'in_progress': return 'W trakcie'
    case 'completed': return 'Zakończone'
    case 'cancelled': return 'Anulowane'
    default: return s ?? 'Nieznany'
  }
}

export const getPriorityLabel = (p?: string | null) => {
  switch (p as TaskPriority) {
    case 'low': return 'Niskie'
    case 'medium': return 'Średnie'
    case 'high': return 'Wysokie'
    default: return p ?? 'Nieznany'
  }
}

export const getStatusColor = (s?: string | null) => {
  switch (s as TaskStatus) {
    case 'new': return 'bg-gray-100 text-gray-800 border-gray-200'
    case 'in_progress': return 'bg-blue-100 text-blue-800 border-blue-200'
    case 'completed': return 'bg-green-100 text-green-800 border-green-200'
    case 'cancelled': return 'bg-red-100 text-red-800 border-red-200'
    default: return 'bg-gray-100 text-gray-800 border-gray-200'
  }
}

export const getPriorityColor = (p?: string | null) => {
  switch (p as TaskPriority) {
    case 'low': return 'bg-green-100 text-green-800 border-green-200'
    case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    case 'high': return 'bg-red-100 text-red-800 border-red-200'
    default: return 'bg-gray-100 text-gray-800 border-gray-200'
  }
}

// === Daty — bezpieczne formatowanie i sortowanie po dniach ===
export const formatDbDate = (value?: string | null) => {
  if (!value) return '—'
  const m = /^\d{4}-\d{2}-\d{2}/.exec(value)
  if (m) {
    const [y, mo, d] = m[0].split('-').map(Number)
    return new Date(y, mo - 1, d).toLocaleDateString('pl-PL')
  }
  const t = Date.parse(value)
  return Number.isNaN(t) ? '—' : new Date(t).toLocaleDateString('pl-PL')
}

export const timeForSort = (value?: string | null) => {
  if (!value) return 0
  const m = /^\d{4}-\d{2}-\d{2}/.exec(value)
  if (m) {
    const [y, mo, d] = m[0].split('-').map(Number)
    return new Date(y, mo - 1, d).getTime()
  }
  const t = Date.parse(value)
  return Number.isNaN(t) ? 0 : t
}

// === Gantt-friendly helpers (opcjonalnie: użyj także w page.tsx Gantta) ===
export const isDateOnly = (s?: string | null) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s)

export const fromDbToLocalNoon = (value?: string | null, fallbackDays = 0): Date => {
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
  if (Number.isNaN(dt.getTime())) {
    const f = new Date(now)
    f.setDate(f.getDate() + fallbackDays)
    f.setHours(12, 0, 0, 0)
    return f
  }
  dt.setHours(12, 0, 0, 0)
  return dt
}

export const toDbStartIso = (d: Date) =>
  new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)).toISOString()

export const toDbEndIso = (d: Date) =>
  new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)).toISOString()

export const toDateInputValue = (d: Date): string => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export const startOfDayLocal = (d: Date) => { const x = new Date(d); x.setHours(0,0,0,0); return x }
export const endOfDayLocal   = (d: Date) => { const x = new Date(d); x.setHours(23,59,59,999); return x }

