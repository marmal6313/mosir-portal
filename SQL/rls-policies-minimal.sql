-- Minimalne polityki RLS (Row Level Security) dla podstawowych tabel
-- Wykonaj ten skrypt w Supabase SQL Editor

-- 1. Włączenie RLS dla tabeli tasks
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- 2. Polityka dla odczytu zadań (SELECT)
CREATE POLICY "tasks_select_policy" ON public.tasks
FOR SELECT USING (
  -- Wszyscy zalogowani użytkownicy mogą czytać zadania
  auth.uid() IS NOT NULL
);

-- 3. Polityka dla wstawiania zadań (INSERT)
CREATE POLICY "tasks_insert_policy" ON public.tasks
FOR INSERT WITH CHECK (
  -- Wszyscy zalogowani użytkownicy mogą tworzyć zadania
  auth.uid() IS NOT NULL
);

-- 4. Polityka dla aktualizacji zadań (UPDATE)
CREATE POLICY "tasks_update_policy" ON public.tasks
FOR UPDATE USING (
  -- Wszyscy zalogowani użytkownicy mogą aktualizować zadania
  auth.uid() IS NOT NULL
);

-- 5. Polityka dla usuwania zadań (DELETE)
CREATE POLICY "tasks_delete_policy" ON public.tasks
FOR DELETE USING (
  -- Wszyscy zalogowani użytkownicy mogą usuwać zadania
  auth.uid() IS NOT NULL
);

-- 6. Polityki RLS dla tabeli users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_policy" ON public.users
FOR SELECT USING (
  -- Wszyscy zalogowani użytkownicy mogą czytać profile użytkowników
  auth.uid() IS NOT NULL
);

-- 7. Polityki RLS dla tabeli departments
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "departments_select_policy" ON public.departments
FOR SELECT USING (
  -- Wszyscy zalogowani użytkownicy mogą czytać działy
  auth.uid() IS NOT NULL
);

-- 8. Polityki RLS dla tabeli system_settings
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "system_settings_select_policy" ON public.system_settings
FOR SELECT USING (
  -- Wszyscy zalogowani użytkownicy mogą czytać ustawienia systemu
  auth.uid() IS NOT NULL
);

-- 9. Polityki RLS dla tabeli roles
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "roles_select_policy" ON public.roles
FOR SELECT USING (
  -- Wszyscy zalogowani użytkownicy mogą czytać role
  auth.uid() IS NOT NULL
);

-- 10. Polityki RLS dla tabeli role_scopes
ALTER TABLE public.role_scopes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "role_scopes_select_policy" ON public.role_scopes
FOR SELECT USING (
  -- Wszyscy zalogowani użytkownicy mogą czytać scope'y ról
  auth.uid() IS NOT NULL
);

-- 11. Polityki RLS dla tabeli notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_select_policy" ON public.notifications
FOR SELECT USING (
  -- Użytkownik może czytać własne powiadomienia
  auth.uid() = notifications.user_id
  OR
  -- Wszyscy zalogowani użytkownicy mogą czytać powiadomienia
  auth.uid() IS NOT NULL
);

CREATE POLICY "notifications_insert_policy" ON public.notifications
FOR INSERT WITH CHECK (
  -- System może tworzyć powiadomienia dla użytkowników
  auth.uid() IS NOT NULL
);

CREATE POLICY "notifications_update_policy" ON public.notifications
FOR UPDATE USING (
  -- Użytkownik może aktualizować własne powiadomienia
  auth.uid() = notifications.user_id
  OR
  -- Wszyscy zalogowani użytkownicy mogą aktualizować powiadomienia
  auth.uid() IS NOT NULL
);

-- 12. Sprawdzenie czy polityki zostały utworzone
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
WHERE tablename IN ('tasks', 'users', 'departments', 'system_settings', 'roles', 'role_scopes', 'notifications')
ORDER BY tablename, policyname;



