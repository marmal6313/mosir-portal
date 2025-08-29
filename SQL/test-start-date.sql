-- Test czy start_date działa poprawnie
-- Wykonaj to w SQL Editor w Supabase Dashboard

-- 1. Sprawdź obecny stan
SELECT 
    'Obecny stan' as info,
    COUNT(*) as total_tasks,
    COUNT(start_date) as tasks_with_start_date,
    COUNT(*) - COUNT(start_date) as tasks_without_start_date
FROM public.tasks;

-- 2. Sprawdź przykładowe zadania
SELECT 
    id,
    title,
    status,
    priority,
    start_date,
    due_date,
    created_at,
    CASE 
        WHEN start_date IS NOT NULL AND due_date IS NOT NULL 
        THEN due_date::date - start_date 
        ELSE NULL 
    END as duration_days
FROM public.tasks
ORDER BY created_at DESC
LIMIT 5;

-- 3. Sprawdź czy widok tasks_with_details zawiera start_date
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'tasks_with_details' 
AND table_schema = 'public'
AND column_name = 'start_date';

-- 4. Test widoku tasks_with_details
SELECT 
    id,
    title,
    start_date,
    due_date,
    status,
    department_name
FROM public.tasks_with_details
ORDER BY created_at DESC
LIMIT 3;






