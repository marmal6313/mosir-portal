**Cel**
- Stabilna produkcja, wygodny rozwój, cotygodniowe wydania w poniedziałek, obserwowalność i proste roll‑backi.

**Architektura**
- **Aplikacja**: Next.js w Docker (już gotowe: `Dockerfile`).
- **Rejestr obrazów**: GHCR (`ghcr.io/marmal6313/mosir-portal`).
- **Serwer**: 1 VM (Docker) z `deploy/docker-compose.prod.yml` (Traefik + app).
- **TLS/Proxy**: Traefik + Let’s Encrypt (DNS‑01 z Cloudflare, wspiera “pomarańczową chmurkę”).
- **Monitoring/errory**: healthcheck `GET /api/health`.
- **DB/Backend**: Supabase (zarządzane) — zmienne środowiskowe.

**Środowiska i release**
- **main**: stabilny kod. Tag `release-YYYYMMDD` — produkcja.
- **PR/feature**: CI (lint, build).
- **Staging (opcjonalnie)**: push do `main` buduje obraz `:staging` i wdraża na `staging` host.

**Sekwencja wdrożenia**
1) Merge do `main` w tygodniu.
2) W poniedziałek workflow tworzy tag `release-YYYYMMDD` → build i push obrazu.
3) Job `deploy` (z akceptacją environments/production) łączy się przez SSH i wykonuje `scripts/deploy.sh` na serwerze.
4) Rollback: wybierz poprzedni tag i ponownie uruchom `deploy` z tym tagiem.

**Konfiguracja GitHub**
- Ustaw sekrety repo:
  - `GHCR_PAT` (opcjonalnie, zwykle wystarczy `GITHUB_TOKEN` z uprawnieniami packages:write)
  - `SSH_HOST`, `SSH_USER`, `SSH_KEY` (private key), `SSH_KNOWN_HOSTS`, `APP_PATH` (np. `/opt/mosir-portal`)
- `APP_HOSTNAME` (np. `app.e-mosir.pl`) — można też trzymać na serwerze w `.env`
- W Settings → Environments dodaj `production` i włącz manualne approvals.

**Serwer produkcyjny**
1) Zainstaluj Docker + plugin compose.
2) Na serwerze: `sudo mkdir -p /opt/mosir-portal && sudo chown -R $USER: /opt/mosir-portal`
3) Skopiuj (pierwszy raz): katalog `deploy/` i `scripts/deploy.sh` do `/opt/mosir-portal`.
4) Utwórz plik env w katalogu `deploy` na serwerze:
   - `cp deploy/.env.example deploy/.env` i uzupełnij wartości
   - Lokalizacja finalna: `/opt/mosir-portal/deploy/.env`
   - `APP_HOSTNAME=app.e-mosir.pl`
   - `IMAGE_REF=ghcr.io/marmal6313/mosir-portal:release-YYYYMMDD` (lub podaj tag przy deployu)
   - `NEXT_PUBLIC_SUPABASE_URL=...`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY=...`
   - `SUPABASE_SERVICE_ROLE_KEY=...`
   - `LETSENCRYPT_EMAIL=admin@e-mosir.pl`
   - `CLOUDFLARE_API_TOKEN=<token_z_CF>` (DNS‑01; patrz sekcja “Cloudflare proxy”)
5) Pierwsze uruchomienie (ręcznie na serwerze): `bash scripts/deploy.sh`.

**Cotygodniowy release**
- Workflow `.github/workflows/release-weekly.yml` tworzy tag `release-YYYYMMDD` w poniedziałek 06:00 UTC → startuje build/push → environment `production` wymaga zatwierdzenia, po czym robi SSH deploy.

 

**Rollback**
- Uruchom deploy z wcześniejszym tagiem: `IMAGE_TAG=release-YYYYMMDD bash scripts/deploy.sh`.

**Cloudflare proxy (pomarańczowa chmurka)**
- W Cloudflare ustaw rekord `app.e-mosir.pl` na “Proxied”.
- Utwórz token API tylko dla strefy `e-mosir.pl` z uprawnieniami: `Zone → DNS → Edit` (plus `Zone → Zone → Read`).
- W `deploy/.env` ustaw `CLOUDFLARE_API_TOKEN=...`.
- Traefik jest już skonfigurowany na Let’s Encrypt DNS‑01 (nie wymaga otwartego 80 dla ACME).
- W panelu Cloudflare włącz “SSL/TLS → Full (strict)”.

**Wspólna sieć reverse proxy**
- Używamy zewnętrznej sieci Docker `traefik-proxy`, aby podpiąć inne usługi (np. n8n) bez koegzystencji w tym samym compose.
- Jednorazowo na serwerze: `docker network create traefik-proxy` (skrypt deploy tworzy ją automatycznie, jeśli brak).
- Traefik i aplikacja łączą się do `traefik-proxy` (zdefiniowane w `deploy/docker-compose.prod.yml`).

**Reverse proxy (Traefik)**
- Domyślnie uruchamiamy własny Traefik z `deploy/docker-compose.prod.yml` (TLS przez Let’s Encrypt DNS‑01 + Cloudflare).
- Inne usługi (np. n8n) dołącz do sieci `traefik-proxy` i skonfiguruj etykiety Traefika (patrz sekcja n8n niżej).
- Wariant „app‑only” (z Twoim Traefikiem) jest opcjonalny/zaawansowany i nie jest rekomendowany jako default.

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
