import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

interface UserDepartment {
  department_id: number
  is_primary: boolean | null
}

/**
 * Hook do pobierania listy działów użytkownika (multi-department).
 * Zwraca tablicę department_ids i metody pomocnicze.
 */
export function useUserDepartments(userId: string | null | undefined) {
  const [departmentIds, setDepartmentIds] = useState<number[]>([])
  const [loading, setLoading] = useState(true)

  const fetchDepartments = useCallback(async () => {
    if (!userId) {
      setDepartmentIds([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('user_departments')
        .select('department_id, is_primary')
        .eq('user_id', userId)
        .order('is_primary', { ascending: false })

      if (error) {
        console.error('Błąd pobierania działów użytkownika:', error)
        setDepartmentIds([])
        return
      }

      const ids = (data as UserDepartment[])?.map(d => d.department_id) || []
      setDepartmentIds(ids)
    } catch (error) {
      console.error('Błąd pobierania działów użytkownika:', error)
      setDepartmentIds([])
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetchDepartments()
  }, [fetchDepartments])

  /** Czy użytkownik należy do danego działu */
  const belongsToDepartment = useCallback(
    (departmentId: number) => departmentIds.includes(departmentId),
    [departmentIds]
  )

  return {
    departmentIds,
    loading,
    belongsToDepartment,
    refetch: fetchDepartments,
  }
}

/**
 * Pobierz department_ids użytkownika jednorazowo (nie hook).
 * Przydatne w fetchDashboardData i podobnych callbackach.
 */
export async function fetchUserDepartmentIds(userId: string): Promise<number[]> {
  const { data, error } = await supabase
    .from('user_departments')
    .select('department_id')
    .eq('user_id', userId)

  if (error) {
    console.error('Błąd pobierania działów użytkownika:', error)
    return []
  }

  return data?.map(d => d.department_id) || []
}
