-- =============================================================
-- WERYFIKACJA MIGRACJI: Multi-department dla użytkowników
-- Wykonaj po migracji w Supabase SQL Editor
-- Każde zapytanie powinno zwrócić wynik - czytaj komentarze
-- =============================================================

-- ✅ 1. Czy tabela user_departments istnieje?
-- Oczekiwany wynik: 1 wiersz z "user_departments"
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'user_departments';

-- ✅ 2. Czy kolumny tabeli są poprawne?
-- Oczekiwany wynik: 5 wierszy (id, user_id, department_id, is_primary, created_at)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'user_departments'
ORDER BY ordinal_position;

-- ✅ 3. Czy indeksy zostały utworzone?
-- Oczekiwany wynik: min. 3 indeksy (idx_user_departments_*)
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'user_departments'
ORDER BY indexname;

-- ✅ 4. Czy dane zostały zmigrowane z users.department_id?
-- Oczekiwany wynik: obie liczby powinny być RÓWNE
SELECT
  'users z department_id' as opis,
  count(*) as ilosc
FROM public.users WHERE department_id IS NOT NULL
UNION ALL
SELECT
  'wpisy w user_departments' as opis,
  count(*) as ilosc
FROM public.user_departments;

-- ✅ 5. Czy wszyscy użytkownicy z department_id mają wpis w user_departments?
-- Oczekiwany wynik: 0 wierszy (brak brakujących)
SELECT u.id, u.email, u.department_id
FROM public.users u
WHERE u.department_id IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM public.user_departments ud
  WHERE ud.user_id = u.id AND ud.department_id = u.department_id
);

-- ✅ 6. Czy RLS jest włączony na user_departments?
-- Oczekiwany wynik: rowsecurity = true
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname = 'user_departments';

-- ✅ 7. Czy polityki RLS zostały utworzone?
-- Oczekiwany wynik: 4 polityki (select, insert, update, delete)
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'user_departments'
ORDER BY policyname;

-- ✅ 8. Czy polityki tasks zostały zaktualizowane (multi-department)?
-- Oczekiwany wynik: 4 polityki (select, insert, update, delete)
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'tasks'
ORDER BY policyname;

-- ✅ 9. Czy widok users_with_details zawiera nowe kolumny?
-- Oczekiwany wynik: powinny być kolumny department_ids i department_names
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'users_with_details'
  AND column_name IN ('department_ids', 'department_names')
ORDER BY column_name;

-- ✅ 10. Czy funkcja get_user_department_ids istnieje?
-- Oczekiwany wynik: 1 wiersz
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'get_user_department_ids';

-- ✅ 11. Test funkcjonalny - sprawdź dane widoku
-- Oczekiwany wynik: lista użytkowników z ich działami
SELECT
  id,
  email,
  full_name,
  role,
  department_name,
  department_ids,
  department_names
FROM public.users_with_details
ORDER BY full_name
LIMIT 10;

-- ✅ 12. Test: czy is_primary jest ustawiony poprawnie?
-- Oczekiwany wynik: wszyscy zmigrowane wpisy powinny mieć is_primary = true
SELECT
  is_primary,
  count(*) as ilosc
FROM public.user_departments
GROUP BY is_primary;

-- ✅ 13. Podsumowanie migracji
SELECT
  '🟢 Tabela user_departments' as element,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_departments') THEN 'OK' ELSE 'BRAK' END as status
UNION ALL
SELECT
  '🟢 Indeksy',
  CASE WHEN (SELECT count(*) FROM pg_indexes WHERE tablename = 'user_departments') >= 3 THEN 'OK' ELSE 'BRAK' END
UNION ALL
SELECT
  '🟢 RLS włączony',
  CASE WHEN (SELECT relrowsecurity FROM pg_class WHERE relname = 'user_departments') THEN 'OK' ELSE 'BRAK' END
UNION ALL
SELECT
  '🟢 Polityki RLS',
  CASE WHEN (SELECT count(*) FROM pg_policies WHERE tablename = 'user_departments') >= 4 THEN 'OK' ELSE 'BRAK' END
UNION ALL
SELECT
  '🟢 Dane zmigrowane',
  CASE WHEN (
    SELECT count(*) FROM public.users WHERE department_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.user_departments ud WHERE ud.user_id = users.id)
  ) = 0 THEN 'OK' ELSE 'BRAK DANYCH' END
UNION ALL
SELECT
  '🟢 Widok zaktualizowany',
  CASE WHEN (
    SELECT count(*) FROM information_schema.columns
    WHERE table_name = 'users_with_details' AND column_name = 'department_ids'
  ) > 0 THEN 'OK' ELSE 'BRAK' END
UNION ALL
SELECT
  '🟢 Funkcja get_user_department_ids',
  CASE WHEN (
    SELECT count(*) FROM information_schema.routines
    WHERE routine_name = 'get_user_department_ids'
  ) > 0 THEN 'OK' ELSE 'BRAK' END;
