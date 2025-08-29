-- Naprawa polityk RLS dla tabeli users
-- Wykonaj te zapytania w SQL Editor w Supabase

-- 1. Usuń wszystkie istniejące polityki dla tabeli users
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Admins can view all users" ON users;
DROP POLICY IF EXISTS "Admins can update all users" ON users;
DROP POLICY IF EXISTS "Users can insert own profile" ON users;

-- 2. Sprawdź czy RLS jest włączone
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'users';

-- 3. Tymczasowo wyłącz RLS dla testowania
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- 4. Sprawdź czy to naprawiło problem
-- Wykonaj w SQL Editor: SELECT * FROM users LIMIT 5;

-- 5. Jeśli chcesz włączyć RLS ponownie, użyj prostych polityk:
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- 
-- CREATE POLICY "Enable read access for all users" ON users
--     FOR SELECT USING (true);
-- 
-- CREATE POLICY "Enable insert for authenticated users only" ON users
--     FOR INSERT WITH CHECK (auth.uid() = id);
-- 
-- CREATE POLICY "Enable update for users based on id" ON users
--     FOR UPDATE USING (auth.uid() = id); 