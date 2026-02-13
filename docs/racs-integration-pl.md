# Integracja Roger RACS-5 - Przewodnik (Polski)

## Przegląd

System integracji Roger RACS-5 umożliwia automatyczne śledzenie obecności pracowników w oparciu o zdarzenia dostępu z systemu kontroli dostępu Roger.

### Co zostało zaimplementowane:

1. **Baza danych** - 6 nowych tabel do przechowywania:
   - Konfiguracji integracji RACS
   - Mapowania użytkowników portal → RACS
   - Grafików pracy (harmonogramów)
   - Rekordów obecności z systemu RACS
   - Podsumowań dziennych obecności
   - Logów synchronizacji

2. **Klient RACS** (`lib/racs-client.ts`) - Komunikacja z systemem Roger RACS-5:
   - Połączenie przez SOAP/WCF API
   - Pobieranie zdarzeń z event logu
   - Pobieranie osób i kart dostępu
   - Pobieranie drzwi i punktów dostępu

3. **Serwis synchronizacji** (`lib/racs-sync.ts`):
   - Automatyczna synchronizacja zdarzeń dostępu
   - Auto-mapowanie użytkowników (dopasowanie po nazwisku/email)
   - Obliczanie obecności, spóźnień, wcześniejszych wyjść

4. **API Routes** - Endpointy REST API:
   - `/api/attendance` - Podgląd rekordów obecności
   - `/api/attendance/summary` - Podsumowania obecności ze statystykami
   - `/api/schedules` - Zarządzanie grafikami pracy
   - `/api/racs/config` - Konfiguracja połączenia z RACS
   - `/api/racs/sync` - Manualne uruchamianie synchronizacji
   - `/api/racs/mappings` - Zarządzanie mapowaniami użytkowników
   - `/api/cron/racs-sync` - Endpoint dla automatycznej synchronizacji

5. **Automatyczna synchronizacja** - Cron job co 5 minut

## Instalacja krok po kroku

### Krok 1: Uruchom migrację bazy danych

```bash
# Połącz się z bazą Supabase i wykonaj migrację
psql -h db.your-project.supabase.co -U postgres -d postgres -f SQL/migration-attendance-schedules.sql
```

Lub przez interfejs Supabase SQL Editor - skopiuj i wykonaj zawartość pliku `SQL/migration-attendance-schedules.sql`.

### Krok 2: Skonfiguruj połączenie z Roger RACS-5

Potrzebujesz następujących danych z systemu Roger:

- **URL serwisu**: Domyślnie `http://127.0.0.1:8892` (lub IP serwera RACS)
- **Użytkownik**: Login operatora VISO
- **Hasło**: Hasło operatora VISO

Konfiguracja przez API:

```bash
curl -X POST http://localhost:3000/api/racs/config \
  -H "Content-Type: application/json" \
  -d '{
    "service_url": "http://192.168.1.100:8892",
    "username": "admin",
    "password": "twoje-haslo",
    "sync_enabled": true,
    "sync_interval_minutes": 5
  }'
```

### Krok 3: Mapowanie użytkowników portal ↔ RACS

Żeby system mógł automatycznie przypisywać obecności do użytkowników, musisz połączyć konta w portalu z osobami/kartami w systemie RACS.

#### Auto-mapowanie (zalecane jako pierwszy krok):

```bash
curl -X POST http://localhost:3000/api/racs/sync \
  -H "Content-Type: application/json" \
  -d '{"action": "auto-map"}'
```

To automatycznie dopasuje użytkowników po nazwisku i emailu.

#### Manualne mapowanie:

Jeśli jakieś osoby nie zostały dopasowane automatycznie:

```bash
curl -X POST http://localhost:3000/api/racs/mappings \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "uuid-uzytkownika-w-portalu",
    "racs_person_id": 123,
    "racs_credential_id": 456,
    "racs_credential_number": "12345678"
  }'
```

### Krok 4: Ustaw automatyczną synchronizację

System potrzebuje regularnie pobierać zdarzenia z RACS. Wybierz jedną opcję:

#### Opcja A: Vercel Cron (jeśli używasz Vercel)

