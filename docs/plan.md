# Plan: MOSiR Portal — Deploy i Release

Krótko: przewidywalne wydania (poniedziałek) i bezpieczny deploy za wspólnym Traefikiem (`traefik-proxy`), opcjonalnie Cloudflare Tunnel.

## Stan
- Repo: `main` gotowe; CI (lint/build), CD (tag → GHCR → deploy do k3s → smoke test).
- Infrastrukturа: klaster k3s (namespace `apps`) z Traefikiem, cert-managerem (`cloudflare-dns`) i Cloudflare Tunnel (`k8s/cloudflared.yaml`) z public hostnames.
- Domena: `app.e-mosir.pl` (CF proxy/tunnel) + `n8n.e-mosir.pl` + `dot.e-mosir.pl`.
- Sentry: usunięte.

## Build/Runtime
- Next.js 15, Supabase (App Router `createServerComponentClient`).
- API: `upload/files` z walidacją roli i proxy headers (`cf-connecting-ip` / `x-forwarded-for`).
- Lint: `eslint.ignoreDuringBuilds` tymczasowo włączone na prod build.

## Release rytm
- Poniedziałek: tag `release-YYYYMMDD` z `main` → GHCR build → ręczny approve (environ. `production`) → deploy → smoke test `/api/health`.
- Rollback: deploy poprzedniego taga.

## Zrealizowane
- [x] Uruchomić pełny stack (Traefik + app) w sieci `traefik-proxy`.
- [x] Smoke test w CD po deploy.
- [x] Migracja produkcji z Docker Compose na k3s (namespace `apps`, manifesty `k8s/app`).
- [x] Cloudflare Tunnel jako Deployment w k3s (`k8s/cloudflared.yaml`).
- [x] **Multi-department** — użytkownicy mogą być przypisani do wielu działów (`user_departments` junction table, RLS, widok, API, UI). Release `release-250212`.
- [x] Manifesty K3s w repo (`k8s/app/deployment.yaml`, `service.yaml`, `ingress.yaml`).
- [x] Supabase keep-alive (`lib/supabase-keep-alive.ts`).

## TODO (P1–P2)
- P1 (bieżące):
  - [ ] Zaktualizować pipeline CD, aby automatycznie deploiło na k3s (zamiast Docker Compose SSH).
  - [ ] Build obrazu do GHCR z `main` (tag `staging`).
  - [ ] Ustawić GHCR package na Public (lub dodać login).
  - [ ] Uptime check + podstawowe logi (kubectl logs / Loki).
  - [ ] Testy E2E dla multi-department (Playwright / Cypress).
- P2 (po stabilizacji):
  - [ ] Hardening obrazu: multi-stage, `USER node`, read-only FS, limity.
  - [ ] Metryki/health Traefika, proste alerty.
  - [ ] Upordządkować ESLint/TS i wyłączyć bypass (`eslint.ignoreDuringBuilds`).
  - [ ] (Opcja) Staging auto-deploy z `main`, prod po approve.
  - [ ] Rozszerzenie `permissions.ts` / `usePermissions.ts` o multi-department scope.

## Operacyjne skróty
- Klaster: k3s, kubeconfig z `/etc/rancher/k3s/k3s.yaml` (sekret `KUBECONFIG_B64` w CD).
- Deploy aplikacji: `kubectl apply -f k8s/app/` (Deployment/Service/Ingress `mosir-portal`).
- Deploy tunelu: `kubectl apply -f k8s/cloudflared.yaml` (secret `cloudflared-tunnel-token` z `TUNNEL_TOKEN`).
- Health: `curl -I https://app.e-mosir.pl/api/health` → 200.

## Ryzyka
- DNS override na serwerze (`/etc/hosts`) — usuwać wpisy dla `app.e-mosir.pl`.
- Prywatny GHCR wymaga `docker login` (sekrety lub public visibility).
