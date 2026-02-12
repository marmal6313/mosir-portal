# ADR 0002: Przypisanie użytkowników do wielu działów (multi-department)

**Status:** Accepted
**Data:** 2026-02-12
**Release:** `release-250212`

## Kontekst

Dotychczasowy model danych pozwalał na przypisanie użytkownika do dokładnie jednego działu (`users.department_id`). Kierownicy zarządzający wieloma działami musieli mieć osobne konta lub role z globalnym dostępem, co nie odpowiadało rzeczywistej strukturze organizacyjnej MOSiR.

Wymaganie: użytkownik (szczególnie `kierownik`) powinien móc być przypisany do wielu działów i widzieć zadania ze wszystkich swoich działów.

## Decyzja

Wprowadzenie tabeli pośredniej (junction table) `user_departments` realizującej relację many-to-many między `users` a `departments`.

### Model danych

```sql
CREATE TABLE public.user_departments (
  id          SERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  department_id INTEGER NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  is_primary  BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, department_id)
);
```

### Kluczowe elementy

1. **Junction table** `user_departments` — link user ↔ department z flagą `is_primary`.
2. **Zachowanie kompatybilności** — kolumna `users.department_id` pozostaje jako primary department (backward compatibility).
3. **Funkcja SQL** `get_user_department_ids(UUID) → integer[]` — zwraca tablicę ID działów użytkownika.
4. **Zaktualizowany widok** `users_with_details` — nowe kolumny `department_ids` (integer[]) i `department_names` (text[]).
5. **Zaktualizowane polityki RLS** — `tasks`, `users`, `departments`, `task_changes`, `task_comments` filtrują po `user_departments` zamiast `users.department_id`.
6. **UI** — multi-checkbox zamiast single-select dropdown w formularzu użytkownika.
7. **API** — `department_ids: number[]` w payloadach create/update.

## Rozpatrywane alternatywy

### A) Tablica w kolumnie (integer[] w `users`)
- Prostsze, brak dodatkowej tabeli.
- Odrzucone: brak integralności referencyjnej (FK), trudniejsze query (ANY/overlap), brak metadanych (is_primary, created_at).

### B) Oddzielna rola per dział (np. `kierownik_hala`, `kierownik_basen`)
- Odrzucone: eksplozja ról, brak skalowalności, zmiana modelu uprawnień.

### C) Globalna widoczność dla kierowników
- Odrzucone: narusza zasadę least privilege, kierownik widzi dane działów, którymi nie zarządza.

## Konsekwencje

### Pozytywne
- Użytkownicy widzą zadania ze wszystkich swoich działów.
- Elastyczna struktura — łatwo dodać/usunąć dział bez zmiany roli.
- Pełna integralność referencyjna (FK + CASCADE).
- Metadane (is_primary, created_at) umożliwiają przyszłe rozszerzenia.

### Negatywne / ryzyka
- Dodatkowy JOIN w zapytaniach RLS (wpływ na wydajność przy dużej liczbie wierszy — zmitigowany indeksami).
- Podwójne źródło prawdy: `users.department_id` vs `user_departments` — wymaga synchronizacji w API.
- `permissions.ts` / `usePermissions.ts` jeszcze nie w pełni zaktualizowane o multi-department scope (TODO P2).

## Pliki

| Plik | Opis |
|---|---|
| `SQL/migration-user-departments.sql` | Migracja: tabela, indeksy, RLS, widok, funkcja |
| `SQL/verify-user-departments-migration.sql` | Weryfikacja migracji |
| `hooks/useUserDepartments.ts` | Hook React + helper function |
| `app/dashboard/tasks/page.tsx` | Filtrowanie po wielu działach |
| `app/dashboard/reports/page.tsx` | Agregacja statystyk |
| `app/dashboard/users/page.tsx` | UI multi-select |
| `app/api/users/create/route.ts` | API create z department_ids |
| `app/api/users/update/route.ts` | API update z department_ids |
| `types/database.ts` | Typy TypeScript |
