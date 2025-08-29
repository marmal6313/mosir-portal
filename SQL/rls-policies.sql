-- Polityki RLS (Row Level Security) dla tabeli tasks
-- Wykonaj ten skrypt w Supabase SQL Editor

-- 1. Włączenie RLS dla tabeli tasks
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- 2. Polityka dla odczytu zadań (SELECT)
CREATE POLICY "tasks_select_policy" ON public.tasks
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

-- 3. Polityka dla wstawiania zadań (INSERT)
CREATE POLICY "tasks_insert_policy" ON public.tasks
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

-- 4. Polityka dla aktualizacji zadań (UPDATE)
CREATE POLICY "tasks_update_policy" ON public.tasks
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

-- 5. Polityka dla usuwania zadań (DELETE)
CREATE POLICY "tasks_delete_policy" ON public.tasks
FOR DELETE USING (
  -- Superadmin może usuwać wszystkie zadania
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = auth.uid() AND u.role = 'superadmin'
  )
  OR
  -- Dyrektor może usuwać wszystkie zadania
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = auth.uid() AND u.role = 'dyrektor'
  )
  OR
  -- Kierownik może usuwać zadania w swoim dziale
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = auth.uid() AND u.role = 'kierownik' 
    AND u.department_id = tasks.department_id
  )
);

-- 6. Polityki RLS dla tabeli users (jeśli nie ma)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_policy" ON public.users
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

-- 7. Polityki RLS dla tabeli departments (jeśli nie ma)
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "departments_select_policy" ON public.departments
FOR SELECT USING (
  -- Superadmin może czytać wszystkie działy
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = auth.uid() AND u.role = 'superadmin'
  )
  OR
  -- Dyrektor może czytać wszystkie działy
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = auth.uid() AND u.role = 'dyrektor'
  )
  OR
  -- Kierownik może czytać własny dział
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = auth.uid() AND u.role = 'kierownik' 
    AND u.department_id = departments.id
  )
  OR
  -- Pracownik może czytać własny dział
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = auth.uid() AND u.role = 'pracownik'
    AND u.department_id = departments.id
  )
);

-- 8. Polityki RLS dla tabeli system_settings
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "system_settings_select_policy" ON public.system_settings
FOR SELECT USING (
  -- Wszyscy zalogowani użytkownicy mogą czytać ustawienia systemu
  auth.uid() IS NOT NULL
);

CREATE POLICY "system_settings_insert_policy" ON public.system_settings
FOR INSERT WITH CHECK (
  -- Tylko superadmin może dodawać ustawienia systemu
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = auth.uid() AND u.role = 'superadmin'
  )
);

CREATE POLICY "system_settings_update_policy" ON public.system_settings
FOR UPDATE USING (
  -- Tylko superadmin może aktualizować ustawienia systemu
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = auth.uid() AND u.role = 'superadmin'
  )
);

-- 9. Polityki RLS dla tabeli roles
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "roles_select_policy" ON public.roles
FOR SELECT USING (
  -- Wszyscy zalogowani użytkownicy mogą czytać role
  auth.uid() IS NOT NULL
);

CREATE POLICY "roles_insert_policy" ON public.roles
FOR INSERT WITH CHECK (
  -- Tylko superadmin może dodawać role
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = auth.uid() AND u.role = 'superadmin'
  )
);

CREATE POLICY "roles_update_policy" ON public.roles
FOR UPDATE USING (
  -- Tylko superadmin może aktualizować role
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = auth.uid() AND u.role = 'superadmin'
  )
);

-- 10. Polityki RLS dla tabeli role_scopes
ALTER TABLE public.role_scopes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "role_scopes_select_policy" ON public.role_scopes
FOR SELECT USING (
  -- Wszyscy zalogowani użytkownicy mogą czytać scope'y ról
  auth.uid() IS NOT NULL
);

CREATE POLICY "role_scopes_insert_policy" ON public.role_scopes
FOR INSERT WITH CHECK (
  -- Tylko superadmin może dodawać scope'y ról
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = auth.uid() AND u.role = 'superadmin'
  )
);

CREATE POLICY "role_scopes_update_policy" ON public.role_scopes
FOR UPDATE USING (
  -- Tylko superadmin może aktualizować scope'y ról
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = auth.uid() AND u.role = 'superadmin'
  )
);

CREATE POLICY "role_scopes_delete_policy" ON public.role_scopes
FOR DELETE USING (
  -- Tylko superadmin może usuwać scope'y ról
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = auth.uid() AND u.role = 'superadmin'
  )
);

-- 11. Polityki RLS dla tabeli notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_select_policy" ON public.notifications
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
  -- Superadmin może aktualizować wszystkie powiadomienia
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = auth.uid() AND u.role = 'superadmin'
  )
  OR
  -- Dyrektor może aktualizować wszystkie powiadomienia
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = auth.uid() AND u.role = 'dyrektor'
  )
);

-- 12. Polityki RLS dla tabeli task_changes
ALTER TABLE public.task_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_changes_select_policy" ON public.task_changes
FOR SELECT USING (
  -- Superadmin może czytać wszystkie zmiany zadań
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = auth.uid() AND u.role = 'superadmin'
  )
  OR
  -- Dyrektor może czytać wszystkie zmiany zadań
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = auth.uid() AND u.role = 'dyrektor'
  )
  OR
  -- Kierownik może czytać zmiany zadań z własnego działu
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = auth.uid() AND u.role = 'kierownik' 
    AND u.department_id = (
      SELECT department_id FROM public.tasks WHERE id = task_changes.task_id
    )
  )
  OR
  -- Pracownik może czytać zmiany własnych zadań
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = auth.uid() AND u.role = 'pracownik'
    AND u.id = (
      SELECT assigned_to FROM public.tasks WHERE id = task_changes.task_id
    )
  )
);

