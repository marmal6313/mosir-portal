-- =============================================================
-- MIGRACJA: Multi-department dla użytkowników
-- Wykonaj ten skrypt w Supabase SQL Editor
-- =============================================================

-- 1. Utworzenie tabeli junction user_departments
CREATE TABLE IF NOT EXISTS public.user_departments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    department_id INTEGER NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, department_id)
);

-- 2. Indeksy dla wydajności
CREATE INDEX IF NOT EXISTS idx_user_departments_user_id ON public.user_departments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_departments_department_id ON public.user_departments(department_id);
CREATE INDEX IF NOT EXISTS idx_user_departments_user_dept ON public.user_departments(user_id, department_id);

-- 3. Migracja danych z users.department_id do user_departments
INSERT INTO public.user_departments (user_id, department_id, is_primary)
SELECT id, department_id, true
FROM public.users
WHERE department_id IS NOT NULL
ON CONFLICT (user_id, department_id) DO NOTHING;

-- 4. Włączenie RLS dla nowej tabeli
ALTER TABLE public.user_departments ENABLE ROW LEVEL SECURITY;

-- 5. Polityki RLS dla user_departments

-- SELECT: każdy zalogowany widzi powiązania (potrzebne do filtrowania)
CREATE POLICY "user_departments_select_policy" ON public.user_departments
FOR SELECT USING (
  auth.uid() IS NOT NULL
);

-- INSERT: superadmin i dyrektor mogą dodawać, kierownik tylko dla swoich pracowników
CREATE POLICY "user_departments_insert_policy" ON public.user_departments
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role IN ('superadmin', 'dyrektor')
  )
  OR
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role = 'kierownik'
    AND u.department_id = user_departments.department_id
  )
);

-- UPDATE: superadmin i dyrektor
CREATE POLICY "user_departments_update_policy" ON public.user_departments
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role IN ('superadmin', 'dyrektor')
  )
);

-- DELETE: superadmin i dyrektor
CREATE POLICY "user_departments_delete_policy" ON public.user_departments
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role IN ('superadmin', 'dyrektor')
  )
);

-- 6. Funkcja pomocnicza: pobierz department_ids użytkownika
CREATE OR REPLACE FUNCTION public.get_user_department_ids(p_user_id UUID)
RETURNS INTEGER[] AS $$
  SELECT COALESCE(array_agg(department_id), ARRAY[]::INTEGER[])
  FROM public.user_departments
  WHERE user_id = p_user_id;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- 7. Aktualizacja polityk RLS dla tasks - uwzględnienie wielu działów

-- Najpierw usuń stare polityki
DROP POLICY IF EXISTS "tasks_select_policy" ON public.tasks;
DROP POLICY IF EXISTS "tasks_insert_policy" ON public.tasks;
DROP POLICY IF EXISTS "tasks_update_policy" ON public.tasks;
DROP POLICY IF EXISTS "tasks_delete_policy" ON public.tasks;

-- SELECT: nowa polityka z multi-department
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
  -- Kierownik może czytać zadania ze WSZYSTKICH swoich działów
  EXISTS (
    SELECT 1 FROM public.users u
    JOIN public.user_departments ud ON ud.user_id = u.id
    WHERE u.id = auth.uid() AND u.role = 'kierownik'
    AND ud.department_id = tasks.department_id
  )
  OR
  -- Pracownik może czytać własne zadania i zadania ze WSZYSTKICH swoich działów
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role = 'pracownik'
    AND (
      u.id = tasks.assigned_to
      OR EXISTS (
        SELECT 1 FROM public.user_departments ud
        WHERE ud.user_id = u.id AND ud.department_id = tasks.department_id
      )
    )
  )
);

-- INSERT: nowa polityka z multi-department
CREATE POLICY "tasks_insert_policy" ON public.tasks
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role = 'superadmin'
  )
  OR
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role = 'dyrektor'
  )
  OR
  EXISTS (
    SELECT 1 FROM public.users u
    JOIN public.user_departments ud ON ud.user_id = u.id
    WHERE u.id = auth.uid() AND u.role = 'kierownik'
    AND ud.department_id = tasks.department_id
  )
  OR
  EXISTS (
    SELECT 1 FROM public.users u
    JOIN public.user_departments ud ON ud.user_id = u.id
    WHERE u.id = auth.uid() AND u.role = 'pracownik'
    AND ud.department_id = tasks.department_id
  )
);

-- UPDATE: nowa polityka z multi-department
CREATE POLICY "tasks_update_policy" ON public.tasks
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role = 'superadmin'
  )
  OR
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role = 'dyrektor'
  )
  OR
  EXISTS (
    SELECT 1 FROM public.users u
    JOIN public.user_departments ud ON ud.user_id = u.id
    WHERE u.id = auth.uid() AND u.role = 'kierownik'
    AND ud.department_id = tasks.department_id
  )
  OR
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role = 'pracownik'
    AND u.id = tasks.assigned_to
  )
);

