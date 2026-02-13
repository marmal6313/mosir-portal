# Pre-Deployment Checklist: release-250213

**Data:** 2026-02-13
**Branch:** main
**Target:** Produkcja (k3s namespace `apps`)

---

## ✅ PRZED DEPLOYEM

### 1. Migracje SQL (Supabase)
**KRYTYCZNE:** Wykonaj migracje PRZED deployem aplikacji!

```bash
# Otwórz Supabase Dashboard → SQL Editor
# Wykonaj w kolejności:
```

- [ ] **Migracja 1:** `SQL/migration-attendance-schedules.sql`
  - Tworzy: 6 tabel dla RACS integration
  - Sprawdź: `SELECT * FROM information_schema.tables WHERE table_name IN ('racs_integration_config', 'racs_user_mapping', 'work_schedules', 'attendance_records', 'attendance_summary', 'racs_sync_log');`

- [ ] **Migracja 2:** `SQL/fix-rls-attendance.sql`
  - Naprawia: RLS policies dla attendance
  - Sprawdź: `SELECT * FROM pg_policies WHERE tablename IN ('attendance_records', 'attendance_summary');`

- [ ] **Migracja 3:** `SQL/migration-user-shift-preferences.sql`
  - Dodaje: 5 kolumn do users
  - Sprawdź: `SELECT is_office_worker, default_shift_start, default_shift_end, default_shift_type, allowed_shift_types FROM users LIMIT 1;`

### 2. Build Test
- [ ] `npm run build` - build kompiluje się bez błędów
- [ ] `npm run lint` (opcjonalnie) - brak błędów linting

### 3. Git Status
- [ ] Wszystkie zmiany są w main branch
- [ ] Branch jest up-to-date z origin/main
- [ ] Brak uncommitted changes

### 4. Documentation
- [ ] Release notes: `docs/RELEASE-NOTES-250213.md` - przeczytane i zrozumiane
- [ ] DEPLOYMENT.md - zaktualizowane
- [ ] RUNBOOK.md - zaktualizowane

---

## 🚀 DEPLOYMENT (k3s)

### Krok 1: Utwórz tag release
```bash
git tag release-250213
git push origin release-250213
```
- [ ] Tag został utworzony
- [ ] Tag został wypushowany do GitHub

### Krok 2: Poczekaj na build (GitHub Actions)
```bash
# Sprawdź: https://github.com/marmal6313/mosir-portal/actions
```
- [ ] Workflow "CD" zakończył się sukcesem
- [ ] Obraz `ghcr.io/marmal6313/mosir-portal:release-250213` został opublikowany
- [ ] Job "build-and-push" - SUCCESS
- [ ] Job "deploy" może pokazać failure (oczekiwane, bo produkcja na k3s)

### Krok 3: Deploy na k3s
```bash
# SSH przez Tailscale do k3s master node
kubectl set image deployment/mosir-portal \
  mosir-portal=ghcr.io/marmal6313/mosir-portal:release-250213 \
  -n apps

# Monitoruj rollout
kubectl rollout status deployment/mosir-portal -n apps --timeout=180s
```
- [ ] Rollout rozpoczęty
- [ ] Rollout zakończony pomyślnie ("successfully rolled out")
- [ ] Brak błędów w kubectl

### Krok 4: Sprawdź status
```bash
# Sprawdź pods
kubectl get pods -n apps -l app=mosir-portal

# Sprawdź logi
kubectl logs deployment/mosir-portal -n apps --tail=100
```
- [ ] Pods w statusie "Running"
- [ ] Ready: 1/1 (lub 2/2 zależnie od replicas)
- [ ] Brak błędów w logach

---

## ✅ PO DEPLOYMENTZE

### 1. Smoke Tests
```bash
# Health check
curl -I https://app.e-mosir.pl/api/health
# Oczekiwane: HTTP/2 200

# Full response
curl https://app.e-mosir.pl/api/health
# Oczekiwane: {"status":"ok"}
```
- [ ] Health check zwraca 200
- [ ] Response body: `{"status":"ok"}`

### 2. Testy funkcjonalności

#### A) Grafiki - 3 widoki
- [ ] Wejdź na: https://app.e-mosir.pl/dashboard/schedules
- [ ] Widoczne 3 taby: "Excel Grid", "Timeline", "Karty"
- [ ] Przełączanie między widokami działa
- [ ] Excel Grid: sticky kolumna nazwiska, suma godzin
- [ ] Timeline: kolorowe bloki, inline edycja
- [ ] Karty: pełne detale, przyciski akcji