Plik `vercel.json` jest już skonfigurowany. Dodaj tylko zmienną środowiskową:

```bash
CRON_SECRET=twoj-losowy-sekret
```

#### Opcja B: Zewnętrzny serwis cron

Użyj serwisu typu cron-job.org:

1. Utwórz zadanie cron wywołujące: `https://twoja-domena.pl/api/cron/racs-sync`
2. Ustaw harmonogram: co 5 minut `*/5 * * * *`
3. Dodaj nagłówek: `Authorization: Bearer twoj-sekret`

#### Opcja C: Systemowy cron (Linux)

Dodaj do crontab:

```bash
*/5 * * * * curl -X POST https://twoja-domena.pl/api/cron/racs-sync \
  -H "Authorization: Bearer twoj-sekret"
```

#### Opcja D: Manualna synchronizacja (testowanie)

```bash
curl -X POST http://localhost:3000/api/racs/sync \
  -H "Content-Type: application/json" \
  -d '{"action": "sync"}'
```

### Krok 5: Tworzenie grafików pracy

Żeby system mógł wykrywać spóźnienia i wcześniejsze wyjścia, utwórz grafiki dla pracowników:

#### Pojedynczy grafik:

```bash
curl -X POST http://localhost:3000/api/schedules \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "uuid-uzytkownika",
    "schedule_date": "2026-02-13",
    "shift_start": "08:00:00",
    "shift_end": "16:00:00",
    "shift_type": "standard"
  }'
```

#### Hurtowo dla całego miesiąca:

```javascript
const schedules = [];
const userId = "uuid-uzytkownika";

// Poniedziałek-Piątek, 8:00-16:00
for (let day = 1; day <= 28; day++) {
  const date = new Date(2026, 1, day); // Luty 2026
  const dayOfWeek = date.getDay();

  schedules.push({
    user_id: userId,
    schedule_date: `2026-02-${day.toString().padStart(2, '0')}`,
    shift_start: "08:00:00",
    shift_end: "16:00:00",
    shift_type: "standard",
    is_day_off: dayOfWeek === 0 || dayOfWeek === 6 // Sobota/Niedziela
  });
}

// Wyślij wszystkie grafiki
await fetch('/api/schedules', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(schedules)
});
```

## Jak to działa

### Przepływ synchronizacji:

```
1. Cron uruchamia co 5 minut
     ↓
2. System łączy się z RACS przez SOAP API
     ↓
3. Pobiera nowe zdarzenia (od ostatniego ID)
     ↓
4. Filtruje zdarzenia dostępu przez drzwi (kody 601, 602)
     ↓
5. Mapuje zdarzenia na użytkowników portalu
     ↓
6. Tworzy rekordy w tabeli attendance_records
     ↓
7. Trigger automatycznie oblicza podsumowanie dzienne
     ↓
8. Sprawdza grafik i wykrywa:
   - Spóźnienia (>15 min po rozpoczęciu)
   - Wcześniejsze wyjścia (>15 min przed końcem)
   - Nieobecności
```

### Kody zdarzeń RACS:

- **601** - Dostęp przyznany (wejście do budynku)
- **602** - Dostęp odmówiony (zarejestrowane, ale nie liczy się jako obecność)
- **13** - Odczyt karty

### Metryki obliczane automatycznie:

- **Pierwsze wejście** - Najwcześniejsze wejście danego dnia
- **Ostatnie wyjście** - Najpóźniejsze wyjście danego dnia
- **Suma godzin** - Różnica między pierwszym wejściem a ostatnim wyjściem
- **Godziny planowane** - Z grafiku pracy
- **Spóźnienie** - Wejście >15 min po planowanym rozpoczęciu
- **Wcześniejsze wyjście** - Wyjście >15 min przed planowanym końcem
- **Nieobecność** - Brak wejścia w zaplanowany dzień pracy

## Przykłady użycia API

### Podgląd obecności dla użytkownika w lutym:

```bash
curl "http://localhost:3000/api/attendance/summary?userId=xxx&month=2026-02"
```