CREATE POLICY "task_changes_insert_policy" ON public.task_changes
FOR INSERT WITH CHECK (
  -- System może tworzyć zmiany zadań
  auth.uid() IS NOT NULL
);

-- 13. Polityki RLS dla tabeli task_comments
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_comments_select_policy" ON public.task_comments
FOR SELECT USING (
  -- Superadmin może czytać wszystkie komentarze
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = auth.uid() AND u.role = 'superadmin'
  )
  OR
  -- Dyrektor może czytać wszystkie komentarze
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = auth.uid() AND u.role = 'dyrektor'
  )
  OR
  -- Kierownik może czytać komentarze zadań z własnego działu
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = auth.uid() AND u.role = 'kierownik' 
    AND u.department_id = (
      SELECT department_id FROM public.tasks WHERE id = task_comments.task_id
    )
  )
  OR
  -- Pracownik może czytać komentarze własnych zadań
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = auth.uid() AND u.role = 'pracownik'
    AND u.id = (
      SELECT assigned_to FROM public.tasks WHERE id = task_comments.task_id
    )
  )
);

CREATE POLICY "task_comments_insert_policy" ON public.task_comments
FOR INSERT WITH CHECK (
  -- Zalogowani użytkownicy mogą dodawać komentarze
  auth.uid() IS NOT NULL
);

-- 14. Polityki RLS dla tabeli kluby_wsparcie
ALTER TABLE public.kluby_wsparcie ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kluby_wsparcie_select_policy" ON public.kluby_wsparcie
FOR SELECT USING (
  -- Wszyscy zalogowani użytkownicy mogą czytać dane klubów
  auth.uid() IS NOT NULL
);

CREATE POLICY "kluby_wsparcie_insert_policy" ON public.kluby_wsparcie
FOR INSERT WITH CHECK (
  -- Tylko superadmin i dyrektor mogą dodawać dane klubów
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = auth.uid() AND u.role IN ('superadmin', 'dyrektor')
  )
);

CREATE POLICY "kluby_wsparcie_update_policy" ON public.kluby_wsparcie
FOR UPDATE USING (
  -- Tylko superadmin i dyrektor mogą aktualizować dane klubów
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = auth.uid() AND u.role IN ('superadmin', 'dyrektor')
  )
);

-- 15. Polityki RLS dla tabeli obiekty_wejscia
ALTER TABLE public.obiekty_wejscia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "obiekty_wejscia_select_policy" ON public.obiekty_wejscia
FOR SELECT USING (
  -- Wszyscy zalogowani użytkownicy mogą czytać dane obiektów
  auth.uid() IS NOT NULL
);

CREATE POLICY "obiekty_wejscia_insert_policy" ON public.obiekty_wejscia
FOR INSERT WITH CHECK (
  -- Tylko superadmin i dyrektor mogą dodawać dane obiektów
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = auth.uid() AND u.role IN ('superadmin', 'dyrektor')
  )
);

CREATE POLICY "obiekty_wejscia_update_policy" ON public.obiekty_wejscia
FOR UPDATE USING (
  -- Tylko superadmin i dyrektor mogą aktualizować dane obiektów
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = auth.uid() AND u.role IN ('superadmin', 'dyrektor')
  )
);

-- 16. Polityki RLS dla tabeli rezerwacje
ALTER TABLE public.rezerwacje ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rezerwacje_select_policy" ON public.rezerwacje
FOR SELECT USING (
  -- Wszyscy zalogowani użytkownicy mogą czytać rezerwacje
  auth.uid() IS NOT NULL
);

CREATE POLICY "rezerwacje_insert_policy" ON public.rezerwacje
FOR INSERT WITH CHECK (
  -- Tylko superadmin i dyrektor mogą dodawać rezerwacje
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = auth.uid() AND u.role IN ('superadmin', 'dyrektor')
  )
);

CREATE POLICY "rezerwacje_update_policy" ON public.rezerwacje
FOR UPDATE USING (
  -- Tylko superadmin i dyrektor mogą aktualizować rezerwacje
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = auth.uid() AND u.role IN ('superadmin', 'dyrektor')
  )
);

-- 17. Polityki RLS dla tabeli survey_responses
ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "survey_responses_select_policy" ON public.survey_responses
FOR SELECT USING (
  -- Tylko superadmin i dyrektor mogą czytać odpowiedzi ankiet
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = auth.uid() AND u.role IN ('superadmin', 'dyrektor')
  )
);

CREATE POLICY "survey_responses_insert_policy" ON public.survey_responses
FOR INSERT WITH CHECK (
  -- Anonimowe ankiety mogą być wypełniane
  TRUE
);

-- 18. Sprawdzenie czy polityki zostały utworzone
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
WHERE tablename IN ('tasks', 'users', 'departments', 'system_settings', 'roles', 'role_scopes', 'notifications', 'task_changes', 'task_comments', 'kluby_wsparcie', 'obiekty_wejscia', 'rezerwacje', 'survey_responses')
ORDER BY tablename, policyname;
