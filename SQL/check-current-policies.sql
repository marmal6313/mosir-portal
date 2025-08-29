-- Sprawdzenie aktualnego stanu polityk RLS
-- Wykonaj ten skrypt w Supabase SQL Editor

-- 1. Sprawdzenie wszystkich polityk dla tabel tasks, users, notifications
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename IN ('tasks', 'users', 'notifications')
ORDER BY tablename, policyname;

-- 2. Sprawdzenie czy istnieją polityki z "simple" w nazwie
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd
FROM pg_policies 
WHERE tablename IN ('tasks', 'users', 'notifications')
AND policyname LIKE '%simple%'
ORDER BY tablename, policyname;

-- 3. Sprawdzenie czy istnieją stare polityki które mogą powodować problemy
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd
FROM pg_policies 
WHERE tablename IN ('tasks', 'users', 'notifications')
AND (
    policyname LIKE '%new%' OR
    policyname LIKE '%old%' OR
    policyname LIKE '%recursion%'
)
ORDER BY tablename, policyname;

-- 4. Sprawdzenie czy RLS jest włączone i czy tabele mają polityki
SELECT 
    t.schemaname,
    t.tablename,
    t.rowsecurity,
    COUNT(p.policyname) as policy_count
FROM pg_tables t
LEFT JOIN pg_policies p ON t.tablename = p.tablename AND t.schemaname = p.schemaname
WHERE t.tablename IN ('tasks', 'users', 'notifications')
AND t.schemaname = 'public'
GROUP BY t.schemaname, t.tablename, t.rowsecurity
ORDER BY t.tablename;


