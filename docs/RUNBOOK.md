---
id: runbook
title: Runbook produkcji (MOSiR Portal)
sidebar_position: 10
---

Ten runbook opisuje architekturę, cotygodniowe wydania, diagnostykę i recovery. Napisany tak, aby człowiek i asystent AI mogli go wykonać krok‑po‑kroku.

> Uwaga: obecnie główne środowisko produkcyjne MOSiR Portal działa w klastrze k3s
> (namespace `apps`, Deployment/Service/Ingress `mosir-portal` opisane w `k8s/app` i
> `k8s/README.md`). Poniższa sekcja „Architektura” opisuje historyczny wariant single‑VM
> na Dockerze (Traefik + app + cloudflared). W praktyce:
> - do diagnostyki produkcji używaj głównie `kubectl` (`kubectl -n apps get deploy,svc,ingress`),
> - komendy `docker ...` dotyczą legacy‑stacka i ewentualnego fallbacku.

## Architektura
- Środowisko produkcyjne: klaster k3s, namespace `apps`, Traefik Ingress (`ingressClassName: traefik`), cert-manager (`ClusterIssuer cloudflare-dns`), manifesty w `k8s/app`.
- Reverse proxy (legacy): Traefik w Dockerze, wspólna sieć `traefik-proxy`.
- Aplikacja (legacy): `mosir-portal-app` (Next.js) za Traefikiem.
- Automatyzacje: `n8n` za Traefikiem (i przez Cloudflare Tunnel).
- Cloudflare Tunnel: kontener `cloudflared` z publicznymi hostami:
  - `app.e-mosir.pl` → (aktualnie) Traefik/k3s (`http://<IP noda k3s>:80`) lub historycznie `http://mosir-portal-app:3000`
  - `n8n.e-mosir.pl` → `http://n8n:5678`
- Dane n8n: wolumen Docker lub bind‑mount (konfigurowalne w `.env`).
- CI/CD (GitHub Actions, workflow `CD` na tag `release-YYYYMMDD`):
  - buduje obraz GHCR,
  - łączy po SSH,
  - uzupełnia `.env` w `APP_PATH`,
  - uruchamia `scripts/deploy.sh` (Traefik + app + n8n + cloudflared),
  - robi smoke testy (app i opcjonalnie n8n).

## Kluczowe pliki
- `k8s/app/deployment.yaml` — Deployment `mosir-portal` w namespace `apps`.
- `k8s/app/service.yaml` — Service `mosir-portal` (ClusterIP, port 80 → 3000).
- `k8s/app/ingress.yaml` — Ingress `mosir-portal` (Traefik, host `app.e-mosir.pl`, TLS `mosir-portal-tls`).
- `k8s/cloudflared.yaml` — Deployment `cloudflared` w `apps` (tunel Cloudflare → Service’y w klastrze).
- `deploy/docker-compose.prod.yml`, `deploy/docker-compose.n8n.yml`, `deploy/cloudflared.yml` — legacy stack Docker (Traefik + app + n8n + cloudflared) — obecnie tylko fallback / środowiska testowe.
- `deploy/.env` — konfiguracja legacy stacka (nie używana przez k3s).
- `.github/workflows/cd.yml` — pipeline CD (build do GHCR + deploy do k3s / ewentualne logi cloudflared).

## Sekrety (GitHub → Environments → production)
- SSH/ścieżka: `SSH_HOST`, `SSH_USER`, `SSH_KEY`, `APP_PATH` (np. `/opt/mosir-portal`).
- App/Traefik: `APP_HOSTNAME=app.e-mosir.pl`, `TRAEFIK_NETWORK=traefik-proxy`, `LETSENCRYPT_EMAIL`, `CLOUDFLARE_API_TOKEN` (DNS‑01).
- Tunnel: `CLOUDFLARE_TUNNEL_TOKEN`.
- n8n (opcjonalny smoketest): `N8N_HOSTNAME=n8n.e-mosir.pl`.

