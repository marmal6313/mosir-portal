# DEPLOY — serwer produkcyjny

Wymagania:
- Docker + docker compose
- Wspólna sieć proxy: `traefik-proxy` (tworzona automatycznie przez skrypt deploy)
- Plik `deploy/.env` uzupełniony (Supabase, `APP_HOSTNAME`, `LETSENCRYPT_EMAIL`, `CLOUDFLARE_API_TOKEN`, opcjonalnie `CLOUDFLARE_TUNNEL_TOKEN`)
- Jeśli chcesz, aby tunel Cloudflare startował automatycznie, ustaw `COMPOSE_PROFILES=cloudflare` (domyślne w `.env.example`)

Jednorazowo:
- Użytkownik: `deploy` w grupie `docker`
- Klucz SSH w `/home/deploy/.ssh/authorized_keys`
- Katalog: `sudo mkdir -p /opt/mosir-portal && sudo chown -R deploy:deploy /opt/mosir-portal`

Start (build lokalny — tylko pierwszy raz, opcjonalnie):
- `docker compose -f deploy/docker-compose.app-build.yml --env-file deploy/.env up -d --build`

Start (pull z GHCR — docelowo, z Traefikiem + tunel przy włączonym profilu):
- `docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env up -d`

Alternatywa (rekomendowana w CI/CD):
- `bash scripts/deploy.sh` (uruchomi Traefik + app, i opcjonalnie n8n)

Cloudflare Tunnel (opcjonalnie / gdy potrzebujesz ręcznego startu):
- Przy aktywnym profilu (`COMPOSE_PROFILES=cloudflare`) kontener `cloudflared` uruchomi się razem z `docker-compose.prod.yml`.
- Jeśli chcesz wystartować ręcznie (np. w trybie `app-only`), użyj `docker compose -f deploy/cloudflared.yml --env-file deploy/.env up -d`
- Logi: `docker logs -f cloudflared` (szukaj `Connected/Registered`)

Health:
- `docker exec mosir-portal-app curl -s http://localhost:3000/api/health`
- `curl -I https://app.e-mosir.pl/api/health` → 200

CD (GitHub Actions):
- Environ `production`: `SSH_HOST` (Tailscale 100.x), `SSH_KEY`, `APP_PATH`, `TS_AUTHKEY`
- Actions → `CD` → `Run workflow` → `tag: release-YYYYMMDD`

Troubleshooting:
- `/etc/hosts` nie może zawierać `app.e-mosir.pl` → `127.0.0.1`
- GHCR prywatny wymaga `docker login ghcr.io` (PAT `read:packages`) – do dodania w skrypcie na życzenie
