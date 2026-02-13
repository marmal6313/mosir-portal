**Cel**
- Stabilna produkcja, wygodny rozwój, cotygodniowe wydania w poniedziałek, obserwowalność i proste roll‑backi.

**Aktualny release:** `release-250213` (2026-02-13) — 3 schedule views, shift preferences, multi-department task fix, RACS integration.

**Architektura (obecna produkcja — k3s)**
- **Aplikacja**: Next.js, pakowana jako obraz Docker (z `Dockerfile`) i uruchamiana w klastrze k3s.
- **Rejestr obrazów**: GHCR (`ghcr.io/marmal6313/mosir-portal`).
- **Klaster**: k3s, namespace `apps`, Deployment `mosir-portal`, Service `mosir-portal`, Ingress `mosir-portal` (Traefik, `ingressClassName: traefik`); manifesty w `k8s/app`.
- **Ruch zewnętrzny**: Cloudflare (proxy / Tunnel) → Traefik w k3s → Ingress `mosir-portal` → Service `mosir-portal` → Pod(y) aplikacji.
- **TLS/Proxy**: cert-manager + `ClusterIssuer cloudflare-dns` (ACME DNS‑01 z Cloudflare), cert w secrete `mosir-portal-tls`.
- **Monitoring/errory**: healthcheck `GET /api/health`.
- **DB/Backend**: Supabase (zarządzane) — zmienne środowiskowe.

**Architektura (wariant legacy — 1 VM Docker)**
- Wcześniejsza wersja produkcji opierała się na jednym serwerze z Dockerem i Traefikiem
  (`deploy/docker-compose.prod.yml`, `scripts/deploy.sh`, dokument `DEPLOY.md`). Ten wariant
  można traktować jako fallback lub środowisko testowe; obecnie nie jest głównym sposobem
  uruchamiania produkcji.

**Środowiska i release**
- **main**: stabilny kod. Tag `release-YYYYMMDD` — produkcja (obraz GHCR wdrażany do klastrа k3s).
- **PR/feature**: CI (lint, build).
- **Staging (opcjonalnie)**: oddzielny namespace / cluster-context, te same manifesty `k8s/app` i `k8s/cloudflared.yaml`.

**Sekwencja wdrożenia (k3s)**
1) Merge do `main` w tygodniu.
2) Utwórz tag `release-YYMMDD` i wypchnij: `git tag release-YYMMDD && git push origin release-YYMMDD`.
3) GitHub Actions (workflow `CD`) automatycznie buduje obraz Docker i pushuje do GHCR.
   - Job `deploy` (SSH/Docker Compose) prawdopodobnie zgłosi failure — to oczekiwane, bo produkcja działa na k3s, nie Docker Compose.
4) Po pomyślnym buildzie zastosuj nowy obraz na klastrze:
   ```bash
   kubectl set image deployment/mosir-portal \
     mosir-portal=ghcr.io/marmal6313/mosir-portal:release-YYMMDD \
     -n apps
   kubectl rollout status deployment/mosir-portal -n apps
   ```
5) Zaktualizuj tag w manifeście `k8s/app/deployment.yaml` i commitnij:
   ```bash
   # edytuj image tag w k8s/app/deployment.yaml
   git add k8s/app/deployment.yaml
   git commit -m "chore: bump k8s deployment image to release-YYMMDD"
   git push origin main
   ```
6) Smoke test: `curl -I https://app.e-mosir.pl/api/health` → 200.
7) Rollback: `kubectl set image deployment/mosir-portal mosir-portal=ghcr.io/marmal6313/mosir-portal:<previous-tag> -n apps`.

**Konfiguracja GitHub (k3s)**
- Sekrety repo / environment:
  - `GHCR_PAT` lub `GITHUB_TOKEN` z `packages:write` (push obrazu).
  - `KUBECONFIG_B64` — kubeconfig dla klastra k3s (zakodowany base64, zwykle `/etc/rancher/k3s/k3s.yaml`).
- Opcjonalnie: `APP_HOSTNAME=app.e-mosir.pl`, `N8N_HOSTNAME=n8n.e-mosir.pl`, jeśli workflow ma generować Ingress/Tunnel.

**Cloudflare / ingress (k3s)**
- DNS:
  - wariant A/AAAA: `app.e-mosir.pl` i `n8n.e-mosir.pl` → IP nodów k3s (proxied), Traefik + cert-manager (`cloudflare-dns`) wystawiają certy.
  - wariant Tunnel (obecny): rekord CNAME `app`/`n8n` → `<UUID>.cfargotunnel.com`, tunel w `apps` (`k8s/cloudflared.yaml`) z hostnames:
    - `app.e-mosir.pl` → `http://mosir-portal.apps.svc.cluster.local:80`
    - `n8n.e-mosir.pl` → `http://n8n.apps.svc.cluster.local:5678`
    - `dot.e-mosir.pl` → `http://dotacje-app.apps.svc.cluster.local:3000`
