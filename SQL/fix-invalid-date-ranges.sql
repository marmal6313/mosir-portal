-- Naprawa zadań gdzie start_date > due_date
-- Wykonaj to w SQL Editor w Supabase Dashboard

-- 1. Sprawdź problematyczne zadania
SELECT 
    'ZADANIA Z NIEPOPRAWNYMI DATAMI' as info,
    id,
    title,
    status,
    start_date,
    due_date,
    created_at,
    CASE 
        WHEN start_date > due_date THEN 'start_date > due_date'
        ELSE 'OK'
    END as problem
FROM public.tasks
WHERE start_date > due_date
ORDER BY created_at DESC;

-- 2. Napraw zadania gdzie start_date > due_date
UPDATE public.tasks 
SET start_date = CASE
    -- Jeśli due_date jest w przeszłości, użyj created_at
    WHEN due_date < CURRENT_DATE THEN DATE(created_at)
    -- Jeśli due_date jest w przyszłości, ustaw start_date na 7 dni przed due_date
    WHEN due_date > CURRENT_DATE THEN DATE(due_date) - INTERVAL '7 days'
    -- Domyślnie użyj created_at
    ELSE DATE(created_at)
END
WHERE start_date > due_date;

-- 3. Sprawdź wyniki naprawy
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

-- 4. Sprawdź czy problem został rozwiązany
SELECT 
    'FINALNE SPRAWDZENIE' as info,
    COUNT(*) as total_tasks,
    COUNT(CASE WHEN start_date > CURRENT_DATE THEN 1 END) as future_start_dates,
    COUNT(CASE WHEN start_date > due_date THEN 1 END) as invalid_date_ranges,
    COUNT(CASE WHEN start_date IS NULL THEN 1 END) as missing_start_dates
FROM public.tasks;

-- 5. Sprawdź przykładowe poprawne zadania
SELECT 
    'PRZYKŁADOWE POPRAWNE ZADANIA' as info,
    id,
    title,
    status,
    start_date,
    due_date,
    due_date::date - start_date as duration_days
FROM public.tasks
WHERE start_date IS NOT NULL 
  AND due_date IS NOT NULL 
  AND start_date <= due_date
ORDER BY created_at DESC
LIMIT 5;






