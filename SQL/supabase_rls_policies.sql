-- Polityki RLS dla tabeli users
-- Wykonaj te zapytania w SQL Editor w Supabase

-- 1. Włącz RLS dla tabeli users (jeśli nie jest włączone)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 2. Polityka dla użytkowników - mogą czytać tylko swoje dane
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (auth.uid() = id);

-- 3. Polityka dla użytkowników - mogą aktualizować tylko swoje dane
CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (auth.uid() = id);

-- 4. Polityka dla administratorów - mogą czytać wszystkie dane
CREATE POLICY "Admins can view all users" ON users
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    );

-- 5. Polityka dla administratorów - mogą aktualizować wszystkie dane
CREATE POLICY "Admins can update all users" ON users
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    );

-- 6. Polityka dla wstawiania nowych użytkowników
CREATE POLICY "Users can insert own profile" ON users
    FOR INSERT WITH CHECK (auth.uid() = id); 