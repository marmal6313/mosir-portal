# Worklog

## 2025-09-02
- Uruchomiono pełny stack w Dockerze (Traefik + app + n8n), dodano public hostnames w CF dla `app.e-mosir.pl` i `n8n.e-mosir.pl` (przez Tunnel) — wariant legacy, obecnie zastąpiony przez k3s.
- `/api/health` = 200. CD: build → GHCR, Tailscale → SSH deploy, smoke test.
- Przygotowano plan i DEPLOY guide w repo (później zaktualizowane pod k3s).

Następne: build `staging` do GHCR i przełączenie compose na pull.
