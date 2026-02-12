**Cel**
- Stabilna produkcja, wygodny rozwój, cotygodniowe wydania w poniedziałek, obserwowalność i proste roll‑backi.

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
2) W poniedziałek workflow tworzy tag `release-YYYYMMDD` → build i push obrazu.
3) Job `deploy` (z akceptacją environments/production) używa `kubectl apply -f k8s/app/` (oraz `k8s/cloudflared.yaml`) przeciwko klastrowi k3s (kubeconfig z sekreta).
4) Rollback: wybierz poprzedni tag, zbuduj obraz i ponownie zastosuj manifesty (podmień `image` w `k8s/app/deployment.yaml` lub użyj zmiennej/patch w CD).

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