-- DELETE: nowa polityka z multi-department
CREATE POLICY "tasks_delete_policy" ON public.tasks
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role = 'superadmin'
  )
  OR
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role = 'dyrektor'
  )
  OR
  EXISTS (
    SELECT 1 FROM public.users u
    JOIN public.user_departments ud ON ud.user_id = u.id
    WHERE u.id = auth.uid() AND u.role = 'kierownik'
    AND ud.department_id = tasks.department_id
  )
);

-- 8. Aktualizacja polityk RLS dla users - uwzględnienie wielu działów
DROP POLICY IF EXISTS "users_select_policy" ON public.users;

CREATE POLICY "users_select_policy" ON public.users
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role = 'superadmin'
  )
  OR
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role = 'dyrektor'
  )
  OR
  -- Kierownik widzi użytkowników ze WSZYSTKICH swoich działów
  EXISTS (
    SELECT 1 FROM public.users u
    JOIN public.user_departments ud_me ON ud_me.user_id = u.id
    JOIN public.user_departments ud_them ON ud_them.user_id = users.id
    WHERE u.id = auth.uid() AND u.role = 'kierownik'
    AND ud_me.department_id = ud_them.department_id
  )
  OR
  -- Pracownik widzi własny profil
  auth.uid() = users.id
);

-- 9. Aktualizacja polityk RLS dla departments
DROP POLICY IF EXISTS "departments_select_policy" ON public.departments;

CREATE POLICY "departments_select_policy" ON public.departments
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role = 'superadmin'
  )
  OR
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role = 'dyrektor'
  )
  OR
  -- Kierownik i pracownik widzą WSZYSTKIE swoje działy
  EXISTS (
    SELECT 1 FROM public.user_departments ud
    WHERE ud.user_id = auth.uid() AND ud.department_id = departments.id
  )
);

-- 10. Aktualizacja polityk RLS dla task_changes
DROP POLICY IF EXISTS "task_changes_select_policy" ON public.task_changes;

CREATE POLICY "task_changes_select_policy" ON public.task_changes
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role = 'superadmin'
  )
  OR
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role = 'dyrektor'
  )
  OR
  EXISTS (
    SELECT 1 FROM public.users u
    JOIN public.user_departments ud ON ud.user_id = u.id
    WHERE u.id = auth.uid() AND u.role = 'kierownik'
    AND ud.department_id = (
      SELECT department_id FROM public.tasks WHERE id = task_changes.task_id
    )
  )
  OR
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role = 'pracownik'
    AND u.id = (
      SELECT assigned_to FROM public.tasks WHERE id = task_changes.task_id
    )
  )
);

-- 11. Aktualizacja polityk RLS dla task_comments
DROP POLICY IF EXISTS "task_comments_select_policy" ON public.task_comments;

CREATE POLICY "task_comments_select_policy" ON public.task_comments
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role = 'superadmin'
  )
  OR
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role = 'dyrektor'
  )
  OR
  EXISTS (
    SELECT 1 FROM public.users u
    JOIN public.user_departments ud ON ud.user_id = u.id
    WHERE u.id = auth.uid() AND u.role = 'kierownik'
    AND ud.department_id = (
      SELECT department_id FROM public.tasks WHERE id = task_comments.task_id
    )
  )
  OR
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role = 'pracownik'
    AND u.id = (
      SELECT assigned_to FROM public.tasks WHERE id = task_comments.task_id
    )
  )
  OR
  task_comments.user_id = auth.uid()
);

-- 12. Aktualizacja widoku users_with_details z listą działów
DROP VIEW IF EXISTS public.users_with_details;
CREATE VIEW public.users_with_details AS
SELECT
    u.id,
    u.first_name,
    u.last_name,
    u.email,
    u.phone,
    u.whatsapp,
    u.position,
    u.role,
    u.active,
    u.department_id,
    d.name as department_name,
    CONCAT(u.first_name, ' ', u.last_name) as full_name,
    CONCAT(m.first_name, ' ', m.last_name) as manager_name,
    (
      SELECT COALESCE(array_agg(ud.department_id), ARRAY[]::INTEGER[])
      FROM public.user_departments ud
      WHERE ud.user_id = u.id
    ) as department_ids,
    (
      SELECT COALESCE(
        array_agg(dep.name ORDER BY dep.name),
        ARRAY[]::TEXT[]
      )
      FROM public.user_departments ud
      JOIN public.departments dep ON dep.id = ud.department_id
      WHERE ud.user_id = u.id
    ) as department_names
FROM public.users u
LEFT JOIN public.departments d ON u.department_id = d.id
LEFT JOIN public.users m ON u.manager_id = m.id;

-- 13. Weryfikacja migracji
SELECT
  'user_departments' as table_name,
  count(*) as row_count
FROM public.user_departments
UNION ALL
SELECT
  'users with department_id' as table_name,
  count(*) as row_count
FROM public.users WHERE department_id IS NOT NULL;
