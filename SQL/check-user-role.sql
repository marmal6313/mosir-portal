-- SPRAWDŹ ROLĘ UŻYTKOWNIKA W BAZIE DANYCH
-- Wykonaj ten skrypt w Supabase SQL Editor

-- 1. Sprawdź tabelę users
SELECT id, email, role, department_id, first_name, last_name
FROM public.users
WHERE email = 'dyrektor@e-mosir.pl';

-- 2. Sprawdź widok users_with_details
SELECT id, email, role, department_id, first_name, last_name
FROM public.users_with_details
WHERE email = 'dyrektor@e-mosir.pl';

-- 3. Sprawdź czy pole role jest poprawnie ustawione
SELECT
  u.id,
  u.email,
  u.role as users_role,
  ud.role as view_role,
  u.department_id,
  u.first_name,
  u.last_name
FROM public.users u
LEFT JOIN public.users_with_details ud ON u.id = ud.id
WHERE u.email = 'dyrektor@e-mosir.pl';

-- 4. Sprawdź wszystkie role w systemie
SELECT DISTINCT role, COUNT(*) as count
FROM public.users
GROUP BY role
ORDER BY role;

-- 5. SPRAWDŹ DEFINICJĘ WIDOKU users_with_details
SELECT
  schemaname,
  viewname,
  definition
FROM pg_views
WHERE viewname = 'users_with_details';

-- 6. SPRAWDŹ STRUKTURĘ WIDOKU users_with_details
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'users_with_details'
ORDER BY ordinal_position;

-- 7. SPRAWDŹ CZY WIDOK ZAWIERA POLE role
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'users_with_details'
  AND column_name = 'role';
