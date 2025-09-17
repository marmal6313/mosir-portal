# Proces tygodniowego, ręcznego wydania (CD)

> Ostatnia aktualizacja: 2025-09-04 — autor: dell2

Ten dokument opisuje, jak raz w tygodniu ręcznie wypchnąć poprawki na środowisko produkcyjne, korzystając z workflow `CD` w GitHub Actions. Zawiera też checklistę przed i po wdrożeniu oraz procedurę szybkiego rollbacku.

## Wymagania wstępne
- GitHub → Environments → `production` → Secrets skonfigurowane:
  - `SSH_HOST`, `SSH_USER`, `SSH_KEY` (+ opcjonalnie `SSH_KEY_PASSPHRASE`), `SSH_PORT` (jeśli niestandardowy)
  - `APP_PATH` – katalog na serwerze, gdzie klonuje się repo i uruchamiany jest deploy
  - `APP_HOSTNAME` – publiczny host aplikacji (np. `app.e-mosir.pl`)
  - `DEPLOY_MODE` – `prod` (Traefik + certyfikaty DNS-01); tryb `app-only` tylko w zaawansowanych scenariuszach
  - `TRAEFIK_NETWORK` – nazwa zewnętrznej sieci reverse proxy (domyślnie `traefik-proxy`)
  - `CLOUDFLARE_TUNNEL_TOKEN` – jeżeli używamy cloudflared (opcjonalnie)
  - `CLOUDFLARE_API_TOKEN`, `LETSENCRYPT_EMAIL` – jeżeli używamy trybu `prod` z Traefikiem i DNS-01
  - Tailscale (jeden z wariantów):
    - `TS_OAUTH_CLIENT_ID`, `TS_OAUTH_CLIENT_SECRET` (+ opcjonalnie `TS_TAGS`), lub
    - `TS_AUTHKEY` (+ opcjonalnie `TS_TAGS`)
- Serwer docelowy ma zainstalowane:
  - Docker + (Docker Compose plugin lub `docker-compose` v1)
  - Ewentualnie istniejącą sieć docker o nazwie zgodnej z `TRAEFIK_NETWORK` (tworzona automatycznie, jeśli brak)
- Aplikacja ma skonfigurowane zmienne build-time (w repo ustawione w CI):
  - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Co robi pipeline `CD`
- Buduje obraz Dockera i publikuje do `ghcr.io/<owner>/<repo>:<TAG>`
- Łączy się z serwerem przez Tailscale/SSH
- Przygotowuje `.env` (dopisywanie wartości – ostatnie wystąpienie wygrywa)
- Klonuje/odświeża repo w `APP_PATH`
- Uruchamia `scripts/deploy.sh` z `IMAGE_REF` wskazującym świeży obraz
- Wykonuje smoke test pod `https://$APP_HOSTNAME/api/health`

## Nazewnictwo tagów wydania
- Zalecany format: `release-YYYYMMDD` (np. `release-20250101`)
- Tag jest używany jako tag obrazu w GHCR i w logach wdrożenia

## Jak wykonać tygodniowe wydanie
1) Przygotowanie zmian (konkretne komendy)

Code review zrób standardowo (GitHub). Poniżej komendy do lokalnego sprawdzenia PR i zmergowania po weryfikacji.

Opcja A — GitHub CLI (najprostsza):
```bash
# 1) Pobierz PR do lokalnego repo i przełącz się na niego
gh pr checkout <NR_PR>

# 2) Lokalne smoke testy (patrz sekcja poniżej)

# 3) Zmerguj PR do main (squash merge) i usuń branch
gh pr merge <NR_PR> --squash --delete-branch

# 4) Zsynchronizuj lokalny main
git checkout main && git pull --ff-only origin main
```

Opcja B — czysty Git (bez `gh`):
```bash
# 1) Jeżeli znasz nazwę gałęzi PR w tym repo:
git fetch origin
git switch -c <branch> origin/<branch>

# (lub gdy masz tylko numer PR, GitHub-style):
git fetch origin pull/<NR_PR>/head:pr-<NR_PR>
git switch pr-<NR_PR>

# 2) Lokalne smoke testy (patrz sekcja poniżej)

# 3) Włącz główną gałąź i zaktualizuj
git switch main
git pull --ff-only origin main

# 4) Wykonaj merge (merge commit) i wypchnij
git merge --no-ff <branch>
git push origin main

# Uwaga: powyższe zamknie PR, jeśli commit(y) PR trafią na main.
# Jeżeli używacie wyłącznie Merge'owania przez UI — wykonaj merge w UI, a lokalnie zrób tylko sync main.
```

Lokalny smoke test — Opcja 1 (Docker Compose, rekomendowane):
```bash
# W root repo przygotuj plik .env.local z niezbędnymi wartościami
cat > .env.local << 'EOF'
NEXT_PUBLIC_SUPABASE_URL=https://<twoj-projekt>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
# (opcjonalnie) SUPABASE_SERVICE_ROLE_KEY=<service-role>
EOF

# Zbuduj i uruchom kontener (mapuje port 3000)
docker compose up --build -d

# Healthcheck endpoint powinien zwrócić 200
curl -fsS -o /dev/null -w '%{http_code}\n' http://localhost:3000/api/health

# Podgląd logów (Ctrl+C aby wyjść)
docker logs -f mosir-portal-app

# Sprzątanie po testach (opcjonalnie)
docker compose down -v
```