#### B) Preferencje zmian
- [ ] Wejdź na: https://app.e-mosir.pl/dashboard/users
- [ ] Kliknij "Edytuj" na dowolnym użytkowniku
- [ ] Sekcja "⏰ Preferencje zmian" widoczna
- [ ] Checkboxy dla allowed_shift_types działają
- [ ] Time pickers dla default_shift_start/end działają
- [ ] Checkbox "Pracownik biurowy" działa
- [ ] Zapisz - bez błędów

#### C) Multi-department task creation
- [ ] Zaloguj się jako użytkownik z wieloma działami
- [ ] Wejdź na: https://app.e-mosir.pl/dashboard/tasks/add-task
- [ ] W nagłówku widoczne badge'e ze wszystkimi działami
- [ ] Dropdown "Dział" pokazuje wszystkie działy użytkownika
- [ ] Komunikat "Dostępne działy: X" widoczny (jeśli > 1 dział)
- [ ] Utwórz zadanie dla różnych działów - działa

#### D) RACS Attendance (jeśli skonfigurowane)
- [ ] Wejdź na: https://app.e-mosir.pl/dashboard/attendance
- [ ] 4 karty statystyczne widoczne
- [ ] Przełączanie między "Podsumowanie" i "Rekordy" działa
- [ ] Filtry działają (data, użytkownik, wyszukiwanie)
- [ ] Eksport CSV działa

### 3. Sprawdź logi
```bash
# Logi aplikacji
kubectl logs deployment/mosir-portal -n apps --tail=200

# Logi cloudflared
kubectl logs deployment/cloudflared -n apps --tail=50
```
- [ ] Brak błędów "ERROR" w logach aplikacji
- [ ] Brak błędów "FATAL" w logach aplikacji
- [ ] Cloudflared pokazuje "Registered" / connected

### 4. Update deployment.yaml
```bash
# Lokalnie:
# 1. Edytuj k8s/app/deployment.yaml
#    Zmień: image: ghcr.io/marmal6313/mosir-portal:release-250213

git add k8s/app/deployment.yaml
git commit -m "chore: bump k8s deployment image to release-250213"
git push origin main
```
- [ ] deployment.yaml zaktualizowany
- [ ] Commit i push wykonany

---

## 🔄 ROLLBACK (w razie problemów)

### Opcja 1: Undo last rollout
```bash
kubectl rollout undo deployment/mosir-portal -n apps
```

### Opcja 2: Konkretna wersja
```bash
kubectl set image deployment/mosir-portal \
  mosir-portal=ghcr.io/marmal6313/mosir-portal:release-250212 \
  -n apps
```

### Po rollback:
- [ ] Smoke test: `curl -I https://app.e-mosir.pl/api/health` → 200
- [ ] Sprawdź logi
- [ ] Diagnoza problemu w logach
- [ ] Issue na GitHub z opisem problemu

---

## 📝 NOTATKI

### Czas trwania:
- Tag + GitHub Actions build: ~5-10 min
- kubectl set image + rollout: ~2-3 min
- Smoke tests: ~2 min
- **TOTAL:** ~10-15 min

### Kontakty:
- Tailscale VPN: `tailscale status`
- k3s master node: [adres IP lub MagicDNS]
- Supabase Dashboard: https://supabase.com/dashboard/project/[project-id]
- GitHub Actions: https://github.com/marmal6313/mosir-portal/actions

### Dokumentacja:
- Release Notes: `docs/RELEASE-NOTES-250213.md`
- DEPLOYMENT.md: `docs/DEPLOYMENT.md`
- RUNBOOK.md: `docs/RUNBOOK.md`

---

## ✅ FINAL CHECKLIST

- [ ] Migracje SQL wykonane
- [ ] Build GitHub Actions zakończony sukcesem
- [ ] Deploy na k3s zakończony pomyślnie
- [ ] Health check: 200 OK
- [ ] Wszystkie smoke tests passed
- [ ] Logi bez błędów
- [ ] deployment.yaml zaktualizowany
- [ ] Team powiadomiony o deploymencie

**Status:** ☐ PENDING / ☑ COMPLETED / ☒ ROLLBACK

**Deploy wykonał:** ___________________
**Data/czas:** ___________________
**Komentarze:** ___________________
