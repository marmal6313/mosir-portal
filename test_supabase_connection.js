const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://avxrypydpexbqthumuhb.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2eHJ5cHlkcGV4YnF0aHVtdWhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU2NTE1MjAsImV4cCI6MjA2MTIyNzUyMH0.3j0BKB7I9a8wyP8aEoG-ikJZs-A5OYNtuI0lqerIcIY'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testConnection() {
  console.log('🔍 Testowanie połączenia z Supabase...')

  try {
    // Test 1: Sprawdzenie czy widoki istnieją
    console.log('\n📋 Sprawdzanie widoków...')

    const { data: views, error: viewsError } = await supabase
      .from('users_with_details')
      .select('*')
      .limit(1)

    if (viewsError) {
      console.log('❌ Błąd przy dostępie do users_with_details:', viewsError.message)
    } else {
      console.log('✅ Widok users_with_details jest dostępny')
      console.log('📊 Struktura danych:', Object.keys(views[0] || {}))
    }

    // Test 2: Sprawdzenie widoku tasks_with_details
    console.log('\n📋 Sprawdzanie widoku tasks_with_details...')

    const { data: tasksViews, error: tasksViewsError } = await supabase
      .from('tasks_with_details')
      .select('*')
      .limit(1)

    if (tasksViewsError) {
      console.log('❌ Błąd przy dostępie do tasks_with_details:', tasksViewsError.message)
    } else {
      console.log('✅ Widok tasks_with_details jest dostępny')
      console.log('📊 Struktura danych:', Object.keys(tasksViews[0] || {}))
    }

    // Test 3: Sprawdzenie tabeli users
    console.log('\n📋 Sprawdzanie tabeli users...')

    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*')
      .limit(1)

    if (usersError) {
      console.log('❌ Błąd przy dostępie do users:', usersError.message)
    } else {
      console.log('✅ Tabela users jest dostępna')
      console.log('📊 Struktura danych:', Object.keys(users[0] || {}))
    }

    // Test 4: Sprawdzenie konkretnego użytkownika...
    console.log('\n👤 Sprawdzanie konkretnego użytkownika...')

    const testUserId = '2c0880c1-5d9b-415c-ba71-afd2fad942cb'

    const { data: user, error: userError } = await supabase
      .from('users_with_details')
      .select('*')
      .eq('id', testUserId)
      .single()

    if (userError) {
      console.log('❌ Błąd przy pobieraniu użytkownika:', userError.message)
    } else if (user) {
      console.log('✅ Użytkownik znaleziony:', user.email)
      console.log('📊 Dane użytkownika:', user)
    } else {
      console.log('⚠️ Użytkownik nie został znaleziony')
    }

  } catch (error) {
    console.error('💥 Błąd ogólny:', error.message)
  }
}

testConnection() 