# Worklog

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
