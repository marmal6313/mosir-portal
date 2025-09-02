# Plan: MOSiR Portal — Deploy i Release

Krótko: przewidywalne wydania (poniedziałek) i bezpieczny deploy za Cloudflare Tunnel, w jednej sieci z Traefikiem n8n (`n8n-compose_default`).

## Stan
- Repo: `main` gotowe; CI (lint/build), CD (tag → GHCR → deploy → smoke test).
- Infrastrukturа: 1 serwer, Docker; Cloudflare Tunnel z public hostnames.
- Domena: `app.e-mosir.pl` (CF proxy) + opcjonalnie `n8n.e-mosir.pl`.
- Sentry: usunięte.

## Build/Runtime
- Next.js 15, Supabase (App Router `createServerComponentClient`).
- API: `upload/files` z walidacją roli i proxy headers (`cf-connecting-ip` / `x-forwarded-for`).
- Lint: `eslint.ignoreDuringBuilds` tymczasowo włączone na prod build.

## Release rytm
- Poniedziałek: tag `release-YYYYMMDD` z `main` → GHCR build → ręczny approve (environ. `production`) → deploy → smoke test `/api/health`.
- Rollback: deploy poprzedniego taga.

## TODO (P0–P2)
- P0 (teraz):
  - [x] Uruchomić app (app-only) w sieci `n8n-compose_default`.
  - [x] Cloudflare Tunnel działa; `/api/health` = 200.
  - [x] Smoke test w CD po deploy.
- P1 (do pierwszego poniedziałku):
  - [ ] Build obrazu do GHCR z `main` (tag `staging`).
  - [ ] Ustawić GHCR package na Public (lub dodać login).
  - [ ] Przełączyć serwer na compose pull (`deploy/docker-compose.app.yml`).
  - [ ] Uptime check + podstawowe logi (docker logs / rotating).
  - [ ] README DEPLOY dla serwera.
- P2 (po pierwszym releasie):
  - [ ] Hardening obrazu: multi-stage, `USER node`, read-only FS, limity.
  - [ ] Metryki/health Traefika, proste alerty.
  - [ ] Upordządkować ESLint/TS i wyłączyć bypass.
  - [ ] (Opcja) Staging auto-deploy z `main`, prod po approve.

## Operacyjne skróty
- Sieć proxy: `TRAefik_NETWORK=n8n-compose_default`.
- Start (build lokalny):
  - `export TRAEFIK_NETWORK=n8n-compose_default`
  - `docker compose -f deploy/docker-compose.app-build.yml --env-file deploy/.env up -d --build`
- Po GHCR:
  - `docker compose -f deploy/docker-compose.app.yml --env-file deploy/.env up -d`
- Health: `curl -I https://app.e-mosir.pl/api/health` → 200.

## Ryzyka
- DNS override na serwerze (`/etc/hosts`) — usuwać wpisy dla `app.e-mosir.pl`.
- Prywatny GHCR wymaga `docker login` (sekrety lub public visibility).

