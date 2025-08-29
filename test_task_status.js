const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://avxrypydpexbqthumuhb.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2eHJ5cHlkcGV4YnF0aHVtdWhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU2NTE1MjAsImV4cCI6MjA2MTIyNzUyMH0.3j0BKB7I9a8wyP8aEoG-ikJZs-A5OYNtuI0lqerIcIY'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testTaskStatus() {
  console.log('🔍 Sprawdzanie statusów zadań...')

  try {
    // Pobierz wszystkie zadania
    const { data: tasks, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('❌ Błąd pobierania zadań:', error)
      return
    }

    console.log('✅ Pobrano zadań:', tasks?.length || 0)
    console.log('\n📋 Szczegóły zadań:')
    
    tasks?.forEach((task, index) => {
      console.log(`${index + 1}. ID: ${task.id}`)
      console.log(`   Status: ${task.status}`)
      console.log(`   Opis: ${task.description}`)
      console.log(`   Termin: ${task.due_date}`)
      console.log(`   Utworzone: ${task.created_at}`)
      console.log(`   Zaktualizowane: ${task.updated_at}`)
      console.log('---')
    })

    // Sprawdź konkretne zadanie
    const taskId = '5bd3df6e-578a-478c-90fa-56095e5eb962'
    console.log(`\n🔍 Sprawdzanie zadania ${taskId}:`)
    
    const { data: specificTask, error: specificError } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single()

    if (specificError) {
      console.error('❌ Błąd pobierania konkretnego zadania:', specificError)
    } else if (specificTask) {
      console.log('✅ Zadanie znalezione:')
      console.log(`   Status: ${specificTask.status}`)
      console.log(`   Opis: ${specificTask.description}`)
      console.log(`   Termin: ${specificTask.due_date}`)
      console.log(`   Utworzone: ${specificTask.created_at}`)
      console.log(`   Zaktualizowane: ${specificTask.updated_at}`)
    }

  } catch (error) {
    console.error('❌ Błąd testu:', error)
  }
}

testTaskStatus() 