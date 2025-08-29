-- Skrypt do sprawdzenia i naprawy widoków w bazie MOSiR Portal
-- Uruchom w Supabase SQL Editor

-- 1. Sprawdź definicje widoków
SELECT '=== DEFINICJE WIDOKÓW ===' as info;

-- Sprawdź definicję widoku tasks_with_details
SELECT 'Widok tasks_with_details:' as info;
SELECT 
    viewname,
    definition
FROM pg_views 
WHERE viewname = 'tasks_with_details';

-- Sprawdź definicję widoku users_with_details
SELECT 'Widok users_with_details:' as info;
SELECT 
    viewname,
    definition
FROM pg_views 
WHERE viewname = 'users_with_details';

-- 2. Sprawdź czy widoki są aktualne
SELECT '=== SPRAWDZENIE AKTUALNOŚCI WIDOKÓW ===' as info;

-- Sprawdź czy widok tasks_with_details ma dane
SELECT 'Liczba rekordów w tasks_with_details:' as info, COUNT(*) as count FROM tasks_with_details;

-- Sprawdź czy widok users_with_details ma dane
SELECT 'Liczba rekordów w users_with_details:' as info, COUNT(*) as count FROM users_with_details;

-- 3. Sprawdź strukturę widoków
SELECT '=== STRUKTURA WIDOKÓW ===' as info;

-- Sprawdź kolumny w tasks_with_details
SELECT 'Kolumny w tasks_with_details:' as info;
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'tasks_with_details'
ORDER BY ordinal_position;

-- Sprawdź kolumny w users_with_details
SELECT 'Kolumny w users_with_details:' as info;
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'users_with_details'
ORDER BY ordinal_position;

-- 4. Sprawdź relacje w widokach
SELECT '=== RELACJE W WIDOKACH ===' as info;

-- Sprawdź relacje w tasks_with_details
SELECT 'Relacje w tasks_with_details:' as info;
SELECT 
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'tasks_with_details' AND tc.constraint_type = 'FOREIGN KEY';

-- 5. Sprawdź czy widoki mają błędy
SELECT '=== SPRAWDZENIE BŁĘDÓW W WIDOKACH ===' as info;

-- Sprawdź czy można wykonać SELECT na widokach
SELECT 'Test SELECT na tasks_with_details:' as info;
BEGIN;
    SELECT COUNT(*) FROM tasks_with_details LIMIT 1;
ROLLBACK;

SELECT 'Test SELECT na users_with_details:' as info;
BEGIN;
    SELECT COUNT(*) FROM users_with_details LIMIT 1;
ROLLBACK;

-- 6. Sprawdź uprawnienia do widoków
SELECT '=== UPRAWNIENIA DO WIDOKÓW ===' as info;

-- Sprawdź uprawnienia dla roli anon
SELECT 
    grantee,
    table_name,
    privilege_type
FROM information_schema.table_privileges 
WHERE table_name IN ('tasks_with_details', 'users_with_details')
   AND (grantee = 'anon' OR grantee = 'authenticated')
ORDER BY grantee, table_name;

-- 7. Rekomendacje
SELECT '=== REKOMENDACJE ===' as info;
SELECT '1. Sprawdź czy widoki mają poprawne definicje' as recommendation;
SELECT '2. Sprawdź czy nie ma błędów w relacjach' as recommendation;
SELECT '3. Sprawdź czy uprawnienia są poprawnie ustawione' as recommendation;
SELECT '4. Jeśli widoki mają błędy, może być konieczne ich odtworzenie' as recommendation;
SELECT '5. Po naprawie widoków możesz włączyć RLS' as recommendation;

-- 8. Przykładowe zapytania do testowania widoków
SELECT '=== PRZYKŁADOWE ZAPYTANIA TESTOWE ===' as info;

-- Test widoku tasks_with_details
SELECT 'Test tasks_with_details - ostatnie 5 zadań:' as info;
SELECT 
    id,
    title,
    status,
    priority,
    department_name,
    assigned_to_name
FROM tasks_with_details 
ORDER BY created_at DESC 
LIMIT 5;

-- Test widoku users_with_details
SELECT 'Test users_with_details - użytkownicy z działami:' as info;
SELECT 
    id,
    full_name,
    email,
    department_name,
    role
FROM users_with_details 
ORDER BY department_id, full_name 
LIMIT 10;

