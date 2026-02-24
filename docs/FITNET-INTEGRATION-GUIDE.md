# 🏊 Integracja Fitnet z Drabio (e-mosir.pl)

## Cel
Wyświetlanie przychodów ze sprzedaży (bilety na basen, fitness, itp.) z systemu Fitnet w portalu Drabio.

## Architektura

```
┌──────────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│   MSSQL Fitnet       │  ─────> │  Next.js API     │  ─────> │  React Dashboard│
│   192.168.3.5\fitnet2│         │  (backend proxy) │         │  (frontend)     │
│   (read-only)        │         │  in K8s pod      │         │  superadmin only│
└──────────────────────┘         └──────────────────┘         └─────────────────┘
   Dostęp tylko z poda          app.e-mosir.pl               app.e-mosir.pl
   mosir-virtual/mosir-portal
```

## Bezpieczeństwo

### ✅ Zasady bezpieczeństwa
1. **Read-only połączenie** - NIGDY nie wykonujemy INSERT/UPDATE/DELETE
2. **Backend proxy** - Frontend NIGDY nie łączy się bezpośrednio do Fitnet
3. **Dane dostępowe w .env** - Nigdy w kodzie
4. **Tylko superadmin** - Na początku dostęp tylko dla superadmin
5. **Connection pooling** - Limitujemy liczbę połączeń do bazy

### 🔒 Zmienne środowiskowe

Dodaj do `.env.local`:

```env
# Fitnet MSSQL Database (READ-ONLY)
FITNET_DB_SERVER=192.168.3.5\fitnet2
FITNET_DB_NAME=Fitnet  # lub inna nazwa bazy - do sprawdzenia
FITNET_DB_USER=your_user          # opcjonalne, dla SQL Auth
FITNET_DB_PASSWORD=your_password  # opcjonalne, dla SQL Auth
FITNET_DB_USE_WINDOWS_AUTH=false  # true dla Windows Authentication, false dla SQL Auth
```

## Krok 1: Rozpoznanie struktury bazy Fitnet

### Opcja A: Uruchom automatyczny skrypt (ZALECANE)

```bash
# Uruchom pomocniczy skrypt który automatycznie:
# - Znajdzie pod mosir-virtual lub mosir-portal
# - Zainstaluje mssql
# - Uruchomi inspekcję bazy
# - Zapisze wynik do fitnet-structure.txt

chmod +x scripts/run-fitnet-inspect-k8s.sh
./scripts/run-fitnet-inspect-k8s.sh
```

Skrypt zapyta Cię o:
- Nazwę bazy danych (domyślnie: Fitnet)
- Metodę uwierzytelniania (Windows Auth / SQL Auth)
- Login i hasło (jeśli SQL Auth)

### Opcja B: Ręcznie z poda K8s

```bash
# 1. Sprawdź nazwę poda
kubectl get pods -n apps -l app=mosir-portal

# 2. Zaloguj się do poda
kubectl exec -it -n apps deployment/mosir-portal -- /bin/bash

# 3. W podzie: zainstaluj mssql
npm install mssql

# 4. W podzie: ustaw zmienne środowiskowe
export FITNET_DB_NAME="Fitnet"
export FITNET_DB_USER="twoj_user"  # jeśli SQL Auth
export FITNET_DB_PASSWORD="haslo"  # jeśli SQL Auth
export FITNET_DB_USE_WINDOWS_AUTH="false"

# 5. W podzie: uruchom skrypt
node scripts/inspect-fitnet-db.js > /tmp/fitnet-structure.txt
cat /tmp/fitnet-structure.txt

# 6. Skopiuj wynik na lokalny komputer
exit  # wyjdź z poda
kubectl cp apps/mosir-portal-xxx:/tmp/fitnet-structure.txt ./fitnet-structure.txt

# 7. Zobacz wyniki
cat fitnet-structure.txt
```

Skrypt pokaże:
- ✅ Listę wszystkich tabel
- 💰 Tabele ze sprzedażą (transakcje, płatności)
- 🏷️ Tabele z produktami/kategoriami
- 📊 Strukturę kolumn każdej tabeli
- 📝 Przykładowe dane (3 rekordy)

### Co szukamy?

Przykładowe nazwy tabel które mogą zawierać przychody:
- `Sprzedaz`, `SprzedazPozycje`
- `Transakcje`, `Platnosci`
- `Bilety`, `Karnety`
- `Faktury`, `Paragony`
- `Sales`, `Payments`, `Tickets`