- TLS:
  - dla wariantu Tunnel: TLS terminowany w Cloudflare, origin HTTP w sieci klastra.
  - dla wariantu A/AAAA: TLS terminowany w Traefiku (cert-manager `cloudflare-dns`).

**Pierwsze wdrożenie bez GHCR (lokalny build)**
- Gdy obraz nie jest jeszcze opublikowany w GHCR, użyj: `deploy/docker-compose.app-build.yml` (uruchamia tylko app na porcie 3000 lokalnie/stagingowo).
- Docelowo w produkcji używaj pełnego stacka: `deploy/docker-compose.prod.yml`.

**Cloudflare SSL/TLS tryb**
- Rekomendowane: „Full (strict)” (Cloudflare → HTTPS do Traefika). Traefik wystawia ważny cert (ACME DNS‑01, Cloudflare API token).
- Upewnij się, że rekord DNS `app` wskazuje na publiczny IP serwera (A/AAAA, Proxied).

**Podpięcie n8n za Traefikiem (produkcyjnie)**
- Skorzystaj z gotowego pliku: `deploy/docker-compose.n8n.yml` i przykładowego env: `deploy/.env.example`.
- Kroki:
  1) Na serwerze uzupełnij `/opt/mosir-portal/deploy/.env` na bazie `deploy/.env.example`:
     - `N8N_HOSTNAME=n8n.e-mosir.pl`, `N8N_PROTOCOL=https`, `WEBHOOK_URL=https://n8n.e-mosir.pl/`
     - `TRAEFIK_NETWORK=traefik-proxy` (albo Twoja istniejąca sieć Traefika)
     - (opcjonalnie) `N8N_BASIC_AUTH_USER/PASSWORD`
     - (dane n8n) Jeśli chcesz podpiąć istniejące workflowy:
       - Ustaw `N8N_DATA_EXTERNAL=true` i `N8N_DATA_VOLUME=<stary_wolumen>` (np. `n8n-compose_n8n_data`), lub
       - Ustaw `N8N_DATA_BIND=/ścieżka/do/.n8n` (bind mount — nadpisuje volume)
       - Jeśli używałeś szyfrowania: `N8N_ENCRYPTION_KEY=<ten_sam_klucz>`
  2) Upewnij się, że sieć istnieje: `docker network create traefik-proxy` (jeśli brak).
  3) Uruchom deploy: `bash scripts/deploy.sh` (albo przez workflow CD).
- Plik `docker-compose.n8n.yml`:
  - Nie wystawia portów — ruch przechodzi przez Traefik.
  - Ma etykiety Traefika z TLS (ACME DNS‑01):
    - `traefik.http.routers.n8n.rule=Host(`${N8N_HOSTNAME}`)`
    - `...entrypoints=websecure`, `...tls=true`, `...tls.certresolver=letsencrypt`
    - `...services.n8n.loadbalancer.server.port=5678`
   - Dane n8n:
     - Domyślnie używa wolumenu `n8n_data` (lokalny)
     - Możesz wskazać istniejący zewnętrzny wolumen: `N8N_DATA_EXTERNAL=true`, `N8N_DATA_VOLUME=<nazwa>`
     - Możesz użyć bind mount: `N8N_DATA_BIND=/abs/ścieżka/.n8n`
- Zmienne n8n (za proxy): `N8N_HOSTNAME`, `N8N_PROTOCOL`, `WEBHOOK_URL`.
- Szybki test: `curl -I https://n8n.e-mosir.pl` -> 200/301 oraz sprawdź `docker logs traefik`.

**Cloudflare Tunnel (dynamiczny IP — opcjonalnie)**
- Gdy rekord `app` jest CNAME → `<UUID>.cfargotunnel.com`, uruchom tunel na serwerze.
- Kroki:
  - Cloudflare Zero Trust → Access → Tunnels → utwórz Named Tunnel i dodaj Public Hostname:
    - `app.e-mosir.pl` → `http://mosir-portal-app:3000`
  - W `deploy/.env` ustaw `CLOUDFLARE_TUNNEL_TOKEN=<token z CF>`.
  - Dołącz cloudflared do tej samej sieci co aplikacja: `export TRAEFIK_NETWORK=traefik-proxy`.
  - Uruchom: `docker compose -f deploy/cloudflared.yml --env-file deploy/.env up -d`.
  - Test: `curl -I https://app.e-mosir.pl/api/health` → 200.
