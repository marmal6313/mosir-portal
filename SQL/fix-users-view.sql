-- Naprawa widoku users_with_details - dodanie department_id
-- Wykonaj w Supabase SQL Editor

-- 1. Sprawdź aktualną strukturę widoku
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users_with_details' 
ORDER BY ordinal_position;

-- 2. Usuń stary widok
DROP VIEW IF EXISTS public.users_with_details;

-- 3. Utwórz nowy widok z department_id
CREATE VIEW public.users_with_details AS
SELECT 
    u.id,
    u.email,
    u.first_name,
    u.last_name,
    u.phone,
    u.whatsapp,
    u.position,
    u.role,
    u.active,
    u.created_at,
    u.updated_at,
    u.avatar_url,
    u.manager_id,
    u.department_id,  -- Dodane pole
    d.name as department_name,
    CONCAT(u.first_name, ' ', u.last_name) as full_name,
    CASE 
        WHEN u.manager_id IS NOT NULL THEN 
            CONCAT(m.first_name, ' ', m.last_name)
        ELSE NULL
    END as manager_name
FROM public.users u
LEFT JOIN public.departments d ON u.department_id = d.id
LEFT JOIN public.users m ON u.manager_id = m.id;

-- 4. Sprawdź nową strukturę
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users_with_details' 
ORDER BY ordinal_position;

-- 5. Sprawdź dane w widoku
SELECT id, email, first_name, last_name, department_id, department_name 
FROM public.users_with_details 
LIMIT 5;

