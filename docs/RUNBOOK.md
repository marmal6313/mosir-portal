---
id: runbook
title: Runbook produkcji (MOSiR Portal)
sidebar_position: 10
---

Ten runbook opisuje architekturę, cotygodniowe wydania, diagnostykę i recovery. Napisany tak, aby człowiek i asystent AI mogli go wykonać krok‑po‑kroku.

> Główne środowisko produkcyjne: klaster k3s (namespace `apps`).
> Manifesty: `k8s/app/`, tunel: `k8s/cloudflared.yaml`.
> Legacy Docker Compose (`deploy/`) — tylko fallback / testy.

## Architektura
- **K3s cluster**, namespace `apps`:
  - Deployment `mosir-portal` (Next.js, obraz z GHCR)
  - Service `mosir-portal` (ClusterIP, port 80 → 3000)
  - Ingress `mosir-portal` (Traefik, `ingressClassName: traefik`)
  - Deployment `cloudflared` (Cloudflare Tunnel)
- **Cloudflare Tunnel** — public hostnames:
  - `app.e-mosir.pl` → `http://mosir-portal.apps.svc.cluster.local:80`
  - `n8n.e-mosir.pl` → `http://n8n.apps.svc.cluster.local:5678`
  - `dot.e-mosir.pl` → `http://dotacje-app.apps.svc.cluster.local:3000`
- **Supabase** (managed) — PostgreSQL, Auth, Storage, RLS.
- **CI/CD**: GitHub Actions → GHCR → ręczny `kubectl set image` na k3s.
- **VPN**: Tailscale (SSH do nodów po 100.x / MagicDNS).

## Kluczowe pliki
| Plik | Opis |
|---|---|
| `k8s/app/deployment.yaml` | Deployment `mosir-portal` |
| `k8s/app/service.yaml` | Service (ClusterIP, 80 → 3000) |
| `k8s/app/ingress.yaml` | Ingress (Traefik, TLS) |
| `k8s/cloudflared.yaml` | Cloudflare Tunnel Deployment |
| `.github/workflows/cd.yml` | Pipeline CD (build GHCR + legacy Docker deploy) |
| `SQL/migration-*.sql` | Migracje bazy danych (Supabase) |
| `SQL/verify-*.sql` | Skrypty weryfikacyjne migracji |
| `deploy/` | Legacy Docker Compose stack (fallback) |

## Sekrety

### GitHub → Environments → production
- SSH/ścieżka: `SSH_HOST`, `SSH_USER`, `SSH_KEY`, `APP_PATH`
- App: `APP_HOSTNAME=app.e-mosir.pl`, `TRAEFIK_NETWORK=traefik-proxy`
- Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Tunnel: `CLOUDFLARE_TUNNEL_TOKEN`
- Tailscale: `TS_OAUTH_CLIENT_ID`, `TS_OAUTH_CLIENT_SECRET`, `TS_TAGS`

### K3s (namespace `apps`)
- `mosir-portal-env` (secret):
  - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
  - `ALLOWED_IMAGE_HOSTS`, `NEXT_TELEMETRY_DISABLED=1`
- `cloudflared-tunnel-token` (secret):
  - `TUNNEL_TOKEN`

## Cotygodniowe wydanie (K3s)
1. Merge zmian do `main`.
2. Utwórz i wypchnij tag:
   ```bash
   git tag release-YYMMDD && git push origin release-YYMMDD
   ```
3. GitHub Actions (`CD`) buduje obraz i pushuje do GHCR.
   - Job `deploy` (SSH/Docker Compose) może failować — oczekiwane, produkcja na k3s.
4. Zastosuj nowy obraz na klastrze:
   ```bash
   kubectl set image deployment/mosir-portal \
     mosir-portal=ghcr.io/marmal6313/mosir-portal:release-YYMMDD -n apps
   kubectl rollout status deployment/mosir-portal -n apps --timeout=180s
   ```
5. Zaktualizuj tag w `k8s/app/deployment.yaml`, commitnij i pushuj.
6. Smoke test:
   ```bash
   curl -I https://app.e-mosir.pl/api/health  # → 200
   kubectl get pods -n apps -l app=mosir-portal  # → Running, 1/1 Ready
   ```

## Rollback (K3s)
```bash
kubectl rollout undo deployment/mosir-portal -n apps
# lub konkretna wersja:
kubectl set image deployment/mosir-portal \
  mosir-portal=ghcr.io/marmal6313/mosir-portal:<previous-tag> -n apps
```

## Ręczny deploy (legacy Docker Compose)
```bash
cd /opt/mosir-portal
IMAGE_REF=ghcr.io/marmal6313/mosir-portal:release-YYMMDD bash scripts/deploy.sh
```

