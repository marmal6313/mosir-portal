import TaskDetails from './TaskDetails';
import { supabase } from '@/lib/supabase';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Pobierz dane zadania
  const { data: task, error } = await supabase
    .from('tasks_with_details')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !task || !task.id) {
    return <div className="p-6">Zadanie nie zostało znalezione.</div>;
  }

  const taskWithId = {
    ...task,
    id: task.id as string
  };

  return <TaskDetails task={taskWithId} />;
} 