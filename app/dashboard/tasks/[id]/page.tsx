import { notFound } from 'next/navigation'
import TaskDetails from './TaskDetails'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import type { Database } from '@/types/database'

type TaskWithDetailsRow = Database['public']['Views']['tasks_with_details']['Row']

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createSupabaseServerClient()

  const { data: task, error } = await supabase
    .from('tasks_with_details')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !task || !task.id) {
    if (error) {
      console.error(`Nie udało się pobrać zadania ${id}:`, error.message)
    }
    return notFound()
  }

  const taskWithId: TaskWithDetailsRow & { id: string } = {
    ...task,
    id: task.id as string,
  }

  return <TaskDetails task={taskWithId} />
}
