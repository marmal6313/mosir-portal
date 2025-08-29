-- Tymczasowe wyłączenie RLS dla tabeli users
-- UWAGA: To rozwiązanie jest tylko do testowania!
-- W produkcji zawsze używaj polityk RLS

ALTER TABLE users DISABLE ROW LEVEL SECURITY; 