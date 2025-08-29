-- Sprawdzenie czy widoki istnieją
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('users_with_details', 'tasks_with_details');

-- Sprawdzenie polityk RLS dla widoków
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('users_with_details', 'tasks_with_details');

-- Sprawdzenie czy RLS jest włączone dla widoków
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('users_with_details', 'tasks_with_details');

-- Test zapytania do widoku users_with_details
SELECT * FROM users_with_details LIMIT 5; 