## Zmienne w k3s (sekrety / env)
- `mosir-portal-env` (secret w `apps` — Supabase, Sentry, CSP, itp.):
  - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
  - `ALLOWED_IMAGE_HOSTS`, `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `SENTRY_TRACES_SAMPLE_RATE`
  - `NEXT_TELEMETRY_DISABLED=1`
- `cloudflared-tunnel-token` (secret w `apps`):
  - `TUNNEL_TOKEN` — token Cloudflare Tunnel (tylko dla `k8s/cloudflared.yaml`).
  - Hostnames w samym tunelu: `app.e-mosir.pl`, `n8n.e-mosir.pl`, `dot.e-mosir.pl`.

## Cotygodniowe wydanie (CD)
1. Utwórz tag `release-YYYYMMDD` (workflow “Tag release-YYYYMMDD from main” lub ręcznie).
2. Actions → `CD` → Run workflow → `tag: release-YYYYMMDD`.
3. Po deploy:
   - `curl -I https://app.e-mosir.pl/api/health` → 200
   - `curl -I https://n8n.e-mosir.pl` → 200/301
   - `docker ps --format '{{.Names}}\t{{.Image}}' | grep mosir-portal-app` → obraz `:release-YYYYMMDD`.

## Ręczny deploy (natychmiastowy)
```bash
cd /opt/mosir-portal
IMAGE_REF=ghcr.io/marmal6313/mosir-portal:release-YYYYMMDD bash scripts/deploy.sh
```

## Szybka diagnostyka
- Kontenery/porty: `docker ps --format '{{.Names}}\t{{.Ports}}'`.
- Traefik: `docker logs traefik --tail=200 | grep -i -E 'router|certificate|mosir|n8n'`.
- Tunnel: `docker logs cloudflared --tail=200 | grep -i -E 'Registered|Updated to new configuration|error|hostname'`.
- App zewn.: `curl -I https://app.e-mosir.pl/api/health`.
- n8n w sieci Dockera: `docker run --rm --network traefik-proxy curlimages/curl:8.8.0 -sS -I http://n8n:5678`.
- n8n zewn.: `curl -I https://n8n.e-mosir.pl`.

## Typowe błędy i naprawy
- 530 w CD (app): CNAME → Tunnel, ale tunel nie działa/bez hosta.
  - Uruchom `cloudflared` (token), dodaj Public Hostname `app.e-mosir.pl` → `http://mosir-portal-app:3000`, restart tunelu.
- 502 dla n8n:
  - n8n nie działa / nie jest w `traefik-proxy`: `docker ps | grep -i n8n`.
  - Brak hosta w Tunnel: `n8n.e-mosir.pl` → `http://n8n:5678`.
  - Dane n8n: ustaw `N8N_DATA_EXTERNAL/N8N_DATA_VOLUME` lub `N8N_DATA_BIND` + `N8N_ENCRYPTION_KEY`.
- Konflikt portów 80/443: stary Traefik/nginx — zatrzymaj stary stack i uruchom `deploy.sh`.
- Git “dubious ownership”: jako `deploy` → `git config --global --add safe.directory /opt/mosir-portal`.

## Recovery po restarcie serwera
1. `cd /opt/mosir-portal && bash scripts/deploy.sh` (jako `deploy`).
2. `docker compose -f deploy/cloudflared.yml --env-file deploy/.env up -d`.
3. (Opcj.) zwiększ bufory UDP dla QUIC:
```bash
echo -e 'net.core.rmem_max=8388608\nnet.core.wmem_max=8388608\nnet.core.rmem_default=262144\nnet.core.wmem_default=262144\nnet.ipv4.udp_mem=262144 524288 1048576' | sudo tee /etc/sysctl.d/99-cloudflared-quic.conf
sudo sysctl --system
```
4. Aktualizacja cloudflared: `cd /opt/mosir-portal/deploy && docker compose -f cloudflared.yml pull && docker compose -f cloudflared.yml up -d`.

## Przywrócenie workflowów n8n (stary wolumen)
1. Znajdź stary wolumen, np. `n8n-compose_n8n_data`: `docker volume ls | grep -i n8n`.
2. W `/opt/mosir-portal/deploy/.env`:
   - `N8N_DATA_EXTERNAL=true`
   - `N8N_DATA_VOLUME=n8n-compose_n8n_data`
   - (jeśli używany) `N8N_ENCRYPTION_KEY=<ten sam>`
3. Start n8n: `docker compose -f docker-compose.n8n.yml --env-file ./.env up -d`.
4. Test: `docker run --rm --network traefik-proxy curlimages/curl:8.8.0 -sS -I http://n8n:5678`.

## Checklist “OK” po deployu
- `curl -I https://app.e-mosir.pl/api/health` → 200.
- `curl -I https://n8n.e-mosir.pl` → 200/301.
- `docker logs cloudflared --tail=50` — “Registered” i ingress dla obu hostów.
- `docker ps | grep -E 'traefik|mosir-portal-app|n8n|cloudflared'` — Running/Healthy.
