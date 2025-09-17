# NEXT — najbliższe kroki

1) GHCR build z `main` (tag `staging`)
- Actions → “Build and Push Docker Image” → Run workflow → `tag: staging`.
- Repo → Packages → `mosir-portal` → Change visibility → Public (na start).

2) Przełączenie serwera na pull-based (Traefik + app)
- `cd /opt/mosir-portal && bash scripts/deploy.sh`
- `curl -I https://app.e-mosir.pl/api/health` → 200.

3) CD na tagu release-YYYYMMDD
- Settings → Environments → `production`: dodaj `SSH_HOST`, `SSH_KEY`, `APP_PATH`, `TS_AUTHKEY`.
- Actions → “CD” → Run workflow → `tag: release-YYYYMMDD` → obserwuj smoke test.

4) Uptime + logi
- Dodaj zewnętrzny check (np. BetterStack) do `https://app.e-mosir.pl/api/health`.
- Rotacja logów i szybkie `docker logs mosir-portal-app` w runbooku.
