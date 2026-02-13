# Worklog

## 2026-02-13 — release-250213: 3 Schedule Views, Shift Preferences, Multi-dept Task Fix, RACS
### Nowa funkcjonalność: 3 widoki grafików pracy
- Dodano możliwość przełączania między trzema widokami grafików: Excel-like Grid, Timeline/Gantt, Weekly Cards.
- **Excel Grid**: tabela ze wszystkimi pracownikami jako wierszami, dni jako kolumny, sticky nazwiska, automatyczne sumowanie.
- **Timeline**: wizualizacja bloków zmianowych na osi czasu, kolorowe bloki, edycja inline.
- **Karty**: istniejący widok kart z pełnymi szczegółami dla każdego pracownika.
- Wszystkie widoki wspierają: filtrowanie po dziale, wyszukiwanie, wypełnianie standardem, kopiowanie tygodni.
- Pliki: `app/dashboard/schedules/page.tsx`, `components/ui/tabs.tsx`.

### Nowa funkcjonalność: Preferencje zmian pracowników
- Dodano konfigurację rodzaju pracownika i dozwolonych typów zmian.
- 5 nowych kolumn w `users`: `is_office_worker`, `default_shift_start`, `default_shift_end`, `default_shift_type`, `allowed_shift_types`.
- Dropdown wyboru zmiany pokazuje tylko dozwolone typy dla danego użytkownika.
- Przycisk "+ Standard" używa preferencji użytkownika (nie zawsze 8:00-16:00).
- Badge "Biuro" przy pracownikach biurowych.
- UI w `/dashboard/users` do konfiguracji preferencji.
- Migracja SQL: `SQL/migration-user-shift-preferences.sql`.
- Pliki: `app/dashboard/schedules/page.tsx`, `app/dashboard/users/page.tsx`, `app/api/users/update/route.ts`, `docs/shift-preferences-setup.md`.

### Fix: Multi-department task creation
- Naprawiono błąd gdzie użytkownicy z wieloma działami nie mogli tworzyć zadań dla wszystkich swoich działów.
- Formularz tworzenia zadania teraz pobiera wszystkie działy użytkownika z `user_departments`.
- Dropdown "Dział" pokazuje wszystkie działy użytkownika (nie tylko główny).
- Badge'e w nagłówku pokazują wszystkie działy użytkownika.
- Domyślny dział ustawiany na pierwszy (primary) z listy.
- Pliki: `app/dashboard/tasks/add-task/page.tsx`, `hooks/useUserDepartments.ts`, `docs/fix-multi-department-task-creation.md`.

### Rozbudowa: RACS Integration
- Pełna integracja z systemem kontroli dostępu Roger RACS-5.
- Backend: 6 nowych tabel, RACS SOAP client, sync service, 11 API endpoints.
- Frontend: Attendance dashboard (2 tryby: summary/records), Schedules dashboard (3 widoki).
- Mock RACS server dla development z 13 rzeczywistymi użytkownikami MOSiR i ~900 eventami.
- Migracje: `SQL/migration-attendance-schedules.sql`, `SQL/fix-rls-attendance.sql`.
- Pliki: `lib/racs-client.ts`, `lib/racs-sync.ts`, `app/dashboard/attendance/page.tsx`, `scripts/mock-racs-server.js`.
- Dokumentacja: `docs/racs-integration-setup.md`, `docs/roger-racs5-integration.md`.

### Deployment
- Release notes: `docs/RELEASE-NOTES-250213.md`.
- Pre-deployment checklist: `docs/PRE-DEPLOYMENT-CHECKLIST.md`.
- Zaktualizowano: `docs/DEPLOYMENT.md`, `docs/RUNBOOK.md`, `docs/worklog.md`.
- Tag `release-250213` → GitHub Actions build Docker image → GHCR.

## 2026-02-12 — release-250212: Multi-department + infra
### Nowa funkcjonalność: przypisanie użytkownika do wielu działów
- Dodano tabelę `user_departments` (junction table, many-to-many) — migracja SQL `SQL/migration-user-departments.sql`.
- Zaktualizowano polityki RLS dla `tasks`, `users`, `departments`, `task_changes`, `task_comments` — filtrowanie po wielu działach (`EXISTS ... user_departments`).
- Zaktualizowano widok `users_with_details`: nowe kolumny `department_ids` (integer[]) i `department_names` (text[]).
- Dodano funkcję SQL `get_user_department_ids(p_user_id UUID) → integer[]`.
- Nowy hook React: `hooks/useUserDepartments.ts` (fetch department IDs z Supabase).
- Strona zadań (`/dashboard/tasks`): filtrowanie po wielu działach dla `kierownik`/`pracownik`.
- Strona raportów (`/dashboard/reports`): agregacja statystyk po wszystkich działach użytkownika.
- Strona użytkowników (`/dashboard/users`): multi-checkbox zamiast dropdowna, wyświetlanie wielu działów jako Badge.
- API routes (`/api/users/create`, `/api/users/update`): obsługa `department_ids[]`, synchronizacja z `user_departments`.
- Typy TypeScript (`types/database.ts`): `user_departments` table, `get_user_department_ids` function, rozszerzony `users_with_details`.

### Infrastruktura
- Naprawa 502 Bad Gateway (Flannel overlay network failure w k3s) — restart kube-flannel, kube-proxy, reschedule cloudflared.
- Dodano manifesty K3s: `k8s/app/` (deployment, service, ingress), `k8s/cloudflared.yaml`.
- Dodano `lib/supabase-keep-alive.ts` (import w `app/layout.tsx`) — zapobiega timeout Supabase Realtime.
- Zaktualizowano n8n image do `1.122.4`.
- Zaktualizowano `.gitignore` (k8s secrets, debug artifacts).

### Deployment
- Tag `release-250212` → GitHub Actions build Docker image → GHCR.
- `kubectl set image deployment/mosir-portal ... release-250212 -n apps` → rollout successful.
- Smoke test: `https://app.e-mosir.pl/api/health` → HTTP 200.

## 2025-09-02
- Uruchomiono pełny stack w Dockerze (Traefik + app + n8n), dodano public hostnames w CF dla `app.e-mosir.pl` i `n8n.e-mosir.pl` (przez Tunnel) — wariant legacy, obecnie zastąpiony przez k3s.
- `/api/health` = 200. CD: build → GHCR, Tailscale → SSH deploy, smoke test.
- Przygotowano plan i DEPLOY guide w repo (później zaktualizowane pod k3s).

Następne: build `staging` do GHCR i przełączenie compose na pull.
