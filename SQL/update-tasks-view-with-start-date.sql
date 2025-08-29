-- Aktualizacja widoku tasks_with_details o pole start_date
-- Wykonaj to w SQL Editor w Supabase Dashboard DOPO dodania kolumny start_date

-- 1. Najpierw usuń istniejący widok
DROP VIEW IF EXISTS public.tasks_with_details;

-- 2. Utwórz zaktualizowany widok z polem start_date
CREATE VIEW public.tasks_with_details AS
SELECT 
    t.id,
    t.title,
    t.description,
    t.priority,
    t.status,
    t.start_date,          -- NOWE POLE
    t.due_date,
    t.week_number,
    t.created_at,
    t.updated_at,
    t.department_id,
    d.name AS department_name,
    t.assigned_to,
    u1.email AS assigned_to_email,
    CASE
        WHEN ((u1.first_name IS NOT NULL) AND (u1.last_name IS NOT NULL)) THEN concat(u1.first_name, ' ', u1.last_name)
        ELSE 'Nieprzydzielone'::text
    END AS assigned_to_name,
    t.created_by,
    CASE
        WHEN ((u2.first_name IS NOT NULL) AND (u2.last_name IS NOT NULL)) THEN concat(u2.first_name, ' ', u2.last_name)
        ELSE 'Nieznany'::text
    END AS created_by_name
FROM 
    public.tasks t
    LEFT JOIN public.departments d ON ((t.department_id = d.id))
    LEFT JOIN public.users u1 ON ((t.assigned_to = u1.id))
    LEFT JOIN public.users u2 ON ((t.created_by = u2.id));

-- 3. Sprawdź czy widok działa poprawnie
SELECT id, title, start_date, due_date, status, department_name, assigned_to_name
FROM public.tasks_with_details
ORDER BY created_at DESC
LIMIT 5;

-- 4. Sprawdź strukturę nowego widoku
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'tasks_with_details' 
AND table_schema = 'public'
ORDER BY ordinal_position;
