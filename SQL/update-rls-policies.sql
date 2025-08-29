-- Aktualizacja istniejących polityk RLS na polskie nazwy ról
-- Wykonaj ten skrypt w Supabase SQL Editor

-- 1. Usunięcie starych polityk dla tabeli tasks
DROP POLICY IF EXISTS "Allow all select" ON public.tasks;
DROP POLICY IF EXISTS "Enable read for authenticated users" ON public.tasks;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.tasks;
DROP POLICY IF EXISTS "Managers can create tasks" ON public.tasks;
DROP POLICY IF EXISTS "Managers can view department tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can update their own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can view their own tasks" ON public.tasks;

-- 2. Usunięcie starych polityk dla tabeli users
DROP POLICY IF EXISTS "Directors can view all users" ON public.users;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.users;
DROP POLICY IF EXISTS "Managers can view their department" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;

-- 3. Usunięcie starych polityk dla tabeli notifications
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;

-- 4. Utworzenie nowych polityk dla tabeli tasks z polskimi nazwami ról
CREATE POLICY "tasks_select_policy_new" ON public.tasks
FOR SELECT USING (
  -- Superadmin może czytać wszystkie zadania
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = auth.uid() AND u.role = 'superadmin'
  )
  OR
  -- Dyrektor może czytać wszystkie zadania
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = auth.uid() AND u.role = 'dyrektor'
  )
  OR
  -- Kierownik może czytać zadania z własnego działu
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = auth.uid() AND u.role = 'kierownik' 
    AND u.department_id = tasks.department_id
  )
  OR
  -- Pracownik może czytać własne zadania i zadania z własnego działu
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = auth.uid() AND u.role = 'pracownik'
    AND (u.id = tasks.assigned_to OR u.department_id = tasks.department_id)
  )
);

CREATE POLICY "tasks_insert_policy_new" ON public.tasks
FOR INSERT WITH CHECK (
  -- Superadmin może tworzyć wszystkie zadania
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = auth.uid() AND u.role = 'superadmin'
  )
  OR
  -- Dyrektor może tworzyć wszystkie zadania
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = auth.uid() AND u.role = 'dyrektor'
  )
  OR
  -- Kierownik może tworzyć zadania w swoim dziale
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = auth.uid() AND u.role = 'kierownik' 
    AND u.department_id = tasks.department_id
  )
  OR
  -- Pracownik może tworzyć zadania w swoim dziale
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = auth.uid() AND u.role = 'pracownik'
    AND u.department_id = tasks.department_id
  )
);

CREATE POLICY "tasks_update_policy_new" ON public.tasks
FOR UPDATE USING (
  -- Superadmin może aktualizować wszystkie zadania
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = auth.uid() AND u.role = 'superadmin'
  )
  OR
  -- Dyrektor może aktualizować wszystkie zadania
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = auth.uid() AND u.role = 'dyrektor'
  )
  OR
  -- Kierownik może aktualizować zadania w swoim dziale
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = auth.uid() AND u.role = 'kierownik' 
    AND u.department_id = tasks.department_id
  )
  OR
  -- Pracownik może aktualizować własne zadania
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = auth.uid() AND u.role = 'pracownik'
    AND u.id = tasks.assigned_to
  )
);

-- 5. Utworzenie nowych polityk dla tabeli users z polskimi nazwami ról
CREATE POLICY "users_select_policy_new" ON public.users
FOR SELECT USING (
  -- Superadmin może czytać wszystkich użytkowników
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = auth.uid() AND u.role = 'superadmin'
  )
  OR
  -- Dyrektor może czytać wszystkich użytkowników
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = auth.uid() AND u.role = 'dyrektor'
  )
  OR
  -- Kierownik może czytać użytkowników z własnego działu
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = auth.uid() AND u.role = 'kierownik' 
    AND u.department_id = users.department_id
  )
  OR
  -- Pracownik może czytać własny profil
  auth.uid() = users.id
);

-- 6. Utworzenie nowych polityk dla tabeli notifications z polskimi nazwami ról
CREATE POLICY "notifications_select_policy_new" ON public.notifications
FOR SELECT USING (
  -- Użytkownik może czytać własne powiadomienia
  auth.uid() = notifications.user_id
  OR
  -- Superadmin może czytać wszystkie powiadomienia
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = auth.uid() AND u.role = 'superadmin'
  )
  OR
  -- Dyrektor może czytać wszystkie powiadomienia
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = auth.uid() AND u.role = 'dyrektor'
  )
);

-- 7. Sprawdzenie czy nowe polityki zostały utworzone
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
WHERE tablename IN ('tasks', 'users', 'notifications')
AND policyname LIKE '%_new'
ORDER BY tablename, policyname;



