-- Całkowite czyszczenie wszystkich polityk RLS i utworzenie jednego zestawu
-- Wykonaj ten skrypt w Supabase SQL Editor

-- 1. USUNIĘCIE WSZYSTKICH ISTNIEJĄCYCH POLITYK

-- Usunięcie polityk dla tabeli notifications
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert_policy" ON public.notifications;
DROP POLICY IF EXISTS "notifications_select_policy" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update_policy" ON public.notifications;
DROP POLICY IF EXISTS "notifications_simple_insert" ON public.notifications;
DROP POLICY IF EXISTS "notifications_simple_select" ON public.notifications;
DROP POLICY IF EXISTS "notifications_simple_update" ON public.notifications;

-- Usunięcie polityk dla tabeli tasks
DROP POLICY IF EXISTS "Allow all select" ON public.tasks;
DROP POLICY IF EXISTS "Enable read for authenticated users" ON public.tasks;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.tasks;
DROP POLICY IF EXISTS "Managers can create tasks" ON public.tasks;
DROP POLICY IF EXISTS "Managers can view department tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can update their own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can view their own tasks" ON public.tasks;
DROP POLICY IF EXISTS "tasks_delete_policy" ON public.tasks;
DROP POLICY IF EXISTS "tasks_insert_policy" ON public.tasks;
DROP POLICY IF EXISTS "tasks_select_policy" ON public.tasks;
DROP POLICY IF EXISTS "tasks_update_policy" ON public.tasks;
DROP POLICY IF EXISTS "tasks_simple_delete" ON public.tasks;
DROP POLICY IF EXISTS "tasks_simple_insert" ON public.tasks;
DROP POLICY IF EXISTS "tasks_simple_select" ON public.tasks;
DROP POLICY IF EXISTS "tasks_simple_update" ON public.tasks;

-- Usunięcie polityk dla tabeli users
DROP POLICY IF EXISTS "Directors can view all users" ON public.users;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.users;
DROP POLICY IF EXISTS "Managers can view their department" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "users_select_policy" ON public.users;
DROP POLICY IF EXISTS "users_simple_insert" ON public.users;
DROP POLICY IF EXISTS "users_simple_select" ON public.users;
DROP POLICY IF EXISTS "users_simple_update" ON public.users;

-- 2. UTWORZENIE JEDNEGO ZESTAWU PROSTYCH POLITYK

-- Polityki dla tabeli users
CREATE POLICY "users_select" ON public.users
FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "users_insert" ON public.users
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "users_update" ON public.users
FOR UPDATE USING (auth.uid() = id);

-- Polityki dla tabeli tasks
CREATE POLICY "tasks_select" ON public.tasks
FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "tasks_insert" ON public.tasks
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "tasks_update" ON public.tasks
FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "tasks_delete" ON public.tasks
FOR DELETE USING (auth.uid() IS NOT NULL);

-- Polityki dla tabeli notifications
CREATE POLICY "notifications_select" ON public.notifications
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "notifications_insert" ON public.notifications
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "notifications_update" ON public.notifications
FOR UPDATE USING (auth.uid() = user_id);

-- 3. SPRAWDZENIE WYNIKU
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename IN ('tasks', 'users', 'notifications')
ORDER BY tablename, policyname;

-- 4. SPRAWDZENIE LICZBY POLITYK
SELECT 
    t.schemaname,
    t.tablename,
    t.rowsecurity,
    COUNT(p.policyname) as policy_count
FROM pg_tables t
LEFT JOIN pg_policies p ON t.tablename = p.tablename AND t.schemaname = p.schemaname
WHERE t.tablename IN ('tasks', 'users', 'notifications')
AND t.schemaname = 'public'
GROUP BY t.schemaname, t.tablename, t.rowsecurity
ORDER BY t.tablename;


