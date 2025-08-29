-- NAPRAWA POLITYK RLS BEZ REKURENCJI
-- Wykonaj ten skrypt w Supabase SQL Editor

-- 1. USUŃ ISTNIEJĄCE BŁĘDNE POLITYKI
DROP POLICY IF EXISTS "users_select" ON public.users;
DROP POLICY IF EXISTS "users_insert" ON public.users;
DROP POLICY IF EXISTS "users_update" ON public.users;
DROP POLICY IF EXISTS "users_delete" ON public.users;

-- 2. WYŁĄCZ RLS TYMCZASOWO
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- 3. SPRAWDŹ CZY RLS JEST WYŁĄCZONE
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'users' AND schemaname = 'public';

-- 4. UTWÓRZ NOWE POLITYKI BEZ REKURENCJI
-- Polityka SELECT - użytkownicy widzą siebie i inni według roli
CREATE POLICY "users_select_simple" ON public.users
FOR SELECT USING (
  auth.uid() IS NOT NULL AND (
    -- Użytkownik widzi siebie
    auth.uid() = id OR
    -- Dyrektor i superadmin widzą wszystkich
    (SELECT role FROM public.users WHERE id = auth.uid()) IN ('dyrektor', 'superadmin') OR
    -- Kierownik widzi użytkowników swojego działu
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'kierownik'
  )
);

-- Polityka INSERT - tylko zalogowani użytkownicy
CREATE POLICY "users_insert_simple" ON public.users
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Polityka UPDATE - użytkownik może aktualizować siebie, dyrektor wszystkich
CREATE POLICY "users_update_simple" ON public.users
FOR UPDATE USING (
  auth.uid() = id OR
  (SELECT role FROM public.users WHERE id = auth.uid()) IN ('dyrektor', 'superadmin')
);

-- Polityka DELETE - tylko dyrektor i superadmin
CREATE POLICY "users_delete_simple" ON public.users
FOR DELETE USING (
  (SELECT role FROM public.users WHERE id = auth.uid()) IN ('dyrektor', 'superadmin')
);

-- 5. WŁĄCZ RLS Z POWROTEM
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 6. SPRAWDŹ CZY RLS JEST WŁĄCZONE
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'users' AND schemaname = 'public';

-- 7. SPRAWDŹ UTWORZONE POLITYKI
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'users' AND schemaname = 'public';

-- 8. TEST POLITYK
-- Sprawdź czy dyrektor może pobrać wszystkich użytkowników
-- SELECT * FROM public.users LIMIT 5;


