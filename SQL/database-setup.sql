-- Skrypt konfiguracji bazy danych MOSiR Portal
-- Wykonaj ten skrypt w Supabase SQL Editor

-- 0. Sprawdzenie constraint'ów dla tabeli users
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'public.users'::regclass 
AND conname = 'users_role_check';

-- 1. USUNIĘCIE constraint'u users_role_check (żeby móc zaktualizować użytkowników)
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;

-- 2. Sprawdzenie jakie role mają obecnie użytkownicy
SELECT DISTINCT role FROM public.users WHERE role IS NOT NULL;

-- 3. Aktualizacja istniejących użytkowników na nowe role
UPDATE public.users SET role = 'pracownik' WHERE role = 'employee';
UPDATE public.users SET role = 'kierownik' WHERE role = 'manager';
UPDATE public.users SET role = 'dyrektor' WHERE role = 'director';
UPDATE public.users SET role = 'superadmin' WHERE role = 'admin';

-- 4. Sprawdzenie czy aktualizacja się powiodła
SELECT DISTINCT role FROM public.users WHERE role IS NOT NULL;

-- 5. DODANIE NOWEGO constraint'u users_role_check
ALTER TABLE public.users ADD CONSTRAINT users_role_check 
CHECK (role::text = ANY (ARRAY['pracownik'::text, 'kierownik'::text, 'dyrektor'::text, 'superadmin'::text]));

-- 6. Utworzenie tabeli system_settings
CREATE TABLE IF NOT EXISTS public.system_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    value TEXT,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by UUID REFERENCES public.users(id)
);

-- 7. Utworzenie indeksu dla szybszego wyszukiwania
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON public.system_settings(key);

-- 8. Utworzenie tabeli roles
CREATE TABLE IF NOT EXISTS public.roles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    color VARCHAR(7),
    permissions TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Utworzenie tabeli role_scopes
CREATE TABLE IF NOT EXISTS public.role_scopes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    resource VARCHAR(100) NOT NULL,
    scope VARCHAR(20) NOT NULL CHECK (scope IN ('global', 'department', 'own', 'none')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(role_id, resource)
);

-- 10. Utworzenie indeksów dla tabel roles i role_scopes
CREATE INDEX IF NOT EXISTS idx_roles_name ON public.roles(name);
CREATE INDEX IF NOT EXISTS idx_role_scopes_role_id ON public.role_scopes(role_id);
CREATE INDEX IF NOT EXISTS idx_role_scopes_resource ON public.role_scopes(resource);

-- 11. Wstawienie domyślnych ról (w języku polskim)
INSERT INTO public.roles (name, display_name, description, color, permissions) VALUES
    ('superadmin', 'Super Administrator', 'Pełny dostęp do wszystkich funkcji systemu', '#DC2626', ARRAY['*']),
    ('dyrektor', 'Dyrektor', 'Dostęp do wszystkich funkcji oprócz ustawień systemowych', '#059669', ARRAY['tasks.*', 'users.*', 'departments.*', 'reports.*', 'settings.basic']),
    ('kierownik', 'Kierownik', 'Dostęp do funkcji działowych i zarządzania zespołem', '#2563EB', ARRAY['tasks.department', 'users.department', 'departments.own', 'reports.department']),
    ('pracownik', 'Pracownik', 'Podstawowy dostęp do własnych zadań i informacji', '#7C3AED', ARRAY['tasks.own', 'users.own', 'departments.own'])
ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    color = EXCLUDED.color,
    permissions = EXCLUDED.permissions,
    updated_at = NOW();

-- 12. Wstawienie domyślnych scope'ów dla ról
INSERT INTO public.role_scopes (role_id, resource, scope) 
SELECT r.id, resource, scope
FROM public.roles r
CROSS JOIN (
    VALUES 
        ('tasks', 'global'),
        ('users', 'global'),
        ('departments', 'global'),
        ('reports', 'global'),
        ('settings', 'global')
) AS superadmin_scopes(resource, scope)
WHERE r.name = 'superadmin'

