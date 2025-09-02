# ADR 0001: Public ingress przez Cloudflare Tunnel

Kontext: jedna maszyna, istniejący Traefik (n8n) i potrzeba bezpiecznego public ingress.

Decyzja:
- Używamy Cloudflare Tunnel z public hostnames:
  - `app.e-mosir.pl` → `http://mosir-portal-app:3000`
  - `n8n.e-mosir.pl` → `http://n8n-compose-n8n-1:5678`
- Aplikacja pracuje w tej samej sieci Dockera co n8n (`n8n-compose_default`).
- Brak publicznych portów na serwerze; TLS/route zapewnia Cloudflare.

Uzasadnienie:
- Zmienny publiczny IP serwera, brak chęci wystawiania portu 22/80/443.
- Proste DNS i automatyczny cert od Cloudflare.

Konsekwencje:
- Runner CD dołącza do Tailscale, SSH po 100.x.x.x (sekret `TS_AUTHKEY`).
- Rekordy DNS muszą wskazywać CF proxy; lokalne `/etc/hosts` nie może nadpisywać domen.

