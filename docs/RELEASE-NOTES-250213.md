# Release Notes: release-250213

**Data wydania:** 2026-02-13
**Branch:** main
**Poprzednia wersja:** release-250212

## 🎉 Główne funkcjonalności

### 1. **3 widoki grafików pracy** (Schedule Views)
Dodano możliwość przełączania między trzema różnymi widokami grafików:

#### 📊 **Excel-like Grid View**
- Tabela ze wszystkimi pracownikami jako wierszami
- Dni tygodnia jako kolumny
- Inline edycja zmian w każdej komórce
- Automatyczne sumowanie godzin w kolumnie SUMA
- Sticky kolumna z nazwiskami (zawsze widoczna przy scrollowaniu)
- Wyróżnienie weekendów szarym tłem

#### ⏱️ **Timeline/Gantt View**
- Wizualizacja bloków zmianowych na osi czasu
- Kolorowe bloki dla każdego typu zmiany
- Szybki podgląd godzin rozpoczęcia/zakończenia
- Edycja zmian bezpośrednio w timeline
- Wyróżnienie weekendów na osi czasu

#### 📅 **Weekly Cards View** (istniejący, ulepszony)
- Karty z pełnymi szczegółami dla każdego pracownika
- Widok dnia z datą i nazwą
- Pełne informacje o zmianach (typ, godziny)
- Przyciski akcji przy każdym pracowniku

**Pliki zmienione:**
- `app/dashboard/schedules/page.tsx` — dodano Tabs z 3 widokami
- `components/ui/tabs.tsx` — komponent tabs (już istniejący)

---

### 2. **Preferencje zmian pracowników** (Shift Preferences)
System konfiguracji rodzaju pracownika i dozwolonych typów zmian:

#### Nowe pola w tabeli `users`:
- `is_office_worker` (boolean) — pracownik biurowy vs zmianowy
- `default_shift_start` (time) — domyślna godzina rozpoczęcia (default: 08:00)
- `default_shift_end` (time) — domyślna godzina zakończenia (default: 16:00)
- `default_shift_type` (varchar) — domyślny typ zmiany ('1', '2', '12' lub NULL)
- `allowed_shift_types` (text[]) — dozwolone typy zmian dla użytkownika

#### Funkcjonalności:
- Dropdown wyboru zmiany pokazuje tylko dozwolone typy dla danego użytkownika
- Przycisk "+ Standard" używa preferencji użytkownika (nie zawsze 8:00-16:00)
- Badge "Biuro" przy pracownikach biurowych
- UI w `/dashboard/users` do konfiguracji preferencji dla każdego pracownika

**Pliki zmienione:**
- `SQL/migration-user-shift-preferences.sql` — migracja bazy
- `app/dashboard/schedules/page.tsx` — wykorzystanie preferencji
- `app/dashboard/users/page.tsx` — UI konfiguracji preferencji
- `app/api/users/update/route.ts` — API aktualizacji preferencji
- `types/database.ts` — typy TypeScript
- `docs/shift-preferences-setup.md` — dokumentacja

---

### 3. **Multi-Department Task Creation Fix**
Naprawa błędu gdzie użytkownicy z wieloma działami nie mogli tworzyć zadań dla wszystkich swoich działów.

#### Co zostało naprawione:
- Formularz tworzenia zadania teraz pobiera wszystkie działy użytkownika z `user_departments`
- Dropdown "Dział" pokazuje wszystkie działy użytkownika (nie tylko główny)
- Badge'e w nagłówku pokazują wszystkie działy użytkownika
- Domyślny dział ustawiany na pierwszy (primary) z listy

**Pliki zmienione:**
- `app/dashboard/tasks/add-task/page.tsx` — wykorzystanie hooka useUserDepartments
- `hooks/useUserDepartments.ts` — hook do pobierania działów (już istniejący)
- `docs/fix-multi-department-task-creation.md` — dokumentacja fix'a

---

### 4. **RACS Integration** (Roger RACS-5 Attendance System)
Pełna integracja z systemem kontroli dostępu Roger RACS-5:

#### Backend:
- **6 nowych tabel** w bazie danych:
  - `racs_integration_config` — konfiguracja połączenia
  - `racs_user_mapping` — mapowanie użytkowników RACS → Portal
  - `work_schedules` — grafiki pracy
  - `attendance_records` — rekordy obecności
  - `attendance_summary` — podsumowania dzienne
  - `racs_sync_log` — logi synchronizacji

- **RACS SOAP Client** (`lib/racs-client.ts`) — komunikacja z RACS API
- **Sync Service** (`lib/racs-sync.ts`) — synchronizacja danych
- **API Endpoints**:
  - `/api/racs/config` — zarządzanie konfiguracją
  - `/api/racs/mappings` — mapowanie użytkowników
  - `/api/racs/sync` — ręczna synchronizacja
  - `/api/cron/racs-sync` — automatyczna synchronizacja (cron)
  - `/api/attendance` — pobieranie obecności
  - `/api/attendance/summary` — podsumowania
  - `/api/schedules` — zarządzanie grafikami

#### Frontend:
- **Attendance Dashboard** (`/dashboard/attendance`) — przeglądanie obecności
  - 4 karty statystyczne (obecni, spóźnieni, nieobecni, łączne godziny)
  - 2 tryby: podsumowanie (summary) i szczegółowe rekordy (records)
  - Filtry: zakres dat, użytkownik, wyszukiwanie
  - Eksport do CSV
  - React-virtuoso dla wydajności dużych list

- **Schedules Dashboard** (`/dashboard/schedules`) — zarządzanie grafikami (3 widoki)

