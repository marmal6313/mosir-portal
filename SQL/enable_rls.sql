-- Skrypt do włączenia RLS (Row Level Security) po wyczyszczeniu bazy
-- Uruchom w Supabase SQL Editor PO wykonania cleanup_database.sql

-- 1. Włącz RLS na tabeli tasks
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- 2. Włącz RLS na tabeli users (jeśli nie jest włączone)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 3. Włącz RLS na tabeli departments (jeśli nie jest włączone)
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

-- 4. Włącz RLS na tabeli notifications (jeśli nie jest włączone)
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 5. Sprawdź czy RLS jest włączone
SELECT '=== SPRAWDZENIE RLS ===' as info;
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename IN ('tasks', 'users', 'departments', 'notifications')
ORDER BY tablename;

-- 6. Utwórz polityki RLS dla tabeli tasks
-- Polityka dla odczytu - użytkownicy widzą tylko zadania ze swojego działu
CREATE POLICY "Users can view tasks from their department" ON tasks
    FOR SELECT USING (
        department_id IN (
            SELECT department_id 
            FROM users 
            WHERE id = auth.uid()
        )
    );

-- Polityka dla wstawiania - użytkownicy mogą tworzyć zadania w swoim dziale
CREATE POLICY "Users can create tasks in their department" ON tasks
    FOR INSERT WITH CHECK (
        department_id IN (
            SELECT department_id 
            FROM users 
            WHERE id = auth.uid()
        )
    );

-- Polityka dla aktualizacji - użytkownicy mogą aktualizować zadania w swoim dziale
CREATE POLICY "Users can update tasks in their department" ON tasks
    FOR UPDATE USING (
        department_id IN (
            SELECT department_id 
            FROM users 
            WHERE id = auth.uid()
        )
    );

-- Polityka dla usuwania - użytkownicy mogą usuwać zadania w swoim dziale
CREATE POLICY "Users can delete tasks in their department" ON tasks
    FOR DELETE USING (
        department_id IN (
            SELECT department_id 
            FROM users 
            WHERE id = auth.uid()
        )
    );

-- 7. Utwórz polityki RLS dla tabeli users
-- Użytkownicy widzą tylko siebie i osoby ze swojego działu
CREATE POLICY "Users can view their own profile and department members" ON users
    FOR SELECT USING (
        id = auth.uid() OR 
        department_id IN (
            SELECT department_id 
            FROM users 
            WHERE id = auth.uid()
        )
    );

-- 8. Utwórz polityki RLS dla tabeli departments
-- Użytkownicy widzą tylko swój dział
CREATE POLICY "Users can view their own department" ON departments
    FOR SELECT USING (
        id IN (
            SELECT department_id 
            FROM users 
            WHERE id = auth.uid()
        )
    );

-- 9. Sprawdź utworzone polityki
SELECT '=== SPRAWDZENIE POLITYK RLS ===' as info;
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'public' 
   AND tablename IN ('tasks', 'users', 'departments')
ORDER BY tablename, policyname;

-- 10. Rekomendacje
SELECT '=== REKOMENDACJE ===' as info;
SELECT '1. RLS zostało włączone na wszystkich tabelach' as recommendation;
SELECT '2. Polityki bezpieczeństwa zostały utworzone' as recommendation;
SELECT '3. Użytkownicy widzą tylko dane ze swojego działu' as recommendation;
SELECT '4. Możesz teraz utworzyć nowe zadania z poprawnymi danymi' as recommendation;
SELECT '5. Sprawdź czy aplikacja działa poprawnie z RLS' as recommendation;

