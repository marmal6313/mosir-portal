-- Poprawione polityki RLS uwzględniające role użytkowników
-- Wykonaj ten skrypt w Supabase SQL Editor

-- 1. USUNIĘCIE OBECNYCH POLITYK

-- Usunięcie polityk dla tabeli tasks
DROP POLICY IF EXISTS "tasks_select" ON public.tasks;
DROP POLICY IF EXISTS "tasks_insert" ON public.tasks;
DROP POLICY IF EXISTS "tasks_update" ON public.tasks;
DROP POLICY IF EXISTS "tasks_delete" ON public.tasks;

-- Usunięcie polityk dla tabeli users
DROP POLICY IF EXISTS "users_select" ON public.users;
DROP POLICY IF EXISTS "users_insert" ON public.users;
DROP POLICY IF EXISTS "users_update" ON public.users;

-- Usunięcie polityk dla tabeli notifications
DROP POLICY IF EXISTS "notifications_select" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update" ON public.notifications;

-- 2. UTWORZENIE POPRAWIONYCH POLITYK Z UWZGLĘDNIENIEM RÓL

-- Polityki dla tabeli users
CREATE POLICY "users_select" ON public.users
FOR SELECT USING (
  auth.uid() IS NOT NULL AND (
    -- Dyrektor widzi wszystkich użytkowników
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'dyrektor'
    ) OR
    -- Kierownik widzi użytkowników swojego działu
    EXISTS (
      SELECT 1 FROM public.users u1
      JOIN public.users u2 ON u1.department_id = u2.department_id
      WHERE u1.id = auth.uid() AND u2.id = users.id 
      AND u1.role = 'kierownik'
    ) OR
    -- Pracownik widzi tylko siebie
    auth.uid() = users.id
  )
);

CREATE POLICY "users_insert" ON public.users
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "users_update" ON public.users
FOR UPDATE USING (
  auth.uid() = users.id OR
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'dyrektor'
  )
);

-- Polityki dla tabeli tasks
CREATE POLICY "tasks_select" ON public.tasks
FOR SELECT USING (
  auth.uid() IS NOT NULL AND (
    -- Dyrektor widzi wszystkie zadania
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'dyrektor'
    ) OR
    -- Kierownik widzi zadania swojego działu
    EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.tasks t ON u.department_id = t.department_id
      WHERE u.id = auth.uid() AND t.id = tasks.id 
      AND u.role = 'kierownik'
    ) OR
    -- Pracownik widzi zadania swojego działu i przypisane do niego
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND (
        u.department_id = tasks.department_id OR
        tasks.assigned_to = u.id
      )
    )
  )
);

CREATE POLICY "tasks_insert" ON public.tasks
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND (
    -- Dyrektor może tworzyć wszystkie zadania
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'dyrektor'
    ) OR
    -- Kierownik może tworzyć zadania w swoim dziale
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'kierownik'
      AND u.department_id = tasks.department_id
    )
  )
);

CREATE POLICY "tasks_update" ON public.tasks
FOR UPDATE USING (
  auth.uid() IS NOT NULL AND (
    -- Dyrektor może edytować wszystkie zadania
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'dyrektor'
    ) OR
    -- Kierownik może edytować zadania w swoim dziale
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'kierownik'
      AND u.department_id = tasks.department_id
    ) OR
    -- Pracownik może edytować zadania przypisane do niego
    tasks.assigned_to = auth.uid()
  )
);

CREATE POLICY "tasks_delete" ON public.tasks
FOR DELETE USING (
  auth.uid() IS NOT NULL AND (
    -- Dyrektor może usuwać wszystkie zadania
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'dyrektor'
    ) OR
    -- Kierownik może usuwać zadania w swoim dziale
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'kierownik'
      AND u.department_id = tasks.department_id
    )
  )
);

-- Polityki dla tabeli notifications
CREATE POLICY "notifications_select" ON public.notifications
FOR SELECT USING (
  auth.uid() IS NOT NULL AND (
    -- Dyrektor widzi wszystkie powiadomienia
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'dyrektor'
    ) OR
    -- Inni widzą tylko swoje powiadomienia
    user_id = auth.uid()
  )
);

CREATE POLICY "notifications_insert" ON public.notifications
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "notifications_update" ON public.notifications
FOR UPDATE USING (
  auth.uid() IS NOT NULL AND (
    -- Dyrektor może edytować wszystkie powiadomienia
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'dyrektor'
    ) OR
    -- Inni mogą edytować tylko swoje powiadomienia
    user_id = auth.uid()
  )
);

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
