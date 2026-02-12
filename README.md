# MOSiR Portal

System zarządzania zadaniami dla Miejskiego Ośrodka Sportu i Rekreacji. Aplikacja webowa z dashboardem, raportami, zarządzaniem użytkownikami i wielodziałową strukturą uprawnień.

## Stack technologiczny

| Warstwa | Technologia |
|---|---|
| Frontend | Next.js 15 (App Router), React, TypeScript, Tailwind CSS, shadcn/ui |
| Backend | Next.js API Routes, Supabase (PostgreSQL, Auth, RLS, Storage) |
| Infrastruktura | K3s (Kubernetes), Cloudflare Tunnel, Tailscale VPN |
| CI/CD | GitHub Actions → GHCR (Docker) → K3s |
| Monitoring | Health endpoint (`/api/health`) |

## Funkcjonalności

- **Dashboard zadań** — tworzenie, przypisywanie, filtrowanie i śledzenie zadań
- **Multi-department** — użytkownicy mogą być przypisani do wielu działów jednocześnie
- **Raporty** — statystyki zadań, wydajność pracowników, analiza działów
- **Zarządzanie użytkownikami** — role (superadmin, dyrektor, kierownik, pracownik), przypisanie do działów
- **Row Level Security** — dane filtrowane na poziomie bazy danych wg roli i działów
- **Powiadomienia** — real-time notifications (Supabase Realtime)
- **Wykres Gantta** — wizualizacja harmonogramu zadań

## Role i uprawnienia

| Rola | Zakres |
|---|---|
| `superadmin` | Pełny dostęp do wszystkich danych i ustawień |
| `dyrektor` | Widok wszystkich działów, zarządzanie zadaniami |
| `kierownik` | Zarządzanie zadaniami w swoich działach (multi-department) |
| `pracownik` | Widok i realizacja zadań w swoich działach |

## Szybki start (development)

```bash
# Zainstaluj zależności
npm install

# Skopiuj i uzupełnij zmienne środowiskowe
cp .env.example .env.local
# Uzupełnij NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

# Uruchom serwer dev
npm run dev
```

Otwórz [http://localhost:3000](http://localhost:3000).

## Struktura projektu

```
├── app/                    # Next.js App Router
│   ├── api/                # API routes (users, tasks, health)
│   ├── dashboard/          # Dashboard pages (tasks, reports, users, gantt)
│   └── layout.tsx          # Root layout
├── components/             # React components (UI, charts, notifications)
├── hooks/                  # Custom hooks (useAuth, usePermissions, useUserDepartments)
├── lib/                    # Utilities (supabase client, permissions, keep-alive)
├── types/                  # TypeScript types (database.ts)
├── SQL/                    # Database migrations and verification scripts
├── k8s/                    # Kubernetes manifests (deployment, service, ingress, cloudflared)
├── deploy/                 # Legacy Docker Compose stack (fallback)
├── scripts/                # Deployment scripts
├── docs/                   # Documentation (DEPLOYMENT, RUNBOOK, ADR, plan, worklog)
└── .github/workflows/      # CI/CD pipelines
```

## Deployment

Produkcja działa na klastrze **K3s** z **Cloudflare Tunnel** jako ingress.

### Wydanie nowej wersji

```bash
# 1. Utwórz tag release
git tag release-YYMMDD && git push origin release-YYMMDD

# 2. Poczekaj na build w GitHub Actions (CD workflow)

# 3. Zastosuj nowy obraz na klastrze
kubectl set image deployment/mosir-portal \
  mosir-portal=ghcr.io/marmal6313/mosir-portal:release-YYMMDD -n apps

# 4. Sprawdź rollout
kubectl rollout status deployment/mosir-portal -n apps
```

### Migracje SQL

Migracje uruchamiane ręcznie w Supabase SQL Editor **przed** deployem nowej wersji. Pliki w `SQL/`.

Szczegóły: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | [`docs/RUNBOOK.md`](docs/RUNBOOK.md)

## Dokumentacja

| Dokument | Opis |
|---|---|
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Pełna dokumentacja wdrożeniowa |
| [`docs/RUNBOOK.md`](docs/RUNBOOK.md) | Runbook produkcji (diagnostyka, recovery) |
| [`docs/plan.md`](docs/plan.md) | Plan rozwoju i release rhythm |
| [`docs/worklog.md`](docs/worklog.md) | Historia zmian |
| [`k8s/README.md`](k8s/README.md) | Instrukcja K3s manifests |
| [`DEPLOY.md`](DEPLOY.md) | Legacy Docker Compose deployment |
| [`docs/adr/`](docs/adr/) | Architecture Decision Records |

## Aktualny release

**`release-250212`** (2026-02-12) — multi-department user assignment, infrastructure fixes.
