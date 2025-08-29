const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://avxrypydpexbqthumuhb.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2eHJ5cHlkcGV4YnF0aHVtdWhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU2NTE1MjAsImV4cCI6MjA2MTIyNzUyMH0.3j0BKB7I9a8wyP8aEoG-ikJZs-A5OYNtuI0lqerIcIY'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testDashboardData() {
  console.log('🔍 Testowanie danych dashboardu...')

  try {
    // Pobierz dane z tasks_with_details
    console.log('\n📊 Pobieranie z tasks_with_details:')
    const { data: tasksWithDetails, error: error1 } = await supabase
      .from('tasks_with_details')
      .select('*')
      .order('created_at', { ascending: false })

    if (error1) {
      console.error('❌ Błąd tasks_with_details:', error1)
    } else {
      console.log('✅ Pobrano z tasks_with_details:', tasksWithDetails?.length || 0)
      console.log('📋 Zadania z tasks_with_details:')
      tasksWithDetails?.forEach((task, index) => {
        console.log(`${index + 1}. ID: ${task.id}, Status: ${task.status}, Opis: ${task.description}`)
      })
    }

    // Pobierz dane bezpośrednio z tasks
    console.log('\n📊 Pobieranie z tasks:')
    const { data: tasks, error: error2 } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false })

    if (error2) {
      console.error('❌ Błąd tasks:', error2)
    } else {
      console.log('✅ Pobrano z tasks:', tasks?.length || 0)
      console.log('📋 Zadania z tasks:')
      tasks?.forEach((task, index) => {
        console.log(`${index + 1}. ID: ${task.id}, Status: ${task.status}, Opis: ${task.description}`)
      })
    }

    // Porównaj dane
    console.log('\n🔍 Porównanie danych:')
    if (tasksWithDetails && tasks) {
      const tasksWithDetailsIds = tasksWithDetails.map(t => t.id)
      const tasksIds = tasks.map(t => t.id)
      
      console.log('IDs z tasks_with_details:', tasksWithDetailsIds)
      console.log('IDs z tasks:', tasksIds)
      
      const missingInView = tasksIds.filter(id => !tasksWithDetailsIds.includes(id))
      const extraInView = tasksWithDetailsIds.filter(id => !tasksIds.includes(id))
      
      console.log('Brakujące w widoku:', missingInView)
      console.log('Dodatkowe w widoku:', extraInView)
    }

  } catch (error) {
    console.error('❌ Błąd testu:', error)
  }
}

testDashboardData() 