-- Skrypt dodający przykładowe zadania dla MOSiR Portal
-- Wykonaj w Supabase SQL Editor

-- 1. Sprawdzenie istniejących działów
SELECT id, name FROM departments ORDER BY id;

-- 2. Sprawdzenie istniejących użytkowników (do przypisania zadań)
SELECT id, email, first_name, last_name, role, department_id FROM users ORDER BY role, last_name;

-- 3. Dodanie przykładowych zadań dla różnych działów MOSiR

-- Zadanie 1: Administracja - Wysoki priorytet, W trakcie
INSERT INTO tasks (
    title,
    description,
    status,
    priority,
    department_id,
    assigned_to,
    created_by,
    due_date,
    estimated_hours,
    notes,
    created_at,
    updated_at
) VALUES (
    'Przygotowanie budżetu rocznego 2025',
    'Sporządzenie szczegółowego budżetu operacyjnego na rok 2025 dla wszystkich działów MOSiR, uwzględniając planowane inwestycje i remonty obiektów sportowych.',
    'in_progress',
    'high',
    1, -- Administracja
    (SELECT id FROM users WHERE role = 'dyrektor' LIMIT 1),
    (SELECT id FROM users WHERE role = 'superadmin' LIMIT 1),
    '2024-12-31',
    40,
    'Wymaga konsultacji z kierownikami działów i analizy kosztów z poprzednich lat.',
    NOW(),
    NOW()
);

-- Zadanie 2: Administracja - Średni priorytet, Nowe
INSERT INTO tasks (
    title,
    description,
    status,
    priority,
    department_id,
    assigned_to,
    created_by,
    due_date,
    estimated_hours,
    notes,
    created_at,
    updated_at
) VALUES (
    'Aktualizacja regulaminów wewnętrznych',
    'Przegląd i aktualizacja wszystkich regulaminów wewnętrznych MOSiR zgodnie z nowymi przepisami prawa pracy i BHP.',
    'new',
    'medium',
    1, -- Administracja
    (SELECT id FROM users WHERE role = 'kierownik' AND department_id = 1 LIMIT 1),
    (SELECT id FROM users WHERE role = 'dyrektor' LIMIT 1),
    '2025-01-15',
    16,
    'Współpraca z prawnikiem zewnętrznym wymagana.',
    NOW(),
    NOW()
);

-- Zadanie 3: Techniczny - Wysoki priorytet, Nowe
INSERT INTO tasks (
    title,
    description,
    status,
    priority,
    department_id,
    assigned_to,
    created_by,
    due_date,
    estimated_hours,
    notes,
    created_at,
    updated_at
) VALUES (
    'Naprawa systemu ogrzewania basenu',
    'Ustalenie przyczyny awarii systemu ogrzewania w basenie głównym i wykonanie niezbędnych napraw. Temperatura wody spadła do 22°C.',
    'new',
    'high',
    2, -- Techniczny
    (SELECT id FROM users WHERE role = 'kierownik' AND department_id = 2 LIMIT 1),
    (SELECT id FROM users WHERE role = 'dyrektor' LIMIT 1),
    '2024-12-20',
    24,
    'Pilne - basen nieczynny dla klientów. Wymaga specjalistycznego sprzętu.',
    NOW(),
    NOW()
);

-- Zadanie 4: Techniczny - Średni priorytet, Zakończone
INSERT INTO tasks (
    title,
    description,
    status,
    priority,
    department_id,
    assigned_to,
    created_by,
    due_date,
    estimated_hours,
    notes,
    created_at,
    updated_at
) VALUES (
    'Konserwacja urządzeń siłowni',
    'Przegląd techniczny wszystkich urządzeń siłowni, smarowanie, regulacja i drobne naprawy.',
    'completed',
    'medium',
    2, -- Techniczny
    (SELECT id FROM users WHERE role = 'pracownik' AND department_id = 2 LIMIT 1),
    (SELECT id FROM users WHERE role = 'kierownik' AND department_id = 2 LIMIT 1),
    '2024-12-10',
    12,
    'Wszystkie urządzenia sprawne, wykonano konserwację zgodnie z harmonogramem.',
    NOW() - INTERVAL '5 days',
    NOW() - INTERVAL '5 days'
);

-- Zadanie 5: Sport - Wysoki priorytet, W trakcie
INSERT INTO tasks (
    title,
    description,
    status,
    priority,
    department_id,
    assigned_to,
    created_by,
    due_date,
    estimated_hours,
    notes,
    created_at,
    updated_at
) VALUES (
    'Organizacja turnieju piłki nożnej',
    'Przygotowanie i przeprowadzenie turnieju piłki nożnej dla młodzieży w wieku 14-16 lat. Koordynacja z klubami, sędziowie, nagrody.',
    'in_progress',
    'high',
    3, -- Sport
    (SELECT id FROM users WHERE role = 'kierownik' AND department_id = 3 LIMIT 1),
    (SELECT id FROM users WHERE role = 'dyrektor' LIMIT 1),
    '2025-01-20',
    32,
    'Zgłoszono 16 drużyn. Potrzebne dodatkowe boisko treningowe.',
    NOW(),
    NOW()
);

