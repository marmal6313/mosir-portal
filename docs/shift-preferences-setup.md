# Konfiguracja preferencji zmian dla pracowników

## 📋 Co zostało dodane?

System teraz pozwala skonfigurować **rodzaj pracownika** i **dozwolone typy zmian** dla każdego użytkownika.

### Nowe pola w tabeli `users`:

1. **`is_office_worker`** (boolean) - Czy pracownik biurowy?
   - `true` = Pracownik biurowy (domyślnie 8:00-16:00)
   - `false` = Pracownik zmianowy

2. **`default_shift_start`** (time) - Domyślna godzina rozpoczęcia
   - Domyślnie: `08:00`
   - Używane przez przycisk "+ Standard"

3. **`default_shift_end`** (time) - Domyślna godzina zakończenia
   - Domyślnie: `16:00`
   - Używane przez przycisk "+ Standard"

4. **`default_shift_type`** (varchar) - Domyślny typ zmiany
   - `NULL` = używaj default_shift_start/end
   - `'1'` = Zmiana poranna (06:00-13:00)
   - `'2'` = Zmiana popołudniowa (15:00-22:00)
   - `'12'` = Zmiana 12h (09:00-21:00)

5. **`allowed_shift_types`** (text[]) - Dozwolone typy zmian
   - `NULL` = wszystkie dozwolone
   - `['1', '2', '12']` = tylko zmiany 1, 2, 12
   - `['wp', 'wn', 'on', 'dw']` = tylko dni wolne
   - Filtruje dropdown w grafiku

---

## 🚀 Instalacja (krok po kroku)

### 1. Uruchom migrację SQL w Supabase Dashboard

```sql
-- Otwórz Supabase Dashboard → SQL Editor → Wykonaj:
```

Plik: `/home/dell2/mosir-portal/SQL/migration-user-shift-preferences.sql`

Lub skopiuj:

```sql
ALTER TABLE users
ADD COLUMN IF NOT EXISTS allowed_shift_types TEXT[] DEFAULT ARRAY['1', '2', '12', 'wn', 'on', 'wp', 'dw'],
ADD COLUMN IF NOT EXISTS default_shift_type VARCHAR(10) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS default_shift_start TIME DEFAULT '08:00',
ADD COLUMN IF NOT EXISTS default_shift_end TIME DEFAULT '16:00',
ADD COLUMN IF NOT EXISTS is_office_worker BOOLEAN DEFAULT true;

-- Ustaw domyślne wartości dla pracowników biurowych
UPDATE users
SET is_office_worker = true,
    default_shift_start = '08:00',
    default_shift_end = '16:00',
    allowed_shift_types = ARRAY['wp', 'wn', 'on', 'dw']
WHERE position ILIKE '%dział%'
   OR position ILIKE '%księgowa%'
   OR position ILIKE '%kadr%'
   OR position ILIKE '%dyrektor%';
```

### 2. Zrestartuj aplikację

```bash
# Zatrzymaj dev server (Ctrl+C)
npm run dev
```

### 3. Gotowe! Przetestuj

Wejdź na http://localhost:3000/dashboard/schedules

---

## 🎯 Jak to działa?

### A) Przycisk "+ Standard" używa preferencji użytkownika

**Przed:**
```typescript
// Zawsze 8:00-16:00
shift_start: '08:00',
shift_end: '16:00',
```

**Teraz:**
```typescript
// Używa default_shift_start/end użytkownika
const shiftStart = user?.default_shift_start || '08:00'
const shiftEnd = user?.default_shift_end || '16:00'
```

**Przykład:**
- Marcin (biuro): Klik "+ Standard" → 08:00-16:00
- Ratownik (shift): Klik "+ Standard" → 06:00-13:00 (jeśli tak skonfigurowany)

### B) Dropdown pokazuje tylko dozwolone zmiany

**Przed:**
- Wszyscy widzą wszystkie opcje: 1, 2, 12, wn, on, wp, dw

