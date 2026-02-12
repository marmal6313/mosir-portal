# ADR 0001: Public ingress przez Cloudflare Tunnel

Kontext: początkowo jedna maszyna, wspólny Traefik z aplikacją i n8n (Docker), potrzeba bezpiecznego public ingress. Obecnie ruch obsługuje klaster k3s (namespace `apps`) z Traefikiem i tunel Cloudflare uruchomiony jako Deployment (`k8s/cloudflared.yaml`), ale decyzja o użyciu tunelu pozostaje aktualna.

Decyzja:
- Używamy Cloudflare Tunnel z public hostnames:
  - pierwotnie (legacy Docker):
    - `app.e-mosir.pl` → `http://mosir-portal-app:3000`
    - `n8n.e-mosir.pl` → `http://n8n:5678`
  - obecnie (k3s):
    - `app.e-mosir.pl` → `http://mosir-portal.apps.svc.cluster.local:80`
    - `n8n.e-mosir.pl` → `http://n8n.apps.svc.cluster.local:5678`
    - `dot.e-mosir.pl` → `http://dotacje-app.apps.svc.cluster.local:3000`
- Brak konieczności wystawiania publicznych portów na nodach; TLS/route zapewnia Cloudflare (lub Traefik + cert-manager w wariancie A/AAAA).

Uzasadnienie:
- Zmienny publiczny IP serwera, brak chęci wystawiania portu 22/80/443.
- Proste DNS i automatyczny cert od Cloudflare.

Konsekwencje:
- Runner CD dołącza do Tailscale, SSH po 100.x.x.x (sekret `TS_AUTHKEY`).
- Rekordy DNS muszą wskazywać CF proxy; lokalne `/etc/hosts` nie może nadpisywać domen.