-- Zadanie 6: Sport - Średni priorytet, Nowe
INSERT INTO tasks (
    title,
    description,
    status,
    priority,
    department_id,
    assigned_to,
    created_by,
    due_date,
    estimated_hours,
    notes,
    created_at,
    updated_at
) VALUES (
    'Aktualizacja oferty zajęć fitness',
    'Przygotowanie nowej oferty zajęć fitness na sezon zimowy 2025, uwzględniając trendy i oczekiwania klientów.',
    'new',
    'medium',
    3, -- Sport
    (SELECT id FROM users WHERE role = 'pracownik' AND department_id = 3 LIMIT 1),
    (SELECT id FROM users WHERE role = 'kierownik' AND department_id = 3 LIMIT 1),
    '2025-01-10',
    8,
    'Współpraca z instruktorami fitness i analiza frekwencji z poprzednich sezonów.',
    NOW(),
    NOW()
);

-- Zadanie 7: Obsługa klienta - Niski priorytet, Nowe
INSERT INTO tasks (
    title,
    description,
    status,
    priority,
    department_id,
    assigned_to,
    created_by,
    due_date,
    estimated_hours,
    notes,
    created_at,
    updated_at
) VALUES (
    'Przygotowanie materiałów promocyjnych',
    'Opracowanie nowych ulotek, plakatów i materiałów promocyjnych dla MOSiR z aktualną ofertą i cenami.',
    'new',
    'low',
    4, -- Obsługa klienta
    (SELECT id FROM users WHERE role = 'pracownik' AND department_id = 4 LIMIT 1),
    (SELECT id FROM users WHERE role = 'kierownik' AND department_id = 4 LIMIT 1),
    '2025-01-25',
    20,
    'Wymaga współpracy z grafikiem i drukarnią. Materiały w języku polskim i ukraińskim.',
    NOW(),
    NOW()
);

-- Zadanie 8: Obsługa klienta - Średni priorytet, Zakończone
INSERT INTO tasks (
    title,
    description,
    status,
    priority,
    department_id,
    assigned_to,
    created_by,
    due_date,
    estimated_hours,
    notes,
    created_at,
    updated_at
) VALUES (
    'Szkolenie personelu z obsługi klienta',
    'Przeprowadzenie szkolenia dla nowych pracowników działu obsługi klienta z zakresu komunikacji, rozwiązywania problemów i procedur.',
    'completed',
    'medium',
    4, -- Obsługa klienta
    (SELECT id FROM users WHERE role = 'kierownik' AND department_id = 4 LIMIT 1),
    (SELECT id FROM users WHERE role = 'dyrektor' LIMIT 1),
    '2024-12-05',
    6,
    'Szkolenie zakończone pomyślnie. Wszyscy uczestnicy otrzymali certyfikaty.',
    NOW() - INTERVAL '10 days',
    NOW() - INTERVAL '10 days'
);

-- Zadanie 9: Finanse - Wysoki priorytet, Nowe
INSERT INTO tasks (
    title,
    description,
    status,
    priority,
    department_id,
    assigned_to,
    created_by,
    due_date,
    estimated_hours,
    notes,
    created_at,
    updated_at
) VALUES (
    'Audyt finansowy za rok 2024',
    'Przygotowanie do audytu finansowego za rok 2024. Sprawdzenie dokumentacji, przygotowanie sprawozdań i koordynacja z audytorem zewnętrznym.',
    'new',
    'high',
    5, -- Finanse
    (SELECT id FROM users WHERE role = 'kierownik' AND department_id = 5 LIMIT 1),
    (SELECT id FROM users WHERE role = 'dyrektor' LIMIT 1),
    '2025-02-15',
    48,
    'Krytyczne zadanie - wymaga pełnej dokumentacji finansowej i współpracy z księgowością.',
    NOW(),
    NOW()
);

-- Zadanie 10: Finanse - Niski priorytet, W trakcie
INSERT INTO tasks (
    title,
    description,
    status,
    priority,
    department_id,
    assigned_to,
    created_by,
    due_date,
    estimated_hours,
    notes,
    created_at,
    updated_at
) VALUES (
    'Optymalizacja procesów płatności',
    'Analiza i optymalizacja procesów płatności online, integracja z nowymi systemami płatności i poprawa UX dla klientów.',
    'in_progress',
    'low',
    5, -- Finanse
    (SELECT id FROM users WHERE role = 'pracownik' AND department_id = 5 LIMIT 1),
    (SELECT id FROM users WHERE role = 'kierownik' AND department_id = 5 LIMIT 1),
    '2025-02-28',
    24,
    'Współpraca z działem IT wymagana. Testy nowych rozwiązań w toku.',
    NOW(),
    NOW()
);

-- 4. Sprawdzenie dodanych zadań
SELECT 
    t.id,
    t.title,
    t.status,
    t.priority,
    d.name as department_name,
    CONCAT(u.first_name, ' ', u.last_name) as assigned_to_name,
    t.due_date,
    t.estimated_hours,
    t.created_at
FROM tasks t
LEFT JOIN departments d ON t.department_id = d.id
LEFT JOIN users u ON t.assigned_to = u.id
ORDER BY t.created_at DESC
LIMIT 10;

-- 5. Statystyki zadań według statusu
SELECT 
    status,
    COUNT(*) as count
FROM tasks 
GROUP BY status 
ORDER BY count DESC;

-- 6. Statystyki zadań według priorytetu
SELECT 
    priority,
    COUNT(*) as count
FROM tasks 
GROUP BY priority 
ORDER BY count DESC;

-- 7. Statystyki zadań według działu
SELECT 
    d.name as department_name,
    COUNT(*) as task_count
FROM tasks t
LEFT JOIN departments d ON t.department_id = d.id
GROUP BY d.id, d.name
ORDER BY task_count DESC;
