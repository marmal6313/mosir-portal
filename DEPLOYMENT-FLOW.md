# 🚀 Deployment Flow - MOSiR Portal

## Przegląd środowisk

| Środowisko | URL | Trigger | Auto-deploy | Przeznaczenie |
|------------|-----|---------|-------------|---------------|
| **Vercel Preview** | `*.vercel.app` | Każdy push do `main` lub PR | ✅ TAK | Testy przed produkcją |
| **K3S Production** | `app.e-mosir.pl` | Tag `release-*` lub manual | ❌ Manual | Produkcja |

---

## 📋 Workflow 1: Rozwój i testy (Vercel)

### Scenariusz: Zwykła praca nad kodem

```bash
# 1. Edytujesz kod lokalnie
vim app/dashboard/tasks/page.tsx

# 2. Commit i push
git add .
git commit -m "feat: add new feature"
git push origin main
```

### Co się dzieje automatycznie:

1. **GitHub Actions** - uruchamia się:
   - ✅ CI workflow (testy)
   - ✅ Build Docker image → `ghcr.io/marmal6313/mosir-portal:staging`

2. **Vercel** - automatycznie:
   - ✅ Wykrywa push
   - ✅ Buduje projekt (Next.js)
   - ✅ Wdraża na URL preview (np. `mosir-portal-git-main-your-name.vercel.app`)
   - ✅ Gotowe do testowania w ~2-3 minuty

3. **K3S Production** - NIE ZMIENIA SIĘ
   - Produkcja pozostaje stabilna
   - Obraz `staging` jest gotowy w registry, ale nie wdrożony

### Rezultat:

✅ Możesz przetestować zmiany na Vercel
✅ Produkcja nie jest dotknięta
✅ Docker image `staging` gotowy do manual deploy jeśli potrzebny

---

## 📦 Workflow 2: Wdrożenie na produkcję K3S

### Opcja A: Automatyczne (przez tag release)

```bash
# 1. Kod działa na Vercel - wszystko OK
# 2. Utwórz release tag
git tag -a release-$(date +%y%m%d)-v1 -m "Release: fix task comments organization_id"
git push origin release-$(date +%y%m%d)-v1
```

**Co się dzieje:**
1. GitHub Actions wykrywa tag `release-*`
2. Workflow `.github/workflows/deploy-k8s.yml` uruchamia się:
   - Buduje obraz Docker z tagiem release
   - Wdraża na K3S
   - Czeka na rollout (5 min timeout)
   - Wykonuje smoke test (healthcheck)
   - W razie błędu - automatyczny rollback

**Czas:** ~5-7 minut

### Opcja B: Ręczne (używając gotowego obrazu staging)

```bash
# Wdróż obraz który już istnieje
kubectl set image deployment/mosir-portal \
  mosir-portal=ghcr.io/marmal6313/mosir-portal:staging \
  -n apps

# Monitoruj deployment
kubectl rollout status deployment/mosir-portal -n apps --timeout=5m

# Sprawdź czy działa
curl https://app.e-mosir.pl/api/health
```

**Czas:** ~2-3 minuty

---

## 🔄 Pełny cykl deweloperski

### Dzień 1: Rozpoczęcie pracy nad nową funkcją

```bash
git checkout -b feature/new-task-filters
# ... edycja kodu ...
git commit -m "feat: add task filters"
git push origin feature/new-task-filters
```

**Vercel:** Tworzy preview URL dla tego brancha
**GitHub:** Otwierasz Pull Request
**Team:** Może przetestować na Vercel preview

### Dzień 2: Code review i merge

```bash
# Po review, mergeujesz PR do main
git checkout main
git pull origin main
```

**Vercel:** Automatycznie aktualizuje main preview
**K3S:** Bez zmian (czeka na release tag)
**Docker:** Obraz `staging` zaktualizowany

### Dzień 3: Wdrożenie na produkcję

```bash
# Wszystko działa na Vercel, czas na produkcję
git tag release-260223-v1
git push origin release-260223-v1
```

**GitHub Actions:** Deploy na K3S
**K3S:** Nowa wersja na `app.e-mosir.pl`
**Vercel:** Bez zmian (nadal preview)

---

## 🛠️ Troubleshooting

### Problem: Vercel deployment failed

**Sprawdź:**
1. Build logs w Vercel dashboard
2. Environment variables są ustawione
3. TypeScript errors: `npm run build` lokalnie

**Fix:**
```bash
# Lokalnie sprawdź build
npm run build

# Napraw błędy, push
git add .
git commit -m "fix: build errors"
git push origin main
```

