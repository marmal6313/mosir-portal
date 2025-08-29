-- Kompleksowa naprawa wszystkich problemów z datami
-- Wykonaj to w SQL Editor w Supabase Dashboard

-- 1. Sprawdź obecny stan problematycznych zadań
SELECT 
    'PRZED NAPRAWĄ - PROBLEMATYCZNE ZADANIA' as info,
    id,
    title,
    status,
    start_date,
    due_date,
    created_at,
    CASE 
        WHEN start_date > due_date THEN 'start_date > due_date'
        WHEN start_date < DATE(created_at) THEN 'start_date < created_at'
        ELSE 'OK'
    END as problem
FROM public.tasks
WHERE start_date > due_date OR start_date < DATE(created_at)
ORDER BY created_at DESC;

-- 2. Napraw start_date - ustaw na 1 dzień po created_at
UPDATE public.tasks 
SET start_date = DATE(created_at) + INTERVAL '1 day'
WHERE start_date < DATE(created_at);

-- 3. Napraw start_date - ustaw na rozsądną datę przed due_date
UPDATE public.tasks 
SET start_date = CASE
    -- Jeśli due_date jest w przeszłości, ustaw start_date na 7 dni przed due_date
    WHEN due_date < CURRENT_DATE THEN DATE(due_date) - INTERVAL '7 days'
    -- Jeśli due_date jest w przyszłości, ustaw start_date na 7 dni przed due_date
    WHEN due_date > CURRENT_DATE THEN DATE(due_date) - INTERVAL '7 days'
    -- Domyślnie: 7 dni przed due_date
    ELSE DATE(due_date) - INTERVAL '7 days'
END
WHERE start_date > due_date;

-- 4. Upewnij się, że start_date nie jest wcześniejszy niż created_at
UPDATE public.tasks 
SET start_date = DATE(created_at) + INTERVAL '1 day'
WHERE start_date < DATE(created_at);

-- 5. Ustaw due_date dla zadań bez due_date (jeśli brak)
UPDATE public.tasks 
SET due_date = start_date + INTERVAL '7 days'
WHERE due_date IS NULL;

-- 6. Sprawdź wyniki naprawy
SELECT 
    'PO NAPRAWIE - PRZYKŁADOWE ZADANIA' as info,
    id,
    title,
    status,
    start_date,
    due_date,
    created_at,
    due_date::date - start_date as duration_days
FROM public.tasks
ORDER BY created_at DESC
LIMIT 10;

-- 7. Finalne sprawdzenie - czy wszystkie problemy zostały rozwiązane
SELECT 
    'FINALNE SPRAWDZENIE' as info,
    COUNT(*) as total_tasks,
    COUNT(CASE WHEN start_date > CURRENT_DATE THEN 1 END) as future_start_dates,
    COUNT(CASE WHEN start_date > due_date THEN 1 END) as invalid_date_ranges,
    COUNT(CASE WHEN start_date < DATE(created_at) THEN 1 END) as start_before_created,
    COUNT(CASE WHEN start_date IS NULL THEN 1 END) as missing_start_dates,
    COUNT(CASE WHEN due_date IS NULL THEN 1 END) as missing_due_dates
FROM public.tasks;

-- 8. Sprawdź przykładowe poprawne zadania
SELECT 
    'PRZYKŁADOWE POPRAWNE ZADANIA' as info,
    id,
    title,
    status,
    start_date,
    due_date,
    created_at,
    due_date::date - start_date as duration_days
FROM public.tasks
WHERE start_date IS NOT NULL 
  AND due_date IS NOT NULL 
  AND start_date <= due_date
  AND start_date >= DATE(created_at)
ORDER BY created_at DESC
LIMIT 5;