- Uwaga: w tym wariancie Cloudflare łączy się do origin po HTTP w sieci Dockera; Traefik może być nadal używany dla innych usług.

-**Migracja z istniejącego n8n compose**
- Jeśli masz już `n8n` uruchomione w `/home/dell2/n8n-compose` z własnym Traefikiem:
  - Zatrzymaj stary Traefik (konflikt portów 80/443) i przejdź na wspólny Traefik z tego repo (`docker-compose.prod.yml`).
- Jeśli chcesz podpiąć istniejący kontener n8n pod nasz Traefik tymczasowo (hotfix):
  - `docker network connect traefik-proxy <n8n_container>`
  - Pamiętaj: bez etykiet Traefika na kontenerze n8n nie zadziała — najlepiej przejść na `deploy/docker-compose.n8n.yml`.

**SSH i dostęp administracyjny (Tailscale — rekomendowane)**
- Przy zmiennym publicznym IP korzystaj z Tailscale do SSH (stabilny adres 100.x lub nazwa MagicDNS).
- Opcjonalnie włącz Tailscale SSH na serwerze, aby logować się bezpośrednio po tailnet.

**Backupy**
- Jeżeli trzymasz stan na serwerze (raczej nie — Supabase/Sentry mają własne DB), automatyzuj backup wolumenów i Traefika (`letsencrypt/acme.json`).

**Dostęp do GHCR (pull na serwerze)**
- Publiczne obrazy: ustaw widoczność pakietu `ghcr.io/marmal6313/mosir-portal` na Public — wtedy `docker pull` nie wymaga logowania.
- Prywatne obrazy: zaloguj się na serwerze do GHCR tokenem PAT (scope: `read:packages`):
  - `echo <PAT> | docker login ghcr.io -u marmal6313 --password-stdin`
  - Alternatywnie skonfiguruj `~/.docker/config.json` w systemd dla konta, które uruchamia deploy.

**Testy przed produkcją**
- Lokalne E2E (staging HTTP):
  - Skopiuj `deploy/.env.example` do `deploy/.env` i uzupełnij wartości (Supabase, Sentry itp.).
  - `cd deploy && docker compose -f docker-compose.staging.yml --env-file .env up -d --build`
  - Wejdź na `http://localhost:8080/api/health` (powinno zwrócić `{ status: "ok" }`).
  - Wejdź na `http://localhost:8080/` i przeklikaj główne ścieżki (logowanie, dashboard).
  - Logi: `docker logs -f mosir-portal-app-staging`.
- Smoke test po wdrożeniu (prod):
  - Sprawdź `https://<APP_HOSTNAME>/api/health` i status 200.
  - Przejrzyj Traefik logs.
- Checklista przed prod:
  - Ustaw `APP_HOSTNAME`, `LETSENCRYPT_EMAIL`, `SUPABASE_*` w `deploy/.env` na serwerze.
  - Potwierdź działanie `/api/health` lokalnie i na stagingu.
  - Włącz environment `production` z approvable deploy w GitHub.
  - Zweryfikuj CSP: jeżeli obrazy/zasoby są blokowane, dopisz domeny do `ALLOWED_IMAGE_HOSTS` i zbuduj ponownie.

**Migracje SQL (Supabase)**
- Migracje SQL umieszczamy w katalogu `SQL/` w repo.
- Przed wdrożeniem nowej wersji aplikacji, która wymaga zmian w bazie, uruchom migrację ręcznie w Supabase SQL Editor.
- Po migracji uruchom odpowiedni skrypt weryfikacyjny (np. `SQL/verify-*.sql`).
- Lista migracji:
  | Plik | Opis | Data |
  |---|---|---|
  | `SQL/migration-user-departments.sql` | Tabela `user_departments`, zaktualizowane RLS, widok, funkcja | 2026-02-12 |
  | `SQL/verify-user-departments-migration.sql` | Weryfikacja poprawności migracji multi-department | 2026-02-12 |
  | `SQL/migration-attendance-schedules.sql` | RACS integration: 6 tabel (racs_*, work_schedules, attendance_*) | 2026-02-13 |
  | `SQL/fix-rls-attendance.sql` | Fix RLS policies dla attendance_records, attendance_summary | 2026-02-13 |
  | `SQL/migration-user-shift-preferences.sql` | Shift preferences: 5 kolumn w users (shift config) | 2026-02-13 |