**Teraz:**
- Pracownik biurowy: widzi tylko wp, wn, on, dw (dni wolne)
- Pracownik zmianowy: widzi 1, 2, 12 + dni wolne

### C) Badge "Biuro" w karcie pracownika

Jeśli `is_office_worker = true`, pokazuje się badge **"Biuro"** obok nazwiska.

---

## 📝 Przykłady konfiguracji

### Pracownik biurowy (domyślnie)

```sql
UPDATE users SET
  is_office_worker = true,
  default_shift_start = '08:00',
  default_shift_end = '16:00',
  allowed_shift_types = ARRAY['wp', 'wn', 'on', 'dw']
WHERE email = 'pracownik@mosir.pl';
```

**Efekt:**
- Przycisk "+ Standard" → 08:00-16:00
- Dropdown: tylko dni wolne (wp, wn, on, dw)
- Badge "Biuro" przy nazwisku

### Ratownik (zmiana poranna)

```sql
UPDATE users SET
  is_office_worker = false,
  default_shift_type = '1',
  default_shift_start = '06:00',
  default_shift_end = '13:00',
  allowed_shift_types = ARRAY['1', '2', 'wp', 'wn']
WHERE email = 'ratownik@mosir.pl';
```

**Efekt:**
- Przycisk "+ Standard" → 06:00-13:00 (zmiana 1)
- Dropdown: 1, 2, wp, wn
- Brak badge "Biuro"

### Recepcja (zmiany elastyczne)

```sql
UPDATE users SET
  is_office_worker = false,
  default_shift_start = '08:00',
  default_shift_end = '16:00',
  allowed_shift_types = ARRAY['1', '2', '12', 'wp', 'wn', 'on', 'dw']
WHERE email = 'recepcja@mosir.pl';
```

**Efekt:**
- Przycisk "+ Standard" → 08:00-16:00
- Dropdown: wszystkie opcje (1, 2, 12 + dni wolne)
- Brak badge "Biuro"

---

## 🔧 Kolejne kroki (opcjonalne)

W przyszłości można dodać:

1. **UI do edycji preferencji** w `/dashboard/users`
   - Checkboxy dla allowed_shift_types
   - Time pickers dla default_shift_start/end
   - Toggle dla is_office_worker

2. **Automatyczne sugestie** na podstawie stanowiska
   - Dyrektor → automatycznie biuro
   - Ratownik → automatycznie zmiany

3. **Walidacja grafików**
   - Nie pozwalaj dodać zmiany 12h dla pracownika biurowego
   - Alert gdy ktoś ma za dużo godzin w tygodniu

4. **Templates grafików**
   - Zapisuj wzorce tygodni dla różnych typów pracowników
   - Szybkie kopiowanie standardowych grafików

---

## ❓ FAQ

**Q: Co jeśli użytkownik ma `allowed_shift_types = NULL`?**
A: Widzi wszystkie opcje (1, 2, 12, wn, on, wp, dw)

**Q: Co jeśli użytkownik ma `default_shift_type = NULL`?**
A: Przycisk "+ Standard" używa `default_shift_start` i `default_shift_end`

**Q: Czy mogę zmienić preferencje dla wielu użytkowników naraz?**
A: Tak, użyj SQL UPDATE z warunkiem WHERE (np. WHERE department_id = 2)

**Q: Czy preferencje wpływają na synchronizację RACS?**
A: Nie, obecności są synchronizowane niezależnie od preferencji

---

## 📊 Status implementacji

- ✅ Migracja SQL
- ✅ TypeScript types
- ✅ Schedules page - wykorzystanie preferencji
- ✅ Filtrowanie dropdown według allowed_shift_types
- ✅ Przycisk "+ Standard" używa domyślnych godzin
- ✅ Badge "Biuro" dla pracowników biurowych
- ⏳ UI do edycji preferencji w dashboard/users (do zrobienia)

