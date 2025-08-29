# 🛠️ Instrukcja Systemowa - MOSIR Portal

## **1. INFORMACJE OGÓLNE**

### **Nazwa projektu:** MOSIR Portal
### **Typ:** Aplikacja webowa - system zarządzania zadaniami i projektami
### **Technologie:** Next.js 15, React 19, TypeScript, Tailwind CSS, Supabase
### **Architektura:** Full-stack, serverless, JAMstack
### **Baza danych:** PostgreSQL (hostowana na Supabase)

---

## **2. ARCHITEKTURA SYSTEMU**

### **2.1 Frontend (Next.js 15)**
```
app/
├── dashboard/           # Panel główny
│   ├── gantt/         # Wykres Gantta
│   ├── tasks/         # Lista zadań
│   └── tasks/[id]/    # Szczegóły zadania
├── components/         # Komponenty React
├── lib/               # Utility functions
├── hooks/             # Custom React hooks
└── types/             # TypeScript definitions
```

### **2.2 Backend (Supabase)**
- **Authentication:** Supabase Auth
- **Database:** PostgreSQL z real-time subscriptions
- **Storage:** Supabase Storage (pliki)
- **Edge Functions:** Serverless API endpoints

### **2.3 Infrastruktura**
- **Hosting:** Vercel (frontend) + Supabase (backend)
- **CDN:** Vercel Edge Network
- **Database:** Supabase (PostgreSQL)
- **Monitoring:** Vercel Analytics + Supabase Dashboard

---

## **3. WYMAGANIA SYSTEMOWE**

### **3.1 Serwer deweloperski**
```bash
# Minimalne wymagania
- Node.js: 18.17+ (LTS)
- npm: 9+ lub yarn: 1.22+
- RAM: 4GB+
- Disk: 2GB+ wolnego miejsca
- OS: Linux/macOS/Windows 10+
```

### **3.2 Produkcja**
```bash
# Vercel
- Plan: Hobby (darmowy) lub Pro ($20/mies)
- Region: Europe (Frankfurt) - dla lepszego latency w Polsce

# Supabase
- Plan: Free tier lub Pro ($25/mies)
- Region: Europe West (London) - zgodność z Vercel
```

---

## **4. INSTALACJA I KONFIGURACJA**

### **4.1 Klonowanie repozytorium**
```bash
git clone <repository-url>
cd mosir-portal
npm install
```

### **4.2 Zmienne środowiskowe**
```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### **4.3 Konfiguracja Supabase**
```sql
-- Tabele w bazie danych
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'new',
  priority TEXT DEFAULT 'medium',
  start_date DATE,
  due_date DATE,
  assigned_to UUID REFERENCES auth.users(id),
  department_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS (Row Level Security)
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
```

---

## **5. KOMENDY SYSTEMOWE**

### **5.1 Development**
```bash
# Uruchomienie serwera deweloperskiego
npm run dev          # Port 3000

# Build aplikacji
npm run build        # Produkcyjny build

# Linting
npm run lint         # ESLint + TypeScript
npm run lint:fix     # Auto-fix błędów

# Type checking
npm run type-check   # TSC bez emisji
```

### **5.2 Dokumentacja**
```bash
# Otwarcie dokumentacji live
npm run docs:open    # Port 3100

# Build dokumentacji
npm run docs:build   # Statyczny build

# Serwowanie zbudowanej dokumentacji
npm run docs:serve   # Port 3200
```

### **5.3 Production**
```bash
# Uruchomienie produkcyjnego serwera
npm start           # Port 3000

# Analiza bundle
npm run analyze     # @next/bundle-analyzer

# Testy
npm test            # Jest + Testing Library
npm run test:watch  # Watch mode
```

---

## **6. STRUKTURA BAZY DANYCH**

### **6.1 Tabela `tasks`**
```sql
-- Główne pola
id: UUID (PK)                    -- Unikalny identyfikator
title: TEXT                      -- Tytuł zadania
description: TEXT                -- Opis zadania
status: TEXT                     -- Status: new, in_progress, completed, cancelled
priority: TEXT                   -- Priorytet: low, medium, high
start_date: DATE                 -- Data rozpoczęcia
due_date: DATE                   -- Termin zakończenia
assigned_to: UUID (FK)           -- Przypisany użytkownik
department_name: TEXT            -- Nazwa departamentu
created_at: TIMESTAMP            -- Data utworzenia
updated_at: TIMESTAMP            -- Data aktualizacji

-- Indeksy
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_priority ON tasks(priority);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);
```

### **6.2 Relacje**
```sql
-- Użytkownicy (auth.users - Supabase)
tasks.assigned_to → auth.users.id

-- RLS Policies
CREATE POLICY "Users can view their own tasks" ON tasks
  FOR SELECT USING (auth.uid() = assigned_to);

CREATE POLICY "Users can update their own tasks" ON tasks
  FOR UPDATE USING (auth.uid() = assigned_to);
```

---

## **7. DEPLOYMENT I CI/CD**

### **7.1 Vercel (Automatyczny)**
```yaml
# .vercel/project.json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "framework": "nextjs",
  "regions": ["fra1"]  # Frankfurt
}
```

### **7.2 Environment Variables w Vercel**
```bash
# Production
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx

# Preview (branches)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
```

### **7.3 Supabase Migrations**
```bash
# Lokalnie
supabase db reset
supabase db push

# Produkcja
supabase db push --db-url $SUPABASE_DB_URL
```

---

## **8. MONITORING I LOGI**

### **8.1 Vercel Analytics**
```typescript
// app/layout.tsx
import { Analytics } from '@vercel/analytics/react'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
```

### **8.2 Supabase Monitoring**
```sql
-- Sprawdzenie wydajności zapytań
SELECT 
  query,
  calls,
  total_time,
  mean_time