### Problem: K3S deployment timeout

**Sprawdź:**
```bash
kubectl get pods -n apps -l app=mosir-portal
kubectl describe pod <pod-name> -n apps
kubectl logs -n apps -l app=mosir-portal --tail=100
```

**Fix:**
```bash
# Rollback do poprzedniej wersji
kubectl rollout undo deployment/mosir-portal -n apps
kubectl rollout status deployment/mosir-portal -n apps
```

### Problem: Zmiany nie widoczne na produkcji

**Przyczyna:** Cache, stary pod

**Fix:**
```bash
# Force restart deployment
kubectl rollout restart deployment/mosir-portal -n apps
kubectl rollout status deployment/mosir-portal -n apps
```

---

## 📊 Monitoring

### Vercel
- Dashboard: https://vercel.com/dashboard
- Deployments: Lista wszystkich wdrożeń
- Logs: Real-time function logs
- Analytics: Performance metrics

### K3S Production
```bash
# Status deployment
kubectl get deployment mosir-portal -n apps

# Lista podów
kubectl get pods -n apps -l app=mosir-portal

# Logi aplikacji
kubectl logs -n apps -l app=mosir-portal --tail=100 -f

# Obecny obraz
kubectl get deployment mosir-portal -n apps -o jsonpath='{.spec.template.spec.containers[0].image}'

# Healthcheck
curl https://app.e-mosir.pl/api/health
```

### GitHub Actions
- Workflows: https://github.com/marmal6313/mosir-portal/actions
- Build image: Każdy push do main
- Deploy K3S: Tylko release tags

---

## 🎯 Best Practices

### 1. Zawsze testuj na Vercel przed produkcją
```bash
git push origin main  # Test na Vercel
# Sprawdź czy działa
# Dopiero potem:
git tag release-...
```

### 2. Używaj semantycznych tagów release
```bash
# Format: release-YYMMDD-vN
git tag release-260223-v1  # Pierwsza wersja z 23 lutego
git tag release-260223-v2  # Hotfix tego samego dnia
```

### 3. Monitoruj deployment
```bash
# Nie push-and-forget, obserwuj:
kubectl rollout status deployment/mosir-portal -n apps --timeout=5m
curl https://app.e-mosir.pl/api/health
```

### 4. W razie wątpliwości - manual deploy
```bash
# Jeśli nie ufasz automatycznemu deployment:
kubectl set image deployment/mosir-portal mosir-portal=ghcr.io/marmal6313/mosir-portal:staging -n apps
```

---

## 📝 Quick Reference

### Sprawdź co jest wdrożone

```bash
# K3S Production
kubectl get deployment mosir-portal -n apps -o jsonpath='{.spec.template.spec.containers[0].image}'

# Vercel (w dashboardzie lub)
curl https://mosir-portal.vercel.app/api/health
```

### Wdróż ręcznie staging na K3S

```bash
kubectl set image deployment/mosir-portal mosir-portal=ghcr.io/marmal6313/mosir-portal:staging -n apps
kubectl rollout status deployment/mosir-portal -n apps
```

### Rollback produkcji

```bash
kubectl rollout undo deployment/mosir-portal -n apps
kubectl rollout status deployment/mosir-portal -n apps
```

### Restart bez zmiany wersji

```bash
kubectl rollout restart deployment/mosir-portal -n apps
```

---

## 🔐 Bezpieczeństwo

### Environment Variables

**Vercel:** Skonfigurowane w Vercel Dashboard → Settings → Environment Variables
**K3S:** Przechowywane jako GitHub Secrets, przekazywane podczas buildu Docker image

**Nigdy nie commituj:**
- `.env.local`
- `.env`
- Plików z credentials
- `k8s/app/secret.env`

### Secrets w GitHub

Wymagane dla K3S deployment:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `KUBECONFIG_B64` (dla kubectl access)

---

## ✅ Podsumowanie

| Akcja | Vercel | K3S Prod |
|-------|--------|----------|
| `git push main` | ✅ Auto deploy | ❌ Brak zmian |
| `git tag release-*` | ❌ Brak zmian | ✅ Auto deploy |
| Manual deploy | ❌ N/A | ✅ kubectl set image |

**Zalecany flow:**
1. Kod + commit → push main
2. Test na Vercel preview
3. Jeśli OK → `git tag release-*`
4. Automatyczne deployment na K3S lub manual
5. Verify healthcheck

**W razie problemów:**
- Vercel: Redeploy w dashboardzie
- K3S: `kubectl rollout undo` lub manual deploy
