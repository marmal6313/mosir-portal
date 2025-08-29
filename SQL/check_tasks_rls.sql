-- Sprawdź aktualne polityki RLS dla tabeli tasks
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
WHERE tablename = 'tasks';

-- Sprawdź czy RLS jest włączone dla tabeli tasks
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'tasks';

-- Tymczasowo wyłącz RLS dla tabeli tasks (tylko do testowania)
ALTER TABLE tasks DISABLE ROW LEVEL SECURITY;

-- Lub dodaj politykę, która pozwala na aktualizację
CREATE POLICY "Enable update for authenticated users" ON tasks
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Włącz RLS z powrotem
-- ALTER TABLE tasks ENABLE ROW LEVEL SECURITY; 