FROM pg_stat_statements 
WHERE query LIKE '%tasks%'
ORDER BY total_time DESC;
```

### **8.3 Error Tracking**
```typescript
// lib/error-tracking.ts
export const logError = (error: Error, context?: any) => {
  console.error('Error:', error.message, context)
  // Tutaj można dodać Sentry, LogRocket, etc.
}
```

---

## **9. BEZPIECZEŃSTWO**

### **9.1 RLS (Row Level Security)**
```sql
-- Wszystkie tabele mają włączone RLS
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Użytkownicy widzą tylko swoje zadania
CREATE POLICY "Users can only access their own tasks" ON tasks
  FOR ALL USING (auth.uid() = assigned_to);
```

### **9.2 API Security**
```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  // Sprawdzenie autoryzacji
  const token = request.headers.get('authorization')
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
}
```

### **9.3 Environment Variables**
```bash
# Nigdy nie commituj do git
.env.local          # Lokalne development
.env.production     # Produkcja (Vercel)
.env.preview        # Preview deployments
```

---

## **10. BACKUP I RECOVERY**

### **10.1 Database Backup**
```bash
# Supabase automatyczny backup
- Daily: 7 dni
- Weekly: 4 tygodnie
- Monthly: 12 miesięcy

# Ręczny backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql
```

### **10.2 Code Backup**
```bash
# Git remote backup
git remote add backup git@github.com:backup/mosir-portal.git
git push backup main

# Local backup
cp -r mosir-portal mosir-portal-backup-$(date +%Y%m%d)
```

---

## **11. PERFORMANCE I OPTYMALIZACJA**

### **11.1 Next.js Optimizations**
```typescript
// app/dashboard/tasks/page.tsx
import { Suspense } from 'react'
import dynamic from 'next/dynamic'

// Lazy loading komponentów
const TaskTable = dynamic(() => import('@/components/TaskTable'), {
  loading: () => <div>Ładowanie...</div>
})
```

### **11.2 Database Optimizations**
```sql
-- Indeksy dla szybkiego wyszukiwania
CREATE INDEX CONCURRENTLY idx_tasks_search 
ON tasks USING gin(to_tsvector('polish', title || ' ' || description));

-- Partial indexes
CREATE INDEX idx_active_tasks ON tasks(status, due_date) 
WHERE status IN ('new', 'in_progress');
```

### **11.3 Caching Strategy**
```typescript
// lib/cache.ts
export const cache = new Map()

export const getCachedTasks = async (userId: string) => {
  const key = `tasks:${userId}`
  if (cache.has(key)) return cache.get(key)
  
  const tasks = await fetchTasks(userId)
  cache.set(key, tasks)
  return tasks
}
```

---

## **12. TROUBLESHOOTING**

### **12.1 Common Issues**
```bash
# Build errors
npm run build 2>&1 | grep -i error

# Database connection
supabase status
supabase db reset

# Environment variables
echo $NEXT_PUBLIC_SUPABASE_URL
```

### **12.2 Log Analysis**
```bash
# Vercel logs
vercel logs --follow

# Supabase logs
supabase logs

# Local development
npm run dev 2>&1 | tee dev.log
```

---

## **13. MAINTENANCE**

### **13.1 Regular Tasks**
```bash
# Weekly
npm audit fix
npm update
supabase db push

# Monthly
npm run build --dry-run
vercel --prod
supabase db backup
```

### **13.2 Security Updates**
```bash
# Check vulnerabilities
npm audit
npm audit fix

# Update dependencies
npm update
npm outdated
```

---

## **14. SCALING**

### **14.1 Database Scaling**
```sql
-- Partitioning dla dużych tabel
CREATE TABLE tasks_2024 PARTITION OF tasks
FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');

-- Read replicas (Supabase Pro)
-- Automatyczne skalowanie
```

### **14.2 Application Scaling**
```typescript
// Implementacja pagination
const ITEMS_PER_PAGE = 50
const [page, setPage] = useState(1)
const offset = (page - 1) * ITEMS_PER_PAGE

// Virtual scrolling dla dużych list
import { TableVirtuoso } from 'react-virtuoso'
```

---

## **15. DOCUMENTATION**

### **15.1 Code Documentation**
```typescript
/**
 * Fetches tasks for a specific user with filtering and pagination
 * @param userId - The user's ID
 * @param filters - Optional filters for status, priority, etc.
 * @param page - Page number for pagination
 * @returns Promise<Task[]>
 */
export const fetchUserTasks = async (
  userId: string, 
  filters?: TaskFilters, 
  page: number = 1
): Promise<Task[]> => {
  // Implementation...
}
```

### **15.2 API Documentation**
```typescript
// app/api/tasks/route.ts
/**
 * @api {GET} /api/tasks Get user tasks
 * @apiName GetTasks
 * @apiGroup Tasks
 * @apiParam {String} userId User ID
 * @apiParam {Object} filters Optional filters
 * @apiSuccess {Task[]} tasks List of tasks
 */
```

---

## **🎯 PODSUMOWANIE**

Ta instrukcja systemowa zawiera:

✅ **Kompletną architekturę** systemu  
✅ **Instrukcje instalacji** i konfiguracji  
✅ **Procedury deployment** i CI/CD  
✅ **Strategie backup** i recovery  
✅ **Optymalizacje performance**  
✅ **Bezpieczeństwo** i monitoring  
✅ **Troubleshooting** i maintenance  
✅ **Scaling** i dokumentację  

**Dla dodatkowych informacji skontaktuj się z zespołem deweloperskim.**

