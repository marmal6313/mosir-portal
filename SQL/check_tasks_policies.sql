-- Sprawdź wszystkie polityki dla tabeli tasks
SELECT 
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'tasks';

-- Sprawdź czy RLS jest włączone
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'tasks';

-- Sprawdź uprawnienia dla tabeli tasks
SELECT 
    grantee,
    privilege_type,
    is_grantable
FROM information_schema.role_table_grants 
WHERE table_name = 'tasks';

-- Sprawdź czy użytkownik anon ma uprawnienia
SELECT has_table_privilege('anon', 'tasks', 'UPDATE');
SELECT has_table_privilege('authenticated', 'tasks', 'UPDATE'); 