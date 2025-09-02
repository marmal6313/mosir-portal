# Worklog

## 2025-09-02
- Uruchomiono Cloudflare Tunnel, dodano public hostnames dla `app.e-mosir.pl` i `n8n.e-mosir.pl`.
- Start aplikacji (app-only) w sieci `n8n-compose_default`; `/api/health` = 200.
- Dodano CD: build → GHCR, Tailscale → SSH deploy, smoke test.
- Przygotowano plan i DEPLOY guide w repo.

Następne: build `staging` do GHCR i przełączenie compose na pull.

