'use client'

import { useEffect, useState } from 'react'
import { useParams, notFound } from 'next/navigation'
import TaskDetails from './TaskDetails'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'

type TaskWithDetailsRow = Database['public']['Views']['tasks_with_details']['Row']

export default function Page() {
  const params = useParams()
  const id = params?.id as string
  const [task, setTask] = useState<(TaskWithDetailsRow & { id: string }) | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    async function fetchTask() {
      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
          console.error('[DEBUG] No user found')
          setError(true)
          setLoading(false)
          return
        }

        // Fetch task (RLS handles organization_id filtering automatically)
        const { data: taskData, error: taskError } = await supabase
          .from('tasks_with_details')
          .select('*')
          .eq('id', id)
          .single()

        if (taskError || !taskData || !taskData.id) {
          console.error('[DEBUG] Task not found or error:', taskError?.message)
          setError(true)
          setLoading(false)
          return
        }

        setTask({
          ...taskData,
          id: taskData.id as string,
        })
        setLoading(false)
      } catch (err) {
        console.error('[DEBUG] Error fetching task:', err)
        setError(true)
        setLoading(false)
      }
    }

    if (id) {
      fetchTask()
    }
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Ładowanie zadania...</p>
        </div>
      </div>
    )
  }

  if (error || !task) {
    return notFound()
  }

  return <TaskDetails task={task} />
}
