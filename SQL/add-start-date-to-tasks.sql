-- Dodanie pola start_date do tabeli tasks
-- Wykonaj to w SQL Editor w Supabase Dashboard

-- 1. Dodaj kolumnę start_date do tabeli tasks
ALTER TABLE public.tasks 
ADD COLUMN start_date DATE;

-- 2. Ustaw domyślną wartość start_date dla istniejących zadań
-- Użyj created_at jako domyślnej daty rozpoczęcia
UPDATE public.tasks 
SET start_date = DATE(created_at) 
WHERE start_date IS NULL;

-- 3. Opcjonalnie: ustaw start_date jako NOT NULL (jeśli chcesz wymagać tej wartości)
-- ALTER TABLE public.tasks 
-- ALTER COLUMN start_date SET NOT NULL;

-- 4. Sprawdź czy kolumna została dodana poprawnie
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'tasks' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 5. Sprawdź przykładowe dane
SELECT id, title, start_date, due_date, created_at, status
FROM public.tasks
ORDER BY created_at DESC
LIMIT 5;

-- 6. Zaktualizuj widok tasks_with_details, aby zawierał start_date
-- Najpierw sprawdź definicję obecnego widoku
SELECT definition 
FROM pg_views 
WHERE viewname = 'tasks_with_details' 
AND schemaname = 'public';






