# Integracja Roger RACS-5 z MOSiR Portal

## Spis treści
1. [Przegląd](#1-przegląd)
2. [Architektura systemu Roger RACS-5](#2-architektura-systemu-roger-racs-5)
3. [Analiza metod integracji](#3-analiza-metod-integracji)
4. [Rekomendowana architektura](#4-rekomendowana-architektura)
5. [Model danych (Supabase)](#5-model-danych-supabase)
6. [Konfiguracja n8n - middleware](#6-konfiguracja-n8n---middleware)
7. [API Routes (Next.js)](#7-api-routes-nextjs)
8. [Frontend - nowe strony](#8-frontend---nowe-strony)
9. [Bezpieczeństwo i sieć](#9-bezpieczeństwo-i-sieć)
10. [Plan wdrożenia krok po kroku](#10-plan-wdrożenia-krok-po-kroku)
11. [Wymagania sieciowe / infrastrukturalne](#11-wymagania-sieciowe--infrastrukturalne)
12. [FAQ / Troubleshooting](#12-faq--troubleshooting)

---

## 1. Przegląd

### Cel integracji
- **Obecności (RCP)**: Automatyczne pobieranie zdarzeń wejścia/wyjścia z systemu Roger RACS-5 i wyświetlanie ich w MOSiR Portal.
- **Grafiki pracy**: Tworzenie i zarządzanie grafikami pracy w portalu, z możliwością porównania z rzeczywistą obecnością z systemu Roger.
- **Dashboard obecności**: Podgląd w czasie rzeczywistym kto jest w pracy, kto się spóźnił, kto jest na urlopie.

### Obecny stos technologiczny MOSiR Portal
| Warstwa | Technologia |
|---------|------------|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS |
| Backend | Next.js API Routes, Supabase (PostgreSQL, Auth, Realtime) |
| Automatyzacja | n8n (workflow engine, już w deploy) |
| Deploy | Docker, K3s, Traefik, Cloudflare Tunnel |

### System Roger RACS-5 - komponenty kluczowe
| Komponent | Opis |
|-----------|------|
| **VISO EX/ST** | Aplikacja desktopowa do zarządzania systemem |
| **VISO Web** | Aplikacja webowa do monitoringu i audytu zdarzeń |
| **RogerSVC** | Pakiet usług Windows (Communication Server, Integration Server, License Server) |
| **Integration Server** | Serwer integracji - WCF/SOAP web service dla systemów zewnętrznych |
| **MS SQL Server** | Baza danych systemowa ze zdarzeniami, osobami, strefami |
| **RCP Master 4** | Dedykowane oprogramowanie do rejestracji czasu pracy |
| **MC16-PAC** | Kontrolery fizyczne obsługujące czytniki |
| **SDK** | Interfejs programistyczny do integracji |

---

## 2. Architektura systemu Roger RACS-5

### Schemat komponentów RACS-5
```
┌─────────────────────────────────────────────────────────┐
│                    RACS-5 System                         │
│                                                         │
│  ┌──────────┐   ┌──────────┐   ┌──────────────────┐   │
│  │ MC16-PAC │   │ MCT82M   │   │ RFT1000          │   │
│  │Controller├──►│ Reader   │   │ Fingerprint Reader│   │
│  └────┬─────┘   └──────────┘   └──────────────────┘   │
│       │                                                 │
│       ▼                                                 │
│  ┌──────────────────────────────────────────────────┐  │
│  │ RogerSVC (Windows Services)                       │  │
│  │  ├─ Communication Server (port 8891)              │  │
│  │  ├─ Integration Server (port 8892)  ◄── SOAP API  │  │
│  │  ├─ License Server                                │  │
│  │  └─ VISO Web Server (port 8080)                   │  │
│  └──────────────────────┬───────────────────────────┘  │
│                         │                               │
│                         ▼                               │
│  ┌──────────────────────────────────────────────────┐  │
│  │ MS SQL Server                                     │  │
│  │  ├─ dbo.Persons (osoby/pracownicy)                │  │
│  │  ├─ dbo.Events (zdarzenia dostępowe)              │  │
│  │  ├─ dbo.AccessZones (strefy dostępowe)            │  │
│  │  ├─ dbo.AccessPoints (punkty dostępowe/drzwi)     │  │
│  │  └─ dbo.TimeAttendance (RCP)                      │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Kluczowe tabele w bazie MS SQL (RACS-5)

**dbo.Persons** - Osoby w systemie
| Kolumna | Typ | Opis |
|---------|-----|------|
| PersonID | int | Unikalny ID osoby |
| FirstName | nvarchar | Imię |
| LastName | nvarchar | Nazwisko |
| Department | nvarchar | Dział |
| CardNumber | nvarchar | Numer karty |
| Active | bit | Czy aktywna |

**dbo.Events** - Zdarzenia dostępowe
| Kolumna | Typ | Opis |
|---------|-----|------|
| EventID | bigint | ID zdarzenia |
| EventTime | datetime | Czas zdarzenia |
| PersonID | int | ID osoby |
| AccessPointID | int | ID punktu dostępowego |
| EventType | int | Typ zdarzenia (wejście/wyjście/odmowa) |
| EventDescription | nvarchar | Opis zdarzenia |

> **UWAGA**: Nazwy tabel i kolumn mogą się różnić w zależności od wersji RACS-5.
> Dokładną strukturę sprawdź w instrukcji integracji (RACS-5 - Instrukcja integracji EN.pdf)
> lub bezpośrednio w bazie MS SQL za pomocą SQL Server Management Studio.

---

## 3. Analiza metod integracji

### Opcja A: Direct Database (MS SQL → Supabase via n8n)
| Aspekt | Ocena |
|--------|-------|
| **Złożoność** | Średnia |
| **Czas wdrożenia** | 2-3 dni |
| **Niezawodność** | Wysoka |
| **Real-time** | Co 1-5 min (polling) |
| **Wymagania sieciowe** | Dostęp z serwera n8n do MS SQL (port 1433) |

**Opis**: n8n łączy się bezpośrednio z bazą MS SQL systemu Roger i co X minut synchronizuje nowe zdarzenia do Supabase.

### Opcja B: Integration Server (SOAP/WCF API)
| Aspekt | Ocena |
|--------|-------|
| **Złożoność** | Wysoka |
| **Czas wdrożenia** | 5-7 dni |
| **Niezawodność** | Wysoka |
| **Real-time** | Możliwy callback/webhook |
| **Wymagania sieciowe** | Dostęp do Integration Server (port 8892) |

**Opis**: Komunikacja przez SOAP web services wystawiane przez Integration Server. Bardziej "oficjalne" API ale SOAP jest trudniejszy w implementacji z Node.js.

### Opcja C: RCP Master 4 Export
| Aspekt | Ocena |
|--------|-------|
| **Złożoność** | Niska |
| **Czas wdrożenia** | 1 dzień |
| **Niezawodność** | Średnia (wymaga ręcznego/scheduled export) |
| **Real-time** | Brak (batch) |
| **Wymagania sieciowe** | Dostęp do pliku/folderu eksportu |

**Opis**: RCP Master 4 eksportuje dane do CSV/pliku, n8n importuje do Supabase. Najprostsze ale najmniej elastyczne.

### Opcja D: Hybrid (n8n DB polling + WebSocket push)
| Aspekt | Ocena |
|--------|-------|
| **Złożoność** | Średnia-Wysoka |
| **Czas wdrożenia** | 3-4 dni |
| **Niezawodność** | Bardzo wysoka |
| **Real-time** | Tak (Supabase Realtime) |
| **Wymagania sieciowe** | MS SQL + Supabase |

**Opis**: Połączenie Opcji A z Supabase Realtime. n8n pobiera zdarzenia z MS SQL, zapisuje do Supabase, a frontend subskrybuje zmiany w czasie rzeczywistym.

### ✅ REKOMENDACJA: Opcja D (Hybrid)

Uzasadnienie:
- **n8n jest już w infrastrukturze** (docker-compose.n8n.yml)
- **Supabase Realtime jest już używany** w portalu (kanały, notyfikacje)
- **Minimalna zmiana infrastruktury** - wystarczy dodać sterownik MS SQL do n8n
- **Elastyczność** - n8n pozwala na transformację danych, mapowanie osób, obsługę błędów
- **Skalowalność** - łatwo dodać nowe typy zdarzeń, raporty, alerty

---

## 4. Rekomendowana architektura

### Schemat przepływu danych
```
┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│  Roger RACS-5    │       │  n8n Middleware   │       │  MOSiR Portal    │
│  (MS SQL Server) │──────►│  (Workflow Engine)│──────►│  (Supabase +     │
│                  │ Poll   │                  │ Insert│   Next.js)       │
│  • Events        │ every  │  • Map PersonID  │  via  │                  │
│  • Persons       │ 2 min  │    → user_id     │ REST  │  • attendance_   │
│  • AccessPoints  │       │  • Filter events │  API  │    events        │
│                  │       │  • Transform     │       │  • work_schedules│
└──────────────────┘       │  • Error handling│       │  • schedule_     │
                           └──────────────────┘       │    entries       │
                                                      └────────┬─────────┘
                                                               │
                                                      Supabase Realtime
                                                               │
                                                      ┌────────▼─────────┐
                                                      │  Dashboard UI    │
                                                      │  • Obecności     │
                                                      │  • Grafiki pracy │
                                                      │  • Raporty RCP   │
                                                      └──────────────────┘
```

### Komponenty do zbudowania

| # | Komponent | Lokalizacja | Opis |
|---|-----------|-------------|------|
| 1 | Tabele Supabase | SQL/migration-attendance.sql | Nowe tabele w bazie |
| 2 | Typy TypeScript | types/database.ts | Typy dla nowych tabel |
| 3 | n8n Workflow - sync osób | n8n | Mapowanie RACS → Portal users |
| 4 | n8n Workflow - sync zdarzeń | n8n | Polling zdarzeń co 2 min |
| 5 | API Route - attendance | app/api/attendance/ | Endpointy obecności |
| 6 | API Route - schedules | app/api/schedules/ | Endpointy grafików |
| 7 | Strona - Obecności | app/dashboard/attendance/ | Dashboard obecności |
| 8 | Strona - Grafiki | app/dashboard/schedules/ | Zarządzanie grafikami |
| 9 | Sidebar update | components/layouts/Sidebar.tsx | Nowe pozycje w menu |
| 10 | Docker config | deploy/ | MS SQL driver dla n8n |

---

## 5. Model danych (Supabase)

### Migracja SQL

```sql
-- ============================================================
-- Plik: SQL/migration-attendance.sql
-- Opis: Migracja dla integracji obecności Roger RACS-5
-- ============================================================

-- 1. Tabela mapowania osób Roger → użytkownicy portalu
CREATE TABLE IF NOT EXISTS roger_person_mapping (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  roger_person_id INTEGER NOT NULL UNIQUE,
  roger_card_number VARCHAR(50),
  roger_first_name VARCHAR(100),
  roger_last_name VARCHAR(100),
  mapped_at TIMESTAMPTZ DEFAULT NOW(),
  mapped_by UUID REFERENCES auth.users(id),
  active BOOLEAN DEFAULT TRUE,
  UNIQUE(user_id)  -- 1 user = 1 roger person
);

-- 2. Punkty dostępowe (zsynchronizowane z Roger)
CREATE TABLE IF NOT EXISTS access_points (
  id SERIAL PRIMARY KEY,
  roger_access_point_id INTEGER NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  location VARCHAR(200),
  point_type VARCHAR(50) DEFAULT 'door', -- door, gate, turnstile
  is_entry BOOLEAN DEFAULT TRUE,  -- true=wejście, false=wyjście
  active BOOLEAN DEFAULT TRUE,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Zdarzenia obecności (główna tabela - sync z Roger Events)
CREATE TABLE IF NOT EXISTS attendance_events (
  id BIGSERIAL PRIMARY KEY,
  roger_event_id BIGINT UNIQUE,  -- ID z bazy Roger (deduplikacja)
  user_id UUID REFERENCES auth.users(id),
  roger_person_id INTEGER,
  access_point_id INTEGER REFERENCES access_points(id),
  event_time TIMESTAMPTZ NOT NULL,
  event_type VARCHAR(30) NOT NULL,  -- 'entry', 'exit', 'denied', 'unknown'
  event_description TEXT,
  raw_event_data JSONB,  -- oryginalne dane z Roger dla debuggingu
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indeksy dla wydajności
CREATE INDEX idx_attendance_events_user_time 
  ON attendance_events(user_id, event_time DESC);
CREATE INDEX idx_attendance_events_time 
  ON attendance_events(event_time DESC);
CREATE INDEX idx_attendance_events_roger_id 
  ON attendance_events(roger_event_id);
CREATE INDEX idx_attendance_events_type 
  ON attendance_events(event_type);

-- 4. Dzienny podsumowanie obecności (generowane przez n8n lub trigger)
CREATE TABLE IF NOT EXISTS attendance_daily_summary (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  date DATE NOT NULL,
  first_entry TIMESTAMPTZ,       -- pierwsze wejście
  last_exit TIMESTAMPTZ,         -- ostatnie wyjście
  total_hours NUMERIC(5,2),      -- suma godzin pracy
  break_hours NUMERIC(5,2),      -- suma przerw
  status VARCHAR(30) DEFAULT 'present', -- present, absent, late, early_leave, holiday, sick
  is_late BOOLEAN DEFAULT FALSE,
  late_minutes INTEGER DEFAULT 0,
  early_leave BOOLEAN DEFAULT FALSE,
  early_leave_minutes INTEGER DEFAULT 0,
  notes TEXT,
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

CREATE INDEX idx_daily_summary_user_date 
  ON attendance_daily_summary(user_id, date DESC);
CREATE INDEX idx_daily_summary_date 
  ON attendance_daily_summary(date DESC);
CREATE INDEX idx_daily_summary_status 
  ON attendance_daily_summary(status);

-- 5. Grafiki pracy (szablony)
CREATE TABLE IF NOT EXISTS work_schedules (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,           -- np. "Grafik Hala Sportowa - Luty 2026"
  department_id INTEGER REFERENCES departments(id),
  start_date DATE NOT NULL,             -- początek obowiązywania
  end_date DATE NOT NULL,               -- koniec obowiązywania
  created_by UUID REFERENCES auth.users(id),
  status VARCHAR(30) DEFAULT 'draft',   -- draft, active, archived
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_work_schedules_dept 
  ON work_schedules(department_id);
CREATE INDEX idx_work_schedules_dates 
  ON work_schedules(start_date, end_date);

-- 6. Wpisy grafiku (konkretne zmiany dla pracowników)
CREATE TABLE IF NOT EXISTS schedule_entries (
  id BIGSERIAL PRIMARY KEY,
  schedule_id INTEGER NOT NULL REFERENCES work_schedules(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  date DATE NOT NULL,
  shift_start TIME NOT NULL,            -- godzina rozpoczęcia
  shift_end TIME NOT NULL,              -- godzina zakończenia
  break_minutes INTEGER DEFAULT 30,     -- przerwa w minutach
  shift_type VARCHAR(30) DEFAULT 'regular', -- regular, overtime, on_call, holiday
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(schedule_id, user_id, date)    -- 1 wpis na osobę na dzień w grafiku
);

CREATE INDEX idx_schedule_entries_user_date 
  ON schedule_entries(user_id, date);
CREATE INDEX idx_schedule_entries_schedule 
  ON schedule_entries(schedule_id);

-- 7. Typy nieobecności
CREATE TABLE IF NOT EXISTS absence_types (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,          -- np. "Urlop wypoczynkowy", "L4", "Delegacja"
  code VARCHAR(10) NOT NULL UNIQUE,    -- np. "UW", "L4", "DEL"
  color VARCHAR(7) DEFAULT '#94a3b8',  -- kolor do wyświetlania
  paid BOOLEAN DEFAULT TRUE,
  active BOOLEAN DEFAULT TRUE
);

-- Domyślne typy nieobecności
INSERT INTO absence_types (name, code, color, paid) VALUES
  ('Urlop wypoczynkowy', 'UW', '#22c55e', true),
  ('Urlop na żądanie', 'UZ', '#eab308', true),
  ('Zwolnienie lekarskie (L4)', 'L4', '#ef4444', true),
  ('Delegacja', 'DEL', '#3b82f6', true),
  ('Urlop bezpłatny', 'UB', '#6b7280', false),
  ('Opieka nad dzieckiem', 'OD', '#a855f7', true),
  ('Szkolenie', 'SZK', '#06b6d4', true),
  ('Praca zdalna', 'PZ', '#10b981', true),
  ('Wolne za nadgodziny', 'WN', '#f59e0b', true)
ON CONFLICT (code) DO NOTHING;

-- 8. Rejestr nieobecności
CREATE TABLE IF NOT EXISTS absences (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  absence_type_id INTEGER NOT NULL REFERENCES absence_types(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(30) DEFAULT 'pending',  -- pending, approved, rejected
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_absences_user_date 
  ON absences(user_id, start_date, end_date);

-- 9. Log synchronizacji (monitoring integracji)
CREATE TABLE IF NOT EXISTS roger_sync_log (
  id BIGSERIAL PRIMARY KEY,
  sync_type VARCHAR(50) NOT NULL,        -- 'events', 'persons', 'access_points'
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  records_fetched INTEGER DEFAULT 0,
  records_inserted INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_errors INTEGER DEFAULT 0,
  last_roger_event_id BIGINT,           -- ostatni zsynchronizowany event ID
  error_message TEXT,
  status VARCHAR(30) DEFAULT 'running'  -- running, completed, failed
);

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================

ALTER TABLE attendance_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_daily_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE absences ENABLE ROW LEVEL SECURITY;

-- Pracownik widzi tylko swoje dane
CREATE POLICY "Users view own attendance" ON attendance_events
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role IN ('superadmin', 'dyrektor')
    )
    OR EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role = 'kierownik'
      AND EXISTS (
        SELECT 1 FROM user_departments ud1 
        JOIN user_departments ud2 ON ud1.department_id = ud2.department_id
        WHERE ud1.user_id = auth.uid() 
        AND ud2.user_id = attendance_events.user_id
      )
    )
  );

CREATE POLICY "Users view own daily summary" ON attendance_daily_summary
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role IN ('superadmin', 'dyrektor')
    )
    OR EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role = 'kierownik'
      AND EXISTS (
        SELECT 1 FROM user_departments ud1 
        JOIN user_departments ud2 ON ud1.department_id = ud2.department_id
        WHERE ud1.user_id = auth.uid() 
        AND ud2.user_id = attendance_daily_summary.user_id
      )
    )
  );

-- Grafiki - kierownik+ może tworzyć/edytować dla swoich działów
CREATE POLICY "Managers manage schedules" ON work_schedules
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role IN ('superadmin', 'dyrektor')
    )
    OR (
      EXISTS (
        SELECT 1 FROM users u 
        WHERE u.id = auth.uid() 
        AND u.role = 'kierownik'
      )
      AND EXISTS (
        SELECT 1 FROM user_departments ud 
        WHERE ud.user_id = auth.uid() 
        AND ud.department_id = work_schedules.department_id
      )
    )
  );

-- Pracownik widzi grafiki swojego działu
CREATE POLICY "Users view department schedules" ON work_schedules
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_departments ud 
      WHERE ud.user_id = auth.uid() 
      AND ud.department_id = work_schedules.department_id
    )
  );

CREATE POLICY "Users view own schedule entries" ON schedule_entries
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role IN ('superadmin', 'dyrektor', 'kierownik')
    )
  );

CREATE POLICY "Managers manage schedule entries" ON schedule_entries
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role IN ('superadmin', 'dyrektor', 'kierownik')
    )
  );

-- Nieobecności
CREATE POLICY "Users manage own absences" ON absences
  FOR ALL USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role IN ('superadmin', 'dyrektor', 'kierownik')
    )
  );

-- ============================================================
-- Views (widoki pomocnicze)
-- ============================================================

-- Widok: Obecności z detalami użytkownika
CREATE OR REPLACE VIEW attendance_with_details AS
SELECT 
  ae.id,
  ae.event_time,
  ae.event_type,
  ae.event_description,
  ae.user_id,
  u.first_name,
  u.last_name,
  u.email,
  u.department_id,
  d.name as department_name,
  ap.name as access_point_name,
  ap.location as access_point_location,
  ap.is_entry
FROM attendance_events ae
LEFT JOIN users u ON ae.user_id = u.id
LEFT JOIN departments d ON u.department_id = d.id
LEFT JOIN access_points ap ON ae.access_point_id = ap.id
ORDER BY ae.event_time DESC;

-- Widok: Dzisiejszy status obecności
CREATE OR REPLACE VIEW today_attendance_status AS
SELECT 
  u.id as user_id,
  u.first_name,
  u.last_name,
  u.email,
  u.department_id,
  d.name as department_name,
  u.role,
  ads.first_entry,
  ads.last_exit,
  ads.total_hours,
  ads.status,
  ads.is_late,
  ads.late_minutes,
  se.shift_start as scheduled_start,
  se.shift_end as scheduled_end,
  CASE 
    WHEN ads.first_entry IS NOT NULL THEN 'present'
    WHEN ab.id IS NOT NULL THEN ab_type.code
    ELSE 'absent'
  END as current_status
FROM users u
LEFT JOIN departments d ON u.department_id = d.id
LEFT JOIN attendance_daily_summary ads 
  ON u.id = ads.user_id AND ads.date = CURRENT_DATE
LEFT JOIN schedule_entries se 
  ON u.id = se.user_id AND se.date = CURRENT_DATE
LEFT JOIN absences ab 
  ON u.id = ab.user_id 
  AND CURRENT_DATE BETWEEN ab.start_date AND ab.end_date
  AND ab.status = 'approved'
LEFT JOIN absence_types ab_type ON ab.absence_type_id = ab_type.id
WHERE u.active = true
ORDER BY d.name, u.last_name;

-- ============================================================
-- Funkcje pomocnicze
-- ============================================================

-- Funkcja: Oblicz podsumowanie dzienne dla użytkownika
CREATE OR REPLACE FUNCTION compute_daily_attendance(
  p_user_id UUID,
  p_date DATE
) RETURNS VOID AS $$
DECLARE
  v_first_entry TIMESTAMPTZ;
  v_last_exit TIMESTAMPTZ;
  v_total_hours NUMERIC(5,2);
  v_scheduled_start TIME;
  v_is_late BOOLEAN;
  v_late_minutes INTEGER;
BEGIN
  -- Znajdź pierwsze wejście i ostatnie wyjście
  SELECT MIN(event_time) INTO v_first_entry
  FROM attendance_events
  WHERE user_id = p_user_id 
    AND event_time::DATE = p_date
    AND event_type = 'entry';

  SELECT MAX(event_time) INTO v_last_exit
  FROM attendance_events
  WHERE user_id = p_user_id 
    AND event_time::DATE = p_date
    AND event_type = 'exit';

  -- Oblicz godziny (uproszczone - wejście do wyjścia)
  IF v_first_entry IS NOT NULL AND v_last_exit IS NOT NULL THEN
    v_total_hours := EXTRACT(EPOCH FROM (v_last_exit - v_first_entry)) / 3600.0;
  ELSE
    v_total_hours := 0;
  END IF;

  -- Sprawdź spóźnienie względem grafiku
  SELECT shift_start INTO v_scheduled_start
  FROM schedule_entries
  WHERE user_id = p_user_id AND date = p_date
  LIMIT 1;

  v_is_late := FALSE;
  v_late_minutes := 0;
  
  IF v_scheduled_start IS NOT NULL AND v_first_entry IS NOT NULL THEN
    IF v_first_entry::TIME > v_scheduled_start THEN
      v_is_late := TRUE;
      v_late_minutes := EXTRACT(EPOCH FROM (v_first_entry::TIME - v_scheduled_start)) / 60;
    END IF;
  END IF;

  -- Upsert podsumowania
  INSERT INTO attendance_daily_summary 
    (user_id, date, first_entry, last_exit, total_hours, is_late, late_minutes, status)
  VALUES 
    (p_user_id, p_date, v_first_entry, v_last_exit, v_total_hours, v_is_late, v_late_minutes,
     CASE 
       WHEN v_first_entry IS NULL THEN 'absent'
       WHEN v_is_late THEN 'late'
       ELSE 'present'
     END)
  ON CONFLICT (user_id, date) DO UPDATE SET
    first_entry = EXCLUDED.first_entry,
    last_exit = EXCLUDED.last_exit,
    total_hours = EXCLUDED.total_hours,
    is_late = EXCLUDED.is_late,
    late_minutes = EXCLUDED.late_minutes,
    status = EXCLUDED.status,
    computed_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 6. Konfiguracja n8n - middleware

### Workflow 1: Synchronizacja osób (jednorazowo + co 24h)

**Cel**: Pobranie osób z Roger MS SQL i zmapowanie do użytkowników portalu.

```
Trigger (Schedule: co 24h o 02:00)
    │
    ▼
MS SQL Node: SELECT PersonID, FirstName, LastName, Department, CardNumber, Active 
             FROM dbo.Persons WHERE Active = 1
    │
    ▼
Function Node: Mapowanie imię+nazwisko → user_id z Supabase
    │
    ▼
Supabase Node: UPSERT do roger_person_mapping
    │
    ▼
Supabase Node: INSERT do roger_sync_log
```

**Konfiguracja MS SQL Node w n8n:**
```json
{
  "host": "{{ $env.ROGER_MSSQL_HOST }}",
  "port": 1433,
  "database": "{{ $env.ROGER_MSSQL_DATABASE }}",
  "user": "{{ $env.ROGER_MSSQL_USER }}",
  "password": "{{ $env.ROGER_MSSQL_PASSWORD }}",
  "tls": true,
  "trustServerCertificate": true
}
```

### Workflow 2: Synchronizacja zdarzeń (co 2 minuty)

**Cel**: Pobieranie nowych zdarzeń dostępowych z Roger i zapis do Supabase.

```
Trigger (Schedule: co 2 min)
    │
    ▼
Supabase Node: SELECT last_roger_event_id FROM roger_sync_log 
               WHERE sync_type='events' ORDER BY completed_at DESC LIMIT 1
    │
    ▼
MS SQL Node: SELECT * FROM dbo.Events 
             WHERE EventID > {{ lastEventId }}
             ORDER BY EventID ASC
             LIMIT 500
    │
    ▼
Function Node: Transform & Map
  - Map PersonID → user_id (via roger_person_mapping)
  - Map EventType → 'entry'/'exit'/'denied'
  - Map AccessPointID → access_point_id
    │
    ▼
Supabase Node: Batch INSERT do attendance_events
    │
    ▼
Function Node: Dla każdego unique user_id+date
    │
    ▼
Supabase RPC: compute_daily_attendance(user_id, date)
    │
    ▼
Supabase Node: INSERT do roger_sync_log
```

### Workflow 3: Alert - brak synchronizacji (monitoring)

```
Trigger (Schedule: co 15 min)
    │
    ▼
Supabase Node: SELECT * FROM roger_sync_log 
               WHERE sync_type='events' 
               ORDER BY completed_at DESC LIMIT 1
    │
    ▼
IF Node: completed_at < NOW() - INTERVAL '10 minutes'
    │
    ▼ (tak)
Email/Notification: "Uwaga! Synchronizacja Roger nie działa od X minut"
```

### Zmienne środowiskowe (dodać do deploy/.env)

```bash
# Roger RACS-5 MS SQL Connection
ROGER_MSSQL_HOST=192.168.x.x          # IP serwera MS SQL z Roger
ROGER_MSSQL_PORT=1433
ROGER_MSSQL_DATABASE=RACS5             # nazwa bazy Roger
ROGER_MSSQL_USER=roger_readonly        # konto read-only!
ROGER_MSSQL_PASSWORD=***
ROGER_MSSQL_ENCRYPT=true
ROGER_MSSQL_TRUST_CERT=true

# Sync settings
ROGER_SYNC_INTERVAL_MINUTES=2
ROGER_SYNC_BATCH_SIZE=500
```

---

## 7. API Routes (Next.js)

### Struktura plików

```
app/api/
├── attendance/
│   ├── events/
│   │   └── route.ts          # GET - zdarzenia obecności
│   ├── today/
│   │   └── route.ts          # GET - dzisiejszy status
│   ├── summary/
│   │   └── route.ts          # GET - podsumowania dzienne/tygodniowe
│   └── sync-status/
│       └── route.ts          # GET - status synchronizacji Roger
├── schedules/
│   ├── route.ts              # GET/POST - lista/tworzenie grafików
│   ├── [id]/
│   │   ├── route.ts          # GET/PUT/DELETE - grafik
│   │   └── entries/
│   │       └── route.ts      # GET/POST/PUT - wpisy grafiku
│   └── templates/
│       └── route.ts          # GET/POST - szablony grafików
└── absences/
    ├── route.ts              # GET/POST - nieobecności
    └── [id]/
        └── route.ts          # PUT (approve/reject)
```

### Przykład: GET /api/attendance/today

```typescript
// app/api/attendance/today/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const supabase = createSupabaseServerClient(req)
  
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Sprawdź rolę - pracownik widzi tylko siebie, kierownik+ widzi dział
  const { data: profile } = await supabase
    .from('users')
    .select('role, department_id')
    .eq('id', user.id)
    .single()

  let query = supabase.from('today_attendance_status').select('*')

  if (profile?.role === 'pracownik') {
    query = query.eq('user_id', user.id)
  } else if (profile?.role === 'kierownik') {
    // Pobierz działy kierownika
    const { data: depts } = await supabase
      .from('user_departments')
      .select('department_id')
      .eq('user_id', user.id)
    
    const deptIds = depts?.map(d => d.department_id) || []
    query = query.in('department_id', deptIds)
  }
  // superadmin/dyrektor - widzi wszystko

  const { data, error } = await query
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}
```

---

## 8. Frontend - nowe strony

### Nawigacja (Sidebar.tsx) - dodać:

```typescript
// W tablicy navigation dodać:
{ name: 'Obecności', href: '/dashboard/attendance', icon: UserCheck },
{ name: 'Grafiki', href: '/dashboard/schedules', icon: CalendarDays },
```

### Strona `/dashboard/attendance` - Dashboard obecności

**Funkcje:**
- **Panel na żywo**: Kto jest teraz w pracy (zielony), kto nie przyszedł (czerwony), kto się spóźnił (żółty)
- **Timeline dnia**: Oś czasu z wejściami/wyjściami dla każdego pracownika
- **Filtry**: Po dziale, dacie, statusie
- **Statystyki**: % obecności, średnie spóźnienia, nadgodziny

**Widok:**
```
┌──────────────────────────────────────────────────────────┐
│ 📊 Obecności - Czwartek, 13 lutego 2026                   │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐           │
│  │ 🟢 23  │ │ 🔴 3   │ │ 🟡 2   │ │ 🔵 4   │           │
│  │ Obecni │ │Nieobecni│ │Spóźnieni│ │ Urlop  │           │
│  └────────┘ └────────┘ └────────┘ └────────┘           │
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │ Dział: [Wszystkie ▼]  Data: [2026-02-13]        │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Imię i nazwisko  │ Wejście │ Wyjście │ Godziny  │   │
│  ├──────────────────┼─────────┼─────────┼──────────│   │
│  │ 🟢 Jan Kowalski  │  7:52   │   --    │  5:08    │   │
│  │ 🟢 Anna Nowak    │  7:58   │   --    │  5:02    │   │
│  │ 🟡 Piotr Wiśnia  │  8:23   │   --    │  4:37*   │   │
│  │ 🔴 Maria Ziel.   │   --    │   --    │   0:00   │   │
│  │ 🔵 Adam Wójcik   │   --    │   --    │  Urlop   │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  * = spóźnienie                                          │
└──────────────────────────────────────────────────────────┘
```

### Strona `/dashboard/schedules` - Grafiki pracy

**Funkcje:**
- **Widok tygodniowy/miesięczny**: Siatka z dniami i pracownikami
- **Drag & drop**: Przypisywanie zmian
- **Szablony**: Zapisywanie powtarzalnych grafików
- **Porównanie**: Grafik vs. rzeczywista obecność
- **Eksport**: PDF/CSV

**Widok:**
```
┌──────────────────────────────────────────────────────────┐
│ 📅 Grafik: Hala Sportowa - Luty 2026                     │
├──────────────────────────────────────────────────────────┤
│  [← Tydzień 7]  10-16 lutego 2026  [Tydzień 9 →]        │
│                                                          │
│  ┌────────┬──────┬──────┬──────┬──────┬──────┬──────┐   │
│  │Pracown.│  Pon │  Wt  │  Śr  │  Czw │  Pt  │  Sob │   │
│  ├────────┼──────┼──────┼──────┼──────┼──────┼──────┤   │
│  │Jan K.  │ 7-15 │ 7-15 │ 7-15 │ 7-15 │ 7-15 │  --  │   │
│  │Anna N. │ 8-16 │ 8-16 │  UW  │ 8-16 │ 8-16 │  --  │   │
│  │Piotr W.│15-23 │15-23 │15-23 │15-23 │15-23 │ 8-16 │   │
│  │Maria Z.│ 7-15 │  L4  │  L4  │  L4  │  L4  │  --  │   │
│  └────────┴──────┴──────┴──────┴──────┴──────┴──────┘   │
│                                                          │
│  [+ Dodaj zmianę]  [Kopiuj tydzień]  [Eksport PDF]      │
└──────────────────────────────────────────────────────────┘
```

---

## 9. Bezpieczeństwo i sieć

### Wymagania sieciowe

```
┌─────────────────────┐         ┌─────────────────────┐
│  Serwer MOSiR       │         │  Serwer Roger       │
│  (K3s / Docker)     │         │  (Windows Server)    │
│                     │         │                     │
│  n8n ──────────────────TCP────► MS SQL (port 1433)  │
│  (port 5678)        │  1433   │                     │
│                     │         │  Integration Server │
│  Supabase ◄─────────│         │  (port 8892)        │
│  Next.js            │         │                     │
│  (port 3000)        │         │  VISO Web           │
└─────────────────────┘         │  (port 8080)        │
                                └─────────────────────┘
```

### Checklist bezpieczeństwa

- [ ] **Konto MS SQL read-only** - utworzyć dedykowane konto z uprawnieniami tylko SELECT na tabelach Events, Persons, AccessPoints
- [ ] **Firewall** - otworzyć port 1433 tylko z IP serwera n8n
- [ ] **VPN/tunel** - jeśli serwery w różnych sieciach, użyć WireGuard lub Cloudflare Tunnel
- [ ] **Szyfrowanie** - TLS dla połączenia MS SQL (`encrypt=true`)
- [ ] **RLS w Supabase** - pracownik widzi tylko swoje dane, kierownik widzi dział
- [ ] **Audit log** - tabela `roger_sync_log` monitoruje synchronizację
- [ ] **Secrets** - hasła MS SQL w `.env` (nigdy w kodzie), w K8s jako Secrets

### Konfiguracja konta read-only w MS SQL

```sql
-- Wykonać na serwerze MS SQL z Roger RACS-5
USE RACS5;  -- lub nazwa bazy Roger
GO

CREATE LOGIN roger_portal_reader WITH PASSWORD = 'StrongPassword!123';
CREATE USER roger_portal_reader FOR LOGIN roger_portal_reader;

-- Nadaj tylko SELECT na potrzebne tabele
GRANT SELECT ON dbo.Events TO roger_portal_reader;
GRANT SELECT ON dbo.Persons TO roger_portal_reader;
GRANT SELECT ON dbo.AccessPoints TO roger_portal_reader;
-- Jeśli istnieje tabela TimeAttendance:
-- GRANT SELECT ON dbo.TimeAttendance TO roger_portal_reader;
GO
```

---

## 10. Plan wdrożenia krok po kroku

### Faza 0: Przygotowanie (1 dzień)
- [ ] Uzyskać dostęp do serwera MS SQL z Roger
- [ ] Sprawdzić dokładną strukturę tabel w bazie Roger (SSMS)
- [ ] Porównać nazwy tabel/kolumn z tym dokumentem
- [ ] Utworzyć konto read-only w MS SQL
- [ ] Sprawdzić łączność sieciową (ping, telnet port 1433)
- [ ] Skopiować plik `RACS-5 - Instrukcja integracji EN.pdf` do `docs/`

### Faza 1: Baza danych (1 dzień)
- [ ] Wykonać migrację SQL (Sekcja 5) w Supabase
- [ ] Sprawdzić RLS policies
- [ ] Zaktualizować `types/database.ts` (Supabase CLI: `supabase gen types`)
- [ ] Przetestować widoki i funkcje

### Faza 2: n8n Workflows (2 dni)
- [ ] Dodać zmienne środowiskowe Roger do `.env` n8n
- [ ] Skonfigurować credential "Microsoft SQL" w n8n
- [ ] Zbudować Workflow 1: sync osób
- [ ] Zbudować Workflow 2: sync zdarzeń (co 2 min)
- [ ] Zbudować Workflow 3: monitoring
- [ ] Przetestować z rzeczywistymi danymi z Roger
- [ ] Zweryfikować mapowanie osób Roger → użytkownicy portalu

### Faza 3: Backend API (1 dzień)
- [ ] Zbudować API routes (attendance, schedules, absences)
- [ ] Dodać walidację i autoryzację
- [ ] Przetestować endpointy

### Faza 4: Frontend - Obecności (2 dni)
- [ ] Strona `/dashboard/attendance`
- [ ] Komponent dashboardu z kafelkami statusów
- [ ] Tabela obecności z filtrami
- [ ] Supabase Realtime subskrypcja (live updates)
- [ ] Aktualizacja Sidebar

### Faza 5: Frontend - Grafiki (3 dni)
- [ ] Strona `/dashboard/schedules`
- [ ] Widok tygodniowy/miesięczny (grid)
- [ ] Formularz tworzenia/edycji zmian
- [ ] Zarządzanie nieobecnościami
- [ ] Porównanie grafik vs. rzeczywistość

### Faza 6: Testy i deploy (1 dzień)
- [ ] Testy end-to-end
- [ ] Monitoring w n8n (alerty na błędy sync)
- [ ] Deploy na staging
- [ ] Deploy na produkcję
- [ ] Dokumentacja użytkownika

**Łączny szacowany czas: ~11 dni roboczych**

---

## 11. Wymagania sieciowe / infrastrukturalne

### Serwer Roger RACS-5
- [ ] MS SQL Server dostępny z sieci serwera MOSiR
- [ ] Port 1433 otwarty (TCP)
- [ ] Konto read-only z dostępem do tabel Events, Persons, AccessPoints
- [ ] Wersja RACS-5 z Integration Server (>= v1.5)

### Serwer MOSiR Portal
- [ ] n8n z node `n8n-nodes-base` (zawiera Microsoft SQL node)
- [ ] Supabase z nowymi tabelami
- [ ] Zmienne środowiskowe dla połączenia Roger

### Opcjonalnie: Cloudflare Tunnel (jeśli serwery w różnych lokalizacjach)
```yaml
# W cloudflared config dodać:
ingress:
  - hostname: roger-sql.internal.e-mosir.pl
    service: tcp://ROGER_SERVER_IP:1433
```

---

## 12. FAQ / Troubleshooting

### Q: Co jeśli serwer Roger nie ma statycznego IP?
**A:** Użyj Cloudflare Tunnel lub WireGuard VPN do zestawienia stałego połączenia.

### Q: Co z wydajnością przy dużej liczbie zdarzeń?
**A:** Workflow n8n pobiera tylko nowe zdarzenia (WHERE EventID > lastSynced). Indeksy w Supabase zapewniają szybkie zapytania. Limit 500 zdarzeń na sync batch.

### Q: Co jeśli synchronizacja się zepsuje?
**A:** Tabela `roger_sync_log` zapisuje status każdej synchronizacji. Workflow 3 wysyła alert jeśli sync nie działa >10 min. Retry jest wbudowany w n8n.

### Q: Jak zmapować osoby Roger do użytkowników portalu?
**A:** Tabela `roger_person_mapping` łączy `roger_person_id` z `user_id`. Mapowanie po imieniu+nazwisku (Workflow 1) lub ręcznie przez panel admina.

### Q: Czy mogę używać Integration Server (SOAP) zamiast bezpośrednio MS SQL?
**A:** Tak, ale wymagałoby to pakietu `soap` w Node.js lub dedykowanego node'a w n8n. Bezpośredni dostęp do MS SQL jest prostszy i bardziej elastyczny.

### Q: Jakie typy zdarzeń (EventType) są w Roger?
**A:** Typowe wartości (sprawdzić w instrukcji integracji):
- `1` = Identyfikacja poprawna (wejście)
- `2` = Identyfikacja poprawna (wyjście)
- `3` = Identyfikacja odrzucona
- `4` = Drzwi otwarte
- `5` = Drzwi zamknięte
- `6` = Alarm

> **WAŻNE**: Dokładne kody zdarzeń mogą się różnić. Sprawdź w dokumentacji
> Roger RACS-5 lub bezpośrednio w tabeli Events w MS SQL.

### Q: Co z RODO/ochroną danych osobowych?
**A:** Dane obecności to dane osobowe. Upewnij się, że:
- Pracownicy są poinformowani o przetwarzaniu
- RLS w Supabase ogranicza dostęp
- Dane są przechowywane nie dłużej niż wymagane (retencja)
- Konto MS SQL ma minimalne uprawnienia (read-only)

---

## Załączniki

### A. Przykład n8n Workflow JSON (events sync)

Gotowy workflow do importu w n8n: `docs/n8n-roger-events-sync.json` (do utworzenia po konfiguracji).

### B. Powiązane dokumenty

- `docs/DEPLOYMENT.md` - instrukcja deploymentu
- `docs/NOTIFICATIONS.md` - system powiadomień
- `deploy/docker-compose.n8n.yml` - konfiguracja n8n
- `RACS-5 - Instrukcja integracji EN.pdf` - oficjalna dokumentacja Roger (do skopiowania do `docs/`)

### C. Kontakty

- **Roger support**: support@roger.pl
- **Roger dokumentacja**: https://roger.pl/en/products/racs-5-access-control-system/documentation
- **VISO Web manual**: https://roger.pl/en/support/technical-support/download/manuals/2712-viso-web-operating-manual
