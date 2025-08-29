-- Naprawa niepoprawnych start_date
-- Wykonaj to w SQL Editor w Supabase Dashboard

-- 1. Sprawdź problematyczne zadania
SELECT 
    'PROBLEMATYCZNE ZADANIA' as info,
    id,
    title,
    status,
    start_date,
    due_date,
    created_at
FROM public.tasks
WHERE start_date > CURRENT_DATE OR start_date > due_date
ORDER BY created_at DESC;

-- 2. Napraw start_date dla zadań z due_date w przeszłości
UPDATE public.tasks 
SET start_date = DATE(created_at)
WHERE due_date < CURRENT_DATE AND (start_date > CURRENT_DATE OR start_date > due_date);

-- 3. Napraw start_date dla zadań z due_date w przyszłości
UPDATE public.tasks 
SET start_date = CASE
    WHEN due_date > CURRENT_DATE THEN DATE(due_date) - INTERVAL '7 days'
    ELSE DATE(created_at)
END
WHERE due_date > CURRENT_DATE AND (start_date > CURRENT_DATE OR start_date > due_date);

-- 4. Ustaw start_date dla zadań bez start_date
UPDATE public.tasks 
SET start_date = DATE(created_at)
WHERE start_date IS NULL;

-- 5. Sprawdź wyniki naprawy
SELECT 
    'PO NAPRAWIE' as info,
    id,
    title,
    status,
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
LIMIT 10;

-- 6. Sprawdź czy nie ma już problematycznych dat
SELECT 
    'SPRAWDZENIE PROBLEMÓW' as info,
    COUNT(*) as total_tasks,
    COUNT(CASE WHEN start_date > CURRENT_DATE THEN 1 END) as future_start_dates,
    COUNT(CASE WHEN start_date > due_date THEN 1 END) as invalid_date_ranges
FROM public.tasks;