#### Development Tools:
- **Mock RACS Server** (`scripts/mock-racs-server.js`) — serwer testowy
- Dane 13 rzeczywistych użytkowników MOSiR
- ~900 wygenerowanych eventów na 30 dni

**Pliki dodane:**
- `SQL/migration-attendance-schedules.sql` — główna migracja
- `SQL/fix-rls-attendance.sql` — naprawa RLS policies
- `lib/racs-client.ts`, `lib/racs-sync.ts` — backend
- `scripts/mock-racs-server.js` — mock server
- `docs/racs-integration-setup.md` — dokumentacja setup
- `docs/roger-racs5-integration.md` — główna dokumentacja

---

## 📊 Statystyki zmian

- **Nowe pliki:** ~30
- **Zmienione pliki:** ~15
- **Nowe tabele SQL:** 6
- **Nowe API endpointy:** 11
- **Nowe strony dashboard:** 2 (attendance, schedules - już były, ale mocno rozbudowane)
- **Migracje SQL:** 3

---

## 🔧 Wymagane migracje SQL

**UWAGA:** Wykonaj migracje w Supabase SQL Editor **PRZED** deployem aplikacji!

### 1. Migracja RACS (jeśli nie wykonana wcześniej)
```bash
# Plik: SQL/migration-attendance-schedules.sql
# Tworzy: 6 tabel (racs_*, work_schedules, attendance_*)
```

### 2. Fix RLS dla attendance (jeśli nie wykonany wcześniej)
```bash
# Plik: SQL/fix-rls-attendance.sql
# Naprawia: polityki RLS dla attendance_records, attendance_summary
```

### 3. Migracja shift preferences
```bash
# Plik: SQL/migration-user-shift-preferences.sql
# Dodaje: 5 kolumn do tabeli users (shift preferences)
# Ustawia: domyślne wartości dla pracowników biurowych
```

---

## 🚀 Deployment Checklist

### Pre-deployment:
- [ ] Wykonaj migracje SQL w Supabase (w kolejności: 1 → 2 → 3)
- [ ] Zweryfikuj migracje (sprawdź czy tabele i kolumny istnieją)
- [ ] Sprawdź czy wszystkie testy przechodzą: `npm run build`
- [ ] Przejrzyj changelog i upewnij się, że rozumiesz zmiany

### Deployment (k3s):
```bash
# 1. Tag release
git tag release-250213
git push origin release-250213

# 2. Poczekaj na build GitHub Actions (GHCR)
# Sprawdź: https://github.com/marmal6313/mosir-portal/actions

# 3. Zastosuj nowy obraz na k3s
kubectl set image deployment/mosir-portal \
  mosir-portal=ghcr.io/marmal6313/mosir-portal:release-250213 \
  -n apps

# 4. Monitoruj rollout
kubectl rollout status deployment/mosir-portal -n apps --timeout=180s

# 5. Sprawdź pods
kubectl get pods -n apps -l app=mosir-portal
```

### Post-deployment:
- [ ] Smoke test: `curl -I https://app.e-mosir.pl/api/health` → 200
- [ ] Sprawdź logi: `kubectl logs -n apps -l app=mosir-portal --tail=100`
- [ ] Przetestuj nowe funkcje:
  - [ ] Grafiki - przełączanie między 3 widokami
  - [ ] Tworzenie zadania dla różnych działów (multi-department user)
  - [ ] Konfiguracja preferencji zmian w `/dashboard/users`
  - [ ] Przeglądanie obecności w `/dashboard/attendance` (jeśli RACS skonfigurowany)
- [ ] Zaktualizuj tag w `k8s/app/deployment.yaml` i commit

### Rollback (w razie problemów):
```bash
kubectl rollout undo deployment/mosir-portal -n apps
# lub
kubectl set image deployment/mosir-portal \
  mosir-portal=ghcr.io/marmal6313/mosir-portal:release-250212 \
  -n apps
```

---

## 🐛 Known Issues

Brak znanych problemów. Wszystkie funkcje przetestowane lokalnie i na stagingu.

---

## 📝 Configuration Notes

### RACS Integration (opcjonalne)
Jeśli chcesz skonfigurować integrację z RACS:

1. Dodaj konfigurację w `/dashboard/attendance` (zakładka Config)
2. Zmapuj użytkowników RACS → Portal (zakładka Mappings)
3. Uruchom sync: POST `/api/racs/sync`
4. Opcjonalnie: skonfiguruj cron job dla auto-sync

**Mock Server (development):**
```bash
cd scripts
node mock-racs-server.js
# Serwer na http://localhost:8892
```

### Shift Preferences
Domyślne wartości ustawiane są automatycznie przez migrację dla pracowników biurowych (pozycje zawierające: "dział", "księgowa", "kadr", "dyrektor").

Dla pozostałych użytkowników ustaw preferencje ręcznie w `/dashboard/users` → Edytuj użytkownika → Sekcja "⏰ Preferencje zmian".

---

## 👥 Contributors

- Claude Sonnet 4.5 (AI Assistant)
- Marcin Maliszewski (Product Owner)

---

## 📚 Documentation

- [Shift Preferences Setup](./shift-preferences-setup.md)
- [RACS Integration Setup](./racs-integration-setup.md)
- [Multi-Department Task Creation Fix](./fix-multi-department-task-creation.md)
- [DEPLOYMENT.md](./DEPLOYMENT.md) — zaktualizowane
- [RUNBOOK.md](./RUNBOOK.md) — zaktualizowane

---

## 🔗 Links

- **GitHub Release:** https://github.com/marmal6313/mosir-portal/releases/tag/release-250213
- **Docker Image:** `ghcr.io/marmal6313/mosir-portal:release-250213`
- **Production URL:** https://app.e-mosir.pl
- **Health Check:** https://app.e-mosir.pl/api/health
