# DEPLOY — serwer produkcyjny

Wymagania:
- Docker + docker compose
- Sieć proxy: `n8n-compose_default` (ta sama co n8n/Traefik)
- Plik `deploy/.env` uzupełniony (Supabase, `APP_HOSTNAME`, `ALLOWED_IMAGE_HOSTS`, `CLOUDFLARE_TUNNEL_TOKEN`)

Jednorazowo:
- Użytkownik: `deploy` w grupie `docker`
- Klucz SSH w `/home/deploy/.ssh/authorized_keys`
- Katalog: `sudo mkdir -p /opt/mosir-portal && sudo chown -R deploy:deploy /opt/mosir-portal`

Start (build lokalny — tylko pierwszy raz):
- `export TRAEFIK_NETWORK=n8n-compose_default`
- `docker compose -f deploy/docker-compose.app-build.yml --env-file deploy/.env up -d --build`

Start (pull z GHCR — docelowo):
- `export TRAEFIK_NETWORK=n8n-compose_default`
- `docker compose -f deploy/docker-compose.app.yml --env-file deploy/.env up -d`

Cloudflare Tunnel:
- `docker compose -f deploy/cloudflared.yml --env-file deploy/.env up -d`
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