**Funkcjonalność: Multi-department (release-250212)**
- Użytkownicy mogą być przypisani do wielu działów jednocześnie.
- Model danych: tabela `user_departments` (junction table) z kolumnami `user_id`, `department_id`, `is_primary`.
- Kolumna `users.department_id` zachowana dla kompatybilności wstecznej (primary department).
- Widok `users_with_details` zwraca tablice `department_ids` i `department_names`.
- Filtrowanie zadań i raportów uwzględnia wszystkie działy użytkownika (role `kierownik`, `pracownik`).
- UI: multi-checkbox w panelu zarządzania użytkownikami, Badge z nazwami działów w tabeli.
- API: `POST /api/users/create` i `PUT /api/users/update` przyjmują `department_ids: number[]`.
- Pliki:
  - `hooks/useUserDepartments.ts` — hook i helper function
  - `app/dashboard/tasks/page.tsx` — filtrowanie po wielu działach
  - `app/dashboard/reports/page.tsx` — agregacja po wielu działach
  - `app/dashboard/users/page.tsx` — UI multi-select
  - `app/api/users/create/route.ts`, `app/api/users/update/route.ts` — API
  - `types/database.ts` — typy TypeScript

**Funkcjonalność: 3 Schedule Views (release-250213)**
- 3 różne widoki grafików pracy z możliwością przełączania za pomocą tabów
- **Excel-like Grid View**: tabela ze wszystkimi pracownikami jako wierszami, dni jako kolumny, sticky nazwa pracownika, automatyczne sumowanie godzin
- **Timeline/Gantt View**: wizualizacja bloków zmianowych na osi czasu, kolorowe bloki, edycja inline
- **Weekly Cards View**: istniejący widok kart z pełnymi szczegółami dla każdego pracownika
- Wszystkie widoki wspierają: filtrowanie po dziale, wyszukiwanie, wypełnianie standardem, kopiowanie tygodni
- Pliki:
  - `app/dashboard/schedules/page.tsx` — 3 widoki z Tabs
  - `components/ui/tabs.tsx` — komponent tabs
  - `docs/RELEASE-NOTES-250213.md` — dokumentacja

**Funkcjonalność: Shift Preferences (release-250213)**
- Konfiguracja rodzaju pracownika i dozwolonych typów zmian
- 5 nowych kolumn w tabeli `users`: `is_office_worker`, `default_shift_start`, `default_shift_end`, `default_shift_type`, `allowed_shift_types`
- Dropdown wyboru zmiany pokazuje tylko dozwolone typy dla danego użytkownika
- Przycisk "+ Standard" używa preferencji użytkownika (nie zawsze 8:00-16:00)
- Badge "Biuro" przy pracownikach biurowych
- UI w `/dashboard/users` do konfiguracji preferencji
- Pliki:
  - `SQL/migration-user-shift-preferences.sql` — migracja
  - `app/dashboard/schedules/page.tsx` — wykorzystanie preferencji
  - `app/dashboard/users/page.tsx` — UI konfiguracji
  - `app/api/users/update/route.ts` — API
  - `docs/shift-preferences-setup.md` — dokumentacja

**Funkcjonalność: Multi-Department Task Creation Fix (release-250213)**
- Naprawa błędu gdzie użytkownicy z wieloma działami nie mogli tworzyć zadań dla wszystkich swoich działów
- Formularz tworzenia zadania teraz pobiera wszystkie działy użytkownika z `user_departments`
- Dropdown "Dział" pokazuje wszystkie działy użytkownika (nie tylko główny)
- Badge'e w nagłówku pokazują wszystkie działy użytkownika
- Domyślny dział ustawiany na pierwszy (primary) z listy
- Pliki:
  - `app/dashboard/tasks/add-task/page.tsx` — fix
  - `docs/fix-multi-department-task-creation.md` — dokumentacja

**Funkcjonalność: RACS Integration (release-250213)**
- Pełna integracja z systemem kontroli dostępu Roger RACS-5
- Backend: 6 nowych tabel, RACS SOAP client, sync service, 11 API endpoints
- Frontend: Attendance dashboard (2 tryby: summary/records), Schedules dashboard (3 widoki)
- Mock RACS server dla development z 13 rzeczywistymi użytkownikami MOSiR i ~900 eventami
- Pliki:
  - `SQL/migration-attendance-schedules.sql` — główna migracja
  - `SQL/fix-rls-attendance.sql` — fix RLS
  - `lib/racs-client.ts`, `lib/racs-sync.ts` — backend
  - `app/dashboard/attendance/page.tsx` — UI
  - `app/dashboard/schedules/page.tsx` — rozbudowany
  - `scripts/mock-racs-server.js` — mock server
  - `docs/racs-integration-setup.md` — dokumentacja setup
  - `docs/roger-racs5-integration.md` — główna dokumentacja