UNION ALL

SELECT r.id, resource, scope
FROM public.roles r
CROSS JOIN (
    VALUES 
        ('tasks', 'global'),
        ('users', 'global'),
        ('departments', 'global'),
        ('reports', 'global'),
        ('settings', 'none')
) AS dyrektor_scopes(resource, scope)
WHERE r.name = 'dyrektor'

UNION ALL

SELECT r.id, resource, scope
FROM public.roles r
CROSS JOIN (
    VALUES 
        ('tasks', 'department'),
        ('users', 'department'),
        ('departments', 'own'),
        ('reports', 'department'),
        ('settings', 'none')
) AS kierownik_scopes(resource, scope)
WHERE r.name = 'kierownik'

UNION ALL

SELECT r.id, resource, scope
FROM public.roles r
CROSS JOIN (
    VALUES 
        ('tasks', 'own'),
        ('users', 'own'),
        ('departments', 'own'),
        ('reports', 'none'),
        ('settings', 'none')
) AS pracownik_scopes(resource, scope)
WHERE r.name = 'pracownik'

ON CONFLICT (role_id, resource) DO UPDATE SET
    scope = EXCLUDED.scope,
    updated_at = NOW();

-- 13. Wstawienie domyślnych ustawień systemu
INSERT INTO public.system_settings (key, value, description) VALUES
    ('mosir_logo', '/mosir-logo.svg', 'Ścieżka do logo MOSiR (SVG, PNG, JPG)'),
    ('system_name', 'MOSiR Portal', 'Nazwa systemu wyświetlana w interfejsie'),
    ('company_name', 'MOSiR', 'Nazwa firmy/organizacji')
ON CONFLICT (key) DO UPDATE SET
    value = EXCLUDED.value,
    description = EXCLUDED.description,
    updated_at = NOW();

-- 14. Nadanie roli superadmina użytkownikowi dyrektor@e-mosir.pl (teraz powinno działać)
UPDATE public.users 
SET role = 'superadmin' 
WHERE email = 'dyrektor@e-mosir.pl';

-- 15. Sprawdzenie czy aktualizacja się powiodła
SELECT 
    email, 
    first_name, 
    last_name, 
    role, 
    department_id,
    CASE 
        WHEN role = 'superadmin' THEN '✅ Rola superadmina została nadana'
        ELSE '❌ Rola nie została zmieniona'
    END as status
FROM public.users 
WHERE email = 'dyrektor@e-mosir.pl';

-- 16. Wyświetlenie wszystkich ról
SELECT 
    name,
    display_name,
    description,
    color,
    permissions,
    created_at
FROM public.roles 
ORDER BY name;

-- 17. Wyświetlenie wszystkich scope'ów ról
SELECT 
    r.name as role_name,
    rs.resource,
    rs.scope,
    rs.created_at
FROM public.role_scopes rs
JOIN public.roles r ON rs.role_id = r.id
ORDER BY r.name, rs.resource;

-- 18. Wyświetlenie wszystkich użytkowników z rolami
SELECT 
    email, 
    first_name, 
    last_name, 
    role, 
    department_id,
    active
FROM public.users 
ORDER BY role, last_name, first_name;

-- 19. Wyświetlenie ustawień systemu
SELECT * FROM public.system_settings ORDER BY key;

-- Aktualizacja widoku users_with_details żeby zawierał department_id
DROP VIEW IF EXISTS public.users_with_details;
CREATE VIEW public.users_with_details AS
SELECT 
    u.id,
    u.first_name,
    u.last_name,
    u.email,
    u.phone,
    u.whatsapp,
    u.position,
    u.role,
    u.active,
    u.department_id,
    d.name as department_name,
    CONCAT(u.first_name, ' ', u.last_name) as full_name,
    CONCAT(m.first_name, ' ', m.last_name) as manager_name
FROM public.users u
LEFT JOIN public.departments d ON u.department_id = d.id
LEFT JOIN public.users m ON u.manager_id = m.id;







