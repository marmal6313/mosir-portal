# MOSiR Portal — manifesty Kubernetes

Zestaw plików w `k8s/app` odtwarza obecną konfigurację Dockera (Next.js + Traefik) w klastrze k3s. Poniżej instrukcja krok‑po‑kroku.

## 1. Wymagania
- Namespace `apps` w klastrze (`kubectl create ns apps` jeśli brakuje).
- Traefik zainstalowany w k3s (domyślnie w `kube-system`).
- cert-manager z wystawionym `ClusterIssuer` o nazwie `cloudflare-dns` (DNS‑01 z tokenem Cloudflare).
- Dostęp do obrazu `ghcr.io/marmal6313/mosir-portal:<tag>` (jeśli GHCR prywatny, utwórz `imagePullSecret`).

## 2. Secret z env
1. Skopiuj wartości z `.env.local` (Supabase, Sentry itd.) do pliku tymczasowego, np. `k8s/app/secret.env`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...
   ALLOWED_IMAGE_HOSTS=avxrypydpexbqthumuhb.supabase.co
   SENTRY_DSN=
   SENTRY_ENVIRONMENT=production
   SENTRY_TRACES_SAMPLE_RATE=0.05
   NEXT_TELEMETRY_DISABLED=1
   ```
2. W klastrze utwórz sekret:
   ```bash
   kubectl create secret generic mosir-portal-env \
     --from-env-file=k8s/app/secret.env \
     -n apps
   ```
   (Plik `secret.env` nie powinien trafić do repo.)

## 3. Zastosuj manifesty
```bash
kubectl apply -f k8s/app/deployment.yaml
kubectl apply -f k8s/app/service.yaml
kubectl apply -f k8s/app/ingress.yaml
```
Sprawdź rollout: `kubectl rollout status deploy/mosir-portal -n apps`.

## 4. DNS / TLS
- W Cloudflare ustaw rekord `app.e-mosir.pl` na proxied A → publiczny IP serwera (HTTPS „Full (strict)”).
- cert-manager utworzy certyfikat w secrete `mosir-portal-tls`. Status sprawdzisz komendą:
  ```bash
  kubectl describe certificate mosir-portal-tls -n apps
  ```

## 5. Smoke test
Po propagacji DNS uruchom:
```bash
curl -I https://app.e-mosir.pl/api/health
```
Powinno zwrócić 200. W razie błędów sprawdź logi poda `kubectl logs deploy/mosir-portal -n apps`.

## 6. GitHub Actions (opcjonalnie)
- Dodaj sekret `KUBECONFIG_B64` (zakodowany `/etc/rancher/k3s/k3s.yaml`).
- W workflow użyj `kubectl apply -f k8s/app/` aby wdrażać zmiany przy tagu release.
