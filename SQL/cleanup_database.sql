-- Skrypt do czyszczenia bazy danych MOSiR Portal
-- Uruchom w Supabase SQL Editor

-- 1. Sprawdź aktualne dane w tabelach
SELECT '=== SPRAWDZENIE AKTUALNYCH DANYCH ===' as info;

-- Sprawdź liczbę zadań
SELECT 'Liczba zadań w tabeli tasks:' as info, COUNT(*) as count FROM tasks;

-- Sprawdź zadania z błędnymi przypisaniami
SELECT 'Zadania z błędnymi przypisaniami do działów:' as info;
SELECT 
    t.id,
    t.title,
    t.department_id,
    d.name as department_name,
    t.assigned_to,
    u.email as assigned_user_email,
    u.department_id as user_department_id,
    ud.name as user_department_name
FROM tasks t
LEFT JOIN departments d ON t.department_id = d.id
LEFT JOIN users u ON t.assigned_to = u.id
LEFT JOIN departments ud ON u.department_id = ud.id
WHERE t.department_id IS NOT NULL 
   OR t.assigned_to IS NOT NULL;

-- Sprawdź użytkowników i ich działy
SELECT 'Użytkownicy i ich działy:' as info;
SELECT 
    u.id,
    u.email,
    u.first_name,
    u.last_name,
    u.department_id,
    d.name as department_name
FROM users u
LEFT JOIN departments d ON u.department_id = d.id
ORDER BY u.department_id, u.email;

-- Sprawdź działy
SELECT 'Działy:' as info;
SELECT * FROM departments ORDER BY id;

-- 2. USUŃ WSZYSTKIE ZADANIA (UWAGA: TO JEST NIEODWRACALNE!)
SELECT '=== USUWANIE WSZYSTKICH ZADAŃ ===' as info;

-- Usuń powiadomienia związane z zadaniami
DELETE FROM notifications WHERE task_id IS NOT NULL;

-- Usuń wszystkie zadania
DELETE FROM tasks;

-- 3. Sprawdź czy zadania zostały usunięte
SELECT '=== SPRAWDZENIE PO USUNIĘCIU ===' as info;
SELECT 'Liczba zadań po usunięciu:' as info, COUNT(*) as count FROM tasks;

-- 4. Sprawdź widoki
SELECT '=== SPRAWDZENIE WIDOKÓW ===' as info;

-- Sprawdź widok tasks_with_details
SELECT 'Widok tasks_with_details:' as info;
SELECT COUNT(*) as count FROM tasks_with_details;

-- Sprawdź widok users_with_details
SELECT 'Widok users_with_details:' as info;
SELECT COUNT(*) as count FROM users_with_details;

-- 5. Sprawdź relacje i klucze obce
SELECT '=== SPRAWDZENIE RELACJI ===' as info;

-- Sprawdź klucze obce w tabeli tasks
SELECT 
    tc.table_name,
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
WHERE tc.table_name = 'tasks' AND tc.constraint_type = 'FOREIGN KEY';

-- 6. Sprawdź czy można włączyć RLS
SELECT '=== SPRAWDZENIE RLS ===' as info;

-- Sprawdź czy RLS jest włączone na tabelach
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename IN ('tasks', 'users', 'departments', 'notifications')
ORDER BY tablename;

-- 7. Sprawdź uprawnienia
SELECT '=== SPRAWDZENIE UPRAWNIEŃ ===' as info;

-- Sprawdź uprawnienia dla roli anon
SELECT 
    grantee,
    table_name,
    privilege_type
FROM information_schema.table_privileges 
WHERE grantee = 'anon' 
   OR grantee = 'authenticated'
ORDER BY grantee, table_name;

-- 8. Rekomendacje
SELECT '=== REKOMENDACJE ===' as info;
SELECT '1. Wszystkie zadania zostały usunięte' as recommendation;
SELECT '2. Sprawdź czy widoki są puste' as recommendation;
SELECT '3. Sprawdź czy nie ma błędnych relacji' as recommendation;
SELECT '4. Możesz teraz włączyć RLS na tabeli tasks' as recommendation;
SELECT '5. Utwórz nowe zadania z poprawnymi danymi' as recommendation;