Lokalny smoke test — Opcja 2 (Next.js lokalnie):
```bash
# Zależności
npm ci

# Plik .env.local (jak wyżej)
# NEXT_PUBLIC_SUPABASE_URL=...
# NEXT_PUBLIC_SUPABASE_ANON_KEY=...

# Build i run
npm run build
npm start &

# Healthcheck
curl -fsS -o /dev/null -w '%{http_code}\n' http://localhost:3000/api/health

# Zatrzymaj proces, gdy skończysz (np. kill %1)
```

2) Uruchomienie workflow `CD`
- Wejdź w GitHub → Actions → `CD`
- Kliknij `Run workflow`
- Wprowadź `tag`, np. `release-20250101`
- Uruchom i obserwuj logi: `Build and push` → `Deploy`

3) Monitoring i weryfikacja
- W kroku `Post-deploy diagnostics (server)` zweryfikuj:
  - `docker ps`, `docker compose ps` dla usługi `mosir-portal-app`
  - logi stacka i ewentualnie `cloudflared`/`traefik`
- Krok `Smoke test /api/health` powinien zwrócić HTTP 200

## Rollback (szybkie przywrócenie poprzedniej wersji)
- Najbezpieczniej wdrożyć istniejący obraz z GHCR (bez przebudowy kodu):

Opcja A — po tagu `sha-<commit>` (niezmienny):
```bash
# 1) Wejdź w GitHub → Packages → Container → mosir-portal → Tags
# 2) Skopiuj tag obrazu np. ghcr.io/<owner>/<repo>:sha-abcdef1
# 3) SSH na serwer i w APP_PATH:
cd "$APP_PATH"
export IMAGE_REF=ghcr.io/<owner>/<repo>:sha-abcdef1
export DEPLOY_MODE=prod
bash scripts/deploy.sh

# Weryfikacja
docker ps
curl -fsS -o /dev/null -w '%{http_code}\n' http://localhost:3000/api/health
```

Opcja B — po tagu wydania `release-YYYYMMDD` (jeśli nie został nadpisany):
```bash
cd "$APP_PATH"
export IMAGE_REF=ghcr.io/<owner>/<repo>:release-YYYYMMDD
export DEPLOY_MODE=prod
bash scripts/deploy.sh
```

Uwaga: nie uruchamiaj workflow `CD` z „poprzednim tagiem” w celu rollbacku — krok build nadpisze tag i zbuduje aktualny kod pod starym tagiem.

## Checklist przed wdrożeniem
- [ ] PR-y scalone do `main`
- [ ] Zaktualizowane migracje SQL (jeśli dotyczy)
- [ ] Zmiany UI przetestowane w staging/dev
- [ ] Sekrety `production` w GitHub są kompletne i aktualne
- [ ] Serwer dostępny przez Tailscale (krok „Verify Tailscale connectivity” w CI)

## Checklist po wdrożeniu
- [ ] `docker ps` pokazuje nowy kontener na serwerze
- [ ] `/api/health` = 200 (smoke test)
- [ ] Podstawowe ścieżki aplikacji działają (login, dashboard, widok zadań)
- [ ] Brak błędów w logach `app`/`traefik`/`cloudflared`

## Tryby wdrożenia
- `prod` (domyślny w CI):
  - Uruchamia Traefik + app, certyfikaty przez DNS-01 (Cloudflare)
  - Kompozycja: `deploy/docker-compose.prod.yml`
- `app-only` (zaawansowane/niestandardowe):
  - Zakłada istniejące proxy (Traefik poza stackiem) lub Cloudflare Tunnel bez Traefika
  - Kompozycja: `deploy/docker-compose.app.yml`

## Uwagi operacyjne
- Plik `.env` na serwerze dopisywany jest w trybie „append-only” – ostatnie wpisy wygrywają. Dla porządku warto okresowo porządkująco przepisać `.env` (usuwając duplikaty kluczy) poza oknem wdrożeniowym.
- `scripts/deploy.sh` automatycznie wykrywa dostępność `docker compose` lub `docker-compose`.
- Dla stałej powtarzalności taguj każde wydanie (`release-YYYYMMDD`), nawet jeśli w tygodniu jest tylko jedna poprawka.

## Praca nad poprawkami (flow dla devów)
- Gałęzie: `fix/<krótki-opis>` lub `feat/<krótki-opis>`
- Commity: zwięzłe komunikaty, powiązanie z issue jeśli dotyczy
- PR: opis zmian + checklista testowa + screenshoty UI
- Po merge do `main`: albo czekamy na okno tygodniowe, albo (w razie pilnej poprawki) uruchamiamy `CD` z tagiem `release-YYYYMMDD-hotfix`

---
Jeśli potrzebujesz, aby wdrażanie obejmowało dodatkowe kroki (migracje bazy, seedy, warm-up cache), dodaj je w `scripts/deploy.sh` lub przygotuj osobny krok w `cd.yml` przed „Deploy over SSH”.
