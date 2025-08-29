-- Aktualizacja istniejących zadań z rozsądnymi wartościami start_date
-- Wykonaj to w SQL Editor w Supabase Dashboard DOPO dodania kolumny start_date

-- 1. Najpierw cofnij niepoprawne ustawienia start_date (jeśli były ustawione na przyszłość)
UPDATE public.tasks 
SET start_date = NULL
WHERE start_date > CURRENT_DATE;

-- 2. Dla zadań ukończonych: ustaw start_date na 7 dni przed due_date (lub created_at jeśli brak due_date)
UPDATE public.tasks 
SET start_date = CASE 
    WHEN due_date IS NOT NULL AND due_date > created_at THEN DATE(due_date) - INTERVAL '7 days'
    ELSE DATE(created_at)
END
WHERE status = 'completed' AND (start_date IS NULL OR start_date > CURRENT_DATE);

-- 3. Dla zadań w trakcie: ustaw start_date na 3 dni przed due_date (lub created_at)
UPDATE public.tasks 
SET start_date = CASE 
    WHEN due_date IS NOT NULL AND due_date > created_at THEN DATE(due_date) - INTERVAL '3 days'
    ELSE DATE(created_at)
END
WHERE status = 'in_progress' AND (start_date IS NULL OR start_date > CURRENT_DATE);

-- 4. Dla nowych zadań z wysokim priorytetem: ustaw start_date na dzisiaj lub created_at
UPDATE public.tasks 
SET start_date = CASE
    WHEN due_date IS NOT NULL AND due_date > created_at THEN DATE(due_date) - INTERVAL '5 days'
    ELSE DATE(created_at)
END
WHERE status = 'new' AND priority = 'high' AND (start_date IS NULL OR start_date > CURRENT_DATE);

-- 5. Dla pozostałych zadań: ustaw start_date na created_at
UPDATE public.tasks 
SET start_date = DATE(created_at)
WHERE start_date IS NULL OR start_date > CURRENT_DATE;

-- 6. Sprawdź wyniki aktualizacji
SELECT 
    status, 
    priority,
    COUNT(*) as count,
    MIN(start_date) as earliest_start,
    MAX(start_date) as latest_start
FROM public.tasks 
WHERE start_date IS NOT NULL
GROUP BY status, priority
ORDER BY status, priority;

-- 7. Sprawdź przykładowe zadania z start_date
SELECT 
    id,
    title,
    status,
    priority,
    start_date,
    due_date,
    DATE(created_at) as created_date,
    CASE 
        WHEN due_date IS NOT NULL AND start_date IS NOT NULL THEN due_date::date - start_date 
        ELSE NULL 
    END as duration_days
FROM public.tasks
WHERE start_date IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;

-- 8. Sprawdź czy nie ma zadań z niepoprawnymi datami
SELECT 
    id,
    title,
    status,
    start_date,
    due_date,
    created_at
FROM public.tasks
WHERE start_date > due_date OR start_date > CURRENT_DATE
ORDER BY created_at DESC;
