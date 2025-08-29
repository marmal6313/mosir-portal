-- Sprawdzenie czy użytkownik istnieje
SELECT * FROM users WHERE id = '2c0880c1-5d9b-415c-ba71-afd2fad942cb';

-- Sprawdzenie wszystkich użytkowników
SELECT id, email, first_name, last_name FROM users LIMIT 10; 