## Migracje SQL (Supabase)
Migracje uruchamiane ręcznie w Supabase SQL Editor **przed** deployem nowej wersji aplikacji.

| Migracja | Weryfikacja | Opis | Data |
|---|---|---|---|
| `SQL/migration-user-departments.sql` | `SQL/verify-user-departments-migration.sql` | Multi-department: tabela `user_departments`, RLS, widok, funkcja | 2026-02-12 |

Procedura:
1. Otwórz Supabase Dashboard → SQL Editor.
2. Wklej treść pliku migracji i wykonaj.
3. Wklej treść pliku weryfikacyjnego i sprawdź wyniki (wszystkie `OK`).
4. Dopiero potem wdróż nową wersję aplikacji.

## Szybka diagnostyka (K3s)
```bash
# Status podów
kubectl get pods -n apps -o wide

# Logi aplikacji
kubectl logs deployment/mosir-portal -n apps --tail=200

# Logi cloudflared
kubectl logs deployment/cloudflared -n apps --tail=200

# Health check (produkcja)
curl -I https://app.e-mosir.pl/api/health

# Health check (wewnątrz klastra)
kubectl exec deployment/mosir-portal -n apps -- curl -sS http://localhost:3000/api/health

# Opis deploymentu (events, image, replicas)
kubectl describe deployment/mosir-portal -n apps

# Status ingress
kubectl get ingress -n apps

# DNS / Flannel / kube-proxy
kubectl get pods -n kube-system
kubectl get pods -n kube-flannel
```

## Szybka diagnostyka (legacy Docker)
```bash
docker ps --format '{{.Names}}\t{{.Ports}}'
docker logs traefik --tail=200
docker logs cloudflared --tail=200
```

## Typowe błędy i naprawy

### 502 Bad Gateway (app.e-mosir.pl)
**K3s — sieć overlay (Flannel):**
- Sprawdź status Flannel: `kubectl get pods -n kube-flannel`
- Jeśli pody w `CrashLoopBackOff` lub `Error`, restart:
  ```bash
  kubectl delete pods -n kube-flannel -l app=flannel
  kubectl delete pods -n kube-system -l k8s-app=kube-proxy
  ```
- Sprawdź, czy node `NotReady`: `kubectl get nodes`
- Restart cloudflared: `kubectl rollout restart deployment/cloudflared -n apps`

**K3s — pod nie startuje:**
- `kubectl describe pod <pod-name> -n apps` → szukaj Events
- `kubectl logs <pod-name> -n apps` → szukaj błędów runtime
- Typowo: brak secretu, zły image tag, OOM

**Legacy Docker:**
- Tunnel nie działa / brak hosta: sprawdź token i Public Hostname w CF Dashboard.
- n8n nie w `traefik-proxy`: `docker network connect traefik-proxy <n8n-container>`.

### 530 w CD
- CNAME → Tunnel, ale tunel offline lub brak hostname — uruchom cloudflared, dodaj Public Hostname.

### Konflikt portów 80/443
- Stary Traefik/nginx — zatrzymaj stary stack: `docker compose down`.

### Git "dubious ownership"
```bash
git config --global --add safe.directory /opt/mosir-portal
```

## Recovery po restarcie serwera (K3s)
K3s restartuje się automatycznie po rebootcie. Sprawdź:
```bash
kubectl get nodes       # wszystkie Ready?
kubectl get pods -n apps  # wszystkie Running?
```
Jeśli pody nie wstają:
```bash
sudo systemctl restart k3s        # na master node
sudo systemctl restart k3s-agent  # na worker nodes
```

## Recovery po restarcie serwera (legacy Docker)
1. `cd /opt/mosir-portal && bash scripts/deploy.sh`
2. `docker compose -f deploy/cloudflared.yml --env-file deploy/.env up -d`

## Checklist "OK" po deployu
- [ ] `curl -I https://app.e-mosir.pl/api/health` → 200
- [ ] `curl -I https://n8n.e-mosir.pl` → 200/301
- [ ] `kubectl get pods -n apps -l app=mosir-portal` → Running, 1/1 Ready
- [ ] `kubectl logs deployment/mosir-portal -n apps --tail=10` → brak błędów
- [ ] `kubectl logs deployment/cloudflared -n apps --tail=10` → "Registered" / connected

## Historia release'ów
| Tag | Data | Opis |
|---|---|---|
| `release-250212` | 2026-02-12 | Multi-department, infra fixes, Flannel recovery |
| `release-20251124` | 2025-11-24 | Poprzedni stabilny release |
