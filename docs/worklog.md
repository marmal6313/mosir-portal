# Worklog

## 2025-09-02
- Uruchomiono pełny stack (Traefik + app), dodano public hostnames w CF dla `app.e-mosir.pl` i `n8n.e-mosir.pl` (opcjonalnie przez Tunnel).
- `/api/health` = 200. CD: build → GHCR, Tailscale → SSH deploy, smoke test.
- Przygotowano plan i DEPLOY guide w repo.

Następne: build `staging` do GHCR i przełączenie compose na pull.