Odpowiedź:
```json
{
  "data": [
    {
      "user_id": "xxx",
      "date": "2026-02-13",
      "first_entry": "2026-02-13T08:05:00Z",
      "last_exit": "2026-02-13T16:10:00Z",
      "total_hours": 8.08,
      "scheduled_hours": 8.00,
      "is_present": true,
      "is_late": false,
      "is_early_leave": false,
      "is_absent": false
    }
  ],
  "stats": {
    "totalDays": 20,
    "presentDays": 19,
    "absentDays": 1,
    "lateDays": 2,
    "earlyLeaveDays": 1,
    "totalHours": 152.5,
    "scheduledHours": 160.0
  }
}
```

### Podgląd grafików działu:

```bash
curl "http://localhost:3000/api/schedules?departmentId=1&month=2026-02"
```

### Status synchronizacji:

```bash
curl "http://localhost:3000/api/racs/sync"
```

Odpowiedź:
```json
{
  "config": {
    "service_url": "http://192.168.1.100:8892",
    "username": "admin",
    "sync_enabled": true,
    "sync_interval_minutes": 5,
    "last_sync_event_id": 12543
  },
  "syncLogs": [
    {
      "sync_started_at": "2026-02-13T10:00:00Z",
      "sync_completed_at": "2026-02-13T10:00:05Z",
      "events_processed": 47,
      "events_created": 23,
      "events_skipped": 24,
      "status": "completed"
    }
  ],
  "stats": {
    "totalAttendanceRecords": 1543,
    "mappedUsers": 25
  }
}
```

## Rozwiązywanie problemów

### Brak rekordów obecności

1. Sprawdź konfigurację RACS:
   ```sql
   SELECT * FROM racs_integration_config WHERE sync_enabled = true;
   ```

2. Sprawdź logi synchronizacji:
   ```sql
   SELECT * FROM racs_sync_log ORDER BY sync_started_at DESC LIMIT 10;
   ```

3. Sprawdź mapowania:
   ```sql
   SELECT * FROM racs_user_mapping WHERE active = true;
   ```

4. Test połączenia:
   ```bash
   curl -X POST http://localhost:3000/api/racs/sync \
     -H "Content-Type: application/json" \
     -d '{"action": "sync"}'
   ```

### Użytkownicy nie są mapowani

1. Uruchom auto-mapowanie ponownie
2. Sprawdź czy nazwiska i emaile się zgadzają
3. Utwórz mapowania ręcznie dla nieuchwyconych użytkowników

### Spóźnienia/wczesne wyjścia nie działają

1. Sprawdź czy grafiki są utworzone:
   ```sql
   SELECT * FROM work_schedules WHERE user_id = 'xxx';
   ```

2. Sprawdź trigger obliczający podsumowania

### Błędy połączenia z RACS

1. Sprawdź czy URL jest poprawny
2. Sprawdź login i hasło
3. Sprawdź czy usługi Web Services są włączone w RACS
4. Sprawdź firewall (port 8892)

## Bezpieczeństwo

### Przed produkcją:

1. **Zaszyfruj hasła** - Zaimplementuj szyfrowanie hasła RACS w bazie
2. **Zabezpiecz endpoint cron** - Dodaj silny sekret
3. **Użyj HTTPS** - Zawsze w produkcji
4. **Sieć wewnętrzna** - Umieść serwer RACS w sieci wewnętrznej
5. **Rate limiting** - Dodaj limity zapytań
6. **Audit log** - Loguj wszystkie zmiany konfiguracji

## Co dalej

### Możliwe rozszerzenia:

- Panel administracyjny do zarządzania grafikami
- Raport obecności z eksportem do PDF/Excel
- Powiadomienia o spóźnieniach/nieobecnościach
- Integracja z wnioskami urlopowymi
- Obliczanie nadgodzin
- Aplikacja mobilna do wglądu w obecność
- Wymiana zmian między pracownikami
- Szablony grafików dla działów

## Dokumentacja

- Pełna dokumentacja w języku angielskim: `docs/racs-integration-setup.md`
- Instrukcja integracji RACS-5: `docs/roger-racs5-integration.md`
- Migracja bazy danych: `SQL/migration-attendance-schedules.sql`
