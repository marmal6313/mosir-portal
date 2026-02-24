"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'
import { useUserDepartments } from '@/hooks/useUserDepartments'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ArrowLeft,
  Plus,
  Building2,
  User,
  Target,
  Calendar,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Loader2
} from 'lucide-react'
import Link from 'next/link'

const priorities = [
  { value: "low", label: "Niski", color: "bg-green-100 text-green-800 border-green-200" },
  { value: "medium", label: "Średni", color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  { value: "high", label: "Wysoki", color: "bg-red-100 text-red-800 border-red-200" },
]

export default function AddTaskPage() {
  const router = useRouter()
  const [departments, setDepartments] = useState<Database["public"]["Tables"]["departments"]["Row"][]>([])
  const [users, setUsers] = useState<Pick<Database["public"]["Tables"]["users"]["Row"], 'id' | 'first_name' | 'last_name' | 'department_id' | 'active'>[]>([])
  const [userProfile, setUserProfile] = useState<Database["public"]["Tables"]["users"]["Row"] | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const { departmentIds } = useUserDepartments(currentUserId)
  const [form, setForm] = useState({
    title: "",
    description: "",
    department_id: "",
    assigned_to: "",
    priority: "medium",
    start_date: "",
    due_date: ""
  })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    const fetchData = async () => {
      // Pobierz aktualnego użytkownika
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Ustaw ID użytkownika dla hooka
      setCurrentUserId(user.id)

      // Pobierz profil użytkownika z tabeli users (ma department_id i organization_id)
      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()

      if (!profile) return

      setUserProfile(profile)

      // Bezpieczeństwo: sprawdź czy użytkownik ma organization_id
      const orgId = (profile as any).organization_id
      if (!orgId) {
        console.error('User has no organization_id - cannot load departments')
        return
      }

      // Pobierz działy użytkownika z user_departments
      const { data: userDepts } = await supabase
        .from('user_departments')
        .select('department_id')
        .eq('user_id', user.id)

      const userDepartmentIds = userDepts?.map(d => d.department_id) || []

      // Pobierz działy zgodnie z uprawnieniami
      let departmentsQuery = supabase.from('departments').select('*')

      // CRITICAL: Always filter by organization_id for multi-tenant isolation
      if (orgId) {
        departmentsQuery = departmentsQuery.eq('organization_id', orgId)
      }

      // Jeśli użytkownik jest kierownikiem lub pracownikiem, pokaż tylko jego działy
      if (profile.role !== 'dyrektor' && profile.role !== 'superadmin') {
        if (userDepartmentIds.length > 0) {
          // Użytkownik ma przypisane działy w user_departments - pokaż je
          departmentsQuery = departmentsQuery.in('id', userDepartmentIds)
        } else if (profile.department_id) {
          // Fallback do głównego działu jeśli brak w user_departments
          departmentsQuery = departmentsQuery.eq('id', profile.department_id)
        }
      }
      // Dla dyrektora i superadmina pokaż wszystkie działy (w swojej organizacji)

      const { data: departmentsData } = await departmentsQuery
      setDepartments(departmentsData || [])

      // Pobierz pracowników zgodnie z uprawnieniami
      let usersQuery = supabase
        .from('users')
        .select('id, first_name, last_name, department_id, active')
        .eq('active', true)

      // CRITICAL: Always filter by organization_id for multi-tenant isolation
      if (orgId) {
        usersQuery = usersQuery.eq('organization_id', orgId)
      }

      // Jeśli użytkownik jest kierownikiem, pokaż pracowników ze wszystkich jego działów
      if (profile.role === 'kierownik') {
        if (userDepartmentIds.length > 0) {
          // Pokaż pracowników ze wszystkich działów użytkownika
          usersQuery = usersQuery.in('department_id', userDepartmentIds)
        } else if (profile.department_id) {
          // Fallback do głównego działu jeśli brak w user_departments
          usersQuery = usersQuery.eq('department_id', profile.department_id)
        }
      }
      // Jeśli użytkownik jest pracownikiem, pokaż tylko siebie
      else if (profile.role !== 'dyrektor' && profile.role !== 'superadmin') {
        usersQuery = usersQuery.eq('id', user.id)
      }
      // Dla dyrektora i superadmina pokaż wszystkich aktywnych pracowników

      const { data: usersData } = await usersQuery
      setUsers(usersData || [])

      // Ustaw domyślne wartości w formularzu
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)

      // Ustaw domyślny dział - pierwszy z listy lub główny dział
      const defaultDeptId = userDepartmentIds.length > 0
        ? String(userDepartmentIds[0])
        : profile.department_id
        ? String(profile.department_id)
        : ""

      setForm(f => ({
        ...f,
        assigned_to: profile.role === 'kierownik' ? "" : profile.id || "", // Kierownik może przydzielać innym
        department_id: defaultDeptId,
        due_date: tomorrow.toISOString().slice(0, 10)
      }))
    }
    fetchData()
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    setSuccess("")

    // Pobierz aktualnego użytkownika
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError("Brak autoryzacji")
      setLoading(false)
      return
    }

    // Pobierz organization_id użytkownika
    if (!userProfile?.organization_id) {
      setError("Brak przypisania do organizacji")
      setLoading(false)
      return
    }

    const { error } = await supabase.from('tasks').insert({
      title: form.title,
      description: form.description,
      department_id: form.department_id ? Number(form.department_id) : null,
      assigned_to: form.assigned_to || null,
      created_by: user.id,
      organization_id: userProfile.organization_id,
      priority: form.priority,
      status: 'new',
      start_date: form.start_date || null,
      due_date: form.due_date || null
    })
    
    if (error) {
      setError(error.message)
    } else {
      setSuccess("Zadanie zostało dodane!")
      setForm({ title: "", description: "", department_id: "", assigned_to: "", priority: "medium", start_date: "", due_date: "" })
      setTimeout(() => router.push('/dashboard/tasks'), 1500)
    }
    setLoading(false)
  }

  const getPriorityColor = (priority: string) => {
    return priorities.find(p => p.value === priority)?.color || "bg-gray-100 text-gray-800 border-gray-200"
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-gray-100 p-3 sm:p-4 lg:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
          <div className="flex items-center gap-4 mb-4">
            <Link href="/dashboard/tasks">
              <Button variant="outline" size="sm" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Powrót do zadań</span>
                <span className="sm:hidden">Powrót</span>
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Dodaj nowe zadanie</h1>
              <p className="text-gray-600 text-sm sm:text-base mt-1">
                Wypełnij formularz aby utworzyć nowe zadanie w systemie
              </p>
              {userProfile && (
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary" className="text-xs">
                    {userProfile.role === 'kierownik' ? 'Kierownik' :
                     userProfile.role === 'dyrektor' ? 'Dyrektor' :
                     userProfile.role === 'superadmin' ? 'Super Administrator' : 'Pracownik'}
                  </Badge>
                  {departmentIds.length > 0 && (
                    <>
                      {departmentIds.map(deptId => {
                        const dept = departments.find(d => d.id === deptId)
                        return dept ? (
                          <Badge key={deptId} variant="outline" className="text-xs">
                            {dept.name}
                          </Badge>
                        ) : null
                      })}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Formularz */}
        <Card className="shadow-sm border border-gray-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Plus className="h-5 w-5 text-blue-600" />
              Szczegóły zadania
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Tytuł */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-600" />
                  Tytuł zadania *
                </label>
                <Input
                  name="title"
                  value={form.title}
                  onChange={handleChange}
                  required
                  placeholder="Wprowadź tytuł zadania..."
                  className="text-base"
                />
              </div>

              {/* Opis */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-600" />
                  Opis zadania
                </label>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  rows={4}
                  placeholder="Szczegółowy opis zadania..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                />
              </div>

              {/* Dział i Pracownik w jednej linii */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-blue-600" />
                    Dział *
                  </label>
                  <select
                    name="department_id"
                    value={form.department_id}
                    onChange={handleChange}
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Wybierz dział</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                  {departments.length === 0 ? (
                    <p className="text-xs text-gray-500">Brak dostępnych działów</p>
                  ) : departments.length > 1 ? (
                    <p className="text-xs text-green-600">Dostępne działy: {departments.length}</p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <User className="h-4 w-4 text-blue-600" />
                    Przydzielone do *
                  </label>
                  <select
                    name="assigned_to"
                    value={form.assigned_to}
                    onChange={handleChange}
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Wybierz pracownika</option>
                    {users.map((u) => (
                      <option key={u.id || ''} value={u.id || ''}>
                        {`${u.first_name} ${u.last_name}`}
                      </option>
                    ))}
                  </select>
                  {users.length === 0 && (
                    <p className="text-xs text-gray-500">Brak dostępnych pracowników</p>
                  )}
                </div>
              </div>

              {/* Priorytet i Termin w jednej linii */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Target className="h-4 w-4 text-blue-600" />
                    Priorytet
                  </label>
                  <div className="flex gap-2">
                    {priorities.map((priority) => (
                      <button
                        key={priority.value}
                        type="button"
                        onClick={() => setForm(prev => ({ ...prev, priority: priority.value }))}
                        className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                          form.priority === priority.value
                            ? priority.color
                            : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        {priority.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-green-600" />
                      Data rozpoczęcia
                    </label>
                    <Input
                      type="date"
                      name="start_date"
                      value={form.start_date}
                      onChange={handleChange}
                      className="text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-blue-600" />
                      Termin wykonania
                    </label>
                    <Input
                      type="date"
                      name="due_date"
                      value={form.due_date}
                      onChange={handleChange}
                      className="text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Komunikat o błędzie */}
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  <span className="text-red-700 text-sm">{error}</span>
                </div>
              )}

              {/* Komunikat o sukcesie */}
              {success && (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <span className="text-green-700 text-sm">{success}</span>
                </div>
              )}

              {/* Przyciski akcji */}
              <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200">
                <Button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Dodawanie...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Dodaj zadanie
                    </>
                  )}
                </Button>
                
                <Link href="/dashboard/tasks" className="flex-1">
                  <Button variant="outline" className="w-full">
                    Anuluj
                  </Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 