## Krok 2: Stworzenie połączenia do Fitnet

Utworzymy bezpieczny moduł do łączenia się z Fitnet:

`lib/fitnet-db.ts` - Connection pool z retry logic

## Krok 3: API Endpoints

Utworzymy następujące endpointy:

### GET `/api/fitnet/revenue/daily`
Przychody dzienne z podziałem na kategorie

**Query params:**
- `date` - data (YYYY-MM-DD), domyślnie dziś
- `organization_id` - ID organizacji (wymagane)

**Response:**
```json
{
  "date": "2026-02-24",
  "total": 15420.50,
  "categories": [
    {
      "name": "Basen",
      "amount": 8500.00,
      "transactions": 127
    },
    {
      "name": "Fitness",
      "amount": 6920.50,
      "transactions": 89
    }
  ]
}
```

### GET `/api/fitnet/revenue/range`
Przychody w zakresie dat

**Query params:**
- `start_date` - data początkowa (YYYY-MM-DD)
- `end_date` - data końcowa (YYYY-MM-DD)
- `organization_id` - ID organizacji

### GET `/api/fitnet/products`
Lista produktów/usług

## Krok 4: Frontend Dashboard

### Nowa zakładka w Sidebar

Dodamy "💰 Przychody" widoczną tylko dla `superadmin`.

### Dashboard `/dashboard/revenue`

Komponenty:
- **RevenueChart** - Wykres przychodów w czasie
- **CategoryBreakdown** - Rozbicie na kategorie (pie chart)
- **DailyStats** - Statystyki dzienne
- **DateRangePicker** - Wybór zakresu dat
- **ExportButton** - Eksport do Excel/PDF

## Krok 5: Testowanie

### Test połączenia:
```bash
node scripts/inspect-fitnet-db.js
```

### Test API:
```bash
curl http://localhost:3000/api/fitnet/revenue/daily?date=2026-02-24
```

### Test frontendu:
1. Zaloguj się jako superadmin
2. Kliknij "💰 Przychody" w sidebar
3. Zobacz dashboard z danymi

## FAQ

### Q: Czy to bezpieczne?
**A:** Tak! Używamy tylko SELECT (odczyt), żadnych zmian w bazie Fitnet.

### Q: Czy to spowolni Fitnet?
**A:** Nie, używamy connection pooling i cache. Zapytania są optymalizowane.

### Q: Co jeśli zmienię strukturę bazy Fitnet?
**A:** Musisz zaktualizować zapytania SQL w `lib/fitnet-queries.ts`.

### Q: Czy mogę to włączyć dla innych użytkowników?
**A:** Tak, po przetestowaniu zmień permission z `superadmin` na `dyrektor` lub `kierownik`.

### Q: Dane są aktualne realtime?
**A:** Zależy od cache. Możesz ustawić refresh co 5 min lub włączyć ręczne odświeżanie.

## Troubleshooting

### Błąd: "Login failed for user"
- Sprawdź czy SQL Server ma włączoną Windows Authentication
- Sprawdź czy użytkownik ma uprawnienia do bazy Fitnet

### Błąd: "Cannot connect to server"
- Sprawdź czy SQL Server jest uruchomiony
- Sprawdź nazwę serwera (może być `.\SQLEXPRESS` lub `localhost\SQLEXPRESS`)
- Sprawdź czy TCP/IP jest włączony w SQL Server Configuration Manager

### Błąd: "Invalid object name"
- Nazwa tabeli jest niepoprawna
- Uruchom ponownie `inspect-fitnet-db.js` żeby zobaczyć dostępne tabele

## Next Steps

Po zintegrowaniu podstawowych przychodów możemy dodać:
1. 📊 Porównanie rok do roku (YoY)
2. 📈 Prognozy przychodów
3. 🎯 Cele sprzedażowe
4. 📧 Powiadomienia email (raport dzienny)
5. 📱 Powiadomienia push (niskie przychody)
6. 📄 Eksport raportów (PDF, Excel)
7. 🔔 Alerty o anomaliach

---

**Status:** 🚧 W trakcie implementacji
**Priorytet:** ⭐⭐⭐ Wysoki
**Odpowiedzialny:** Zespół dev Drabio
