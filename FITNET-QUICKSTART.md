# 🚀 FITNET INTEGRATION - QUICK START

> Integracja systemu sprzedażowego Fitnet (192.168.3.5\fitnet2) z portalem Drabio
> **Cel:** Wyświetlanie przychodów dziennych z podziałem na kategorie (basen, fitness, itp.)

---

## 🎯 Plan 5 kroków (łącznie ~2h)

1. ✅ **Zbadaj strukturę bazy** (10 min)
2. ✅ **Skonfiguruj zmienne K8s** (5 min)
3. ⏳ **Uzupełnij zapytania SQL** (30 min) - po otrzymaniu struktury
4. ⏳ **Testuj API** (15 min)
5. ⏳ **Dodaj dashboard** (1h)

---

## Krok 1: Zbadaj strukturę bazy Fitnet

### Automatycznie (najłatwiejsze):

```bash
./scripts/run-fitnet-inspect-k8s.sh
```

Podaj:
- Nazwa bazy: `Fitnet` (lub inna jeśli znasz)
- Uwierzytelnianie: `2` (SQL Server Authentication)
- Username: `twój_login`
- Password: `twoje_hasło`

**Wynik:** Plik `fitnet-structure.txt` z listą tabel i struktur.

---

## Krok 2: Przeanalizuj wynik

Otwórz `fitnet-structure.txt` i znajdź:

### 💰 Tabele ze sprzedażą
Szukaj tabel zawierających:
- Transakcje / Sprzedaż
- Płatności / Faktury
- Bilety / Karnety

### 🏷️ Tabele z kategoriami
Szukaj tabel z:
- Produkty / Usługi
- Kategorie

### 📊 Kolumny które potrzebujemy:
- **Data** (data_sprzedazy, created_at, transaction_date)
- **Kwota** (kwota, amount, cena, price)
- **Kategoria** (kategoria, category, typ)
- **Produkt** (nazwa, product_name, usługa)

---

## Krok 2: Skonfiguruj zmienne środowiskowe w K8s

Po poznaniu struktury bazy (Krok 1), dodaj dane dostępowe do K8s:

```bash
./scripts/add-fitnet-env-to-k8s.sh
```

Skrypt doda zmienne do istniejącego secretu `mosir-portal-env`.

Następnie restart deploymentu:
```bash
kubectl rollout restart deployment/mosir-portal -n apps
kubectl rollout status deployment/mosir-portal -n apps
```

---

## Krok 3: Testuj połączenie

Test API (zaloguj się jako superadmin):

```bash
curl https://app.e-mosir.pl/api/fitnet/test
```

Powinieneś zobaczyć:
```json
{
  "success": true,
  "message": "Połączenie z bazą Fitnet działa!",
  "diagnostics": {
    "tablesCount": 50,
    "tables": ["...", "..."]
  }
}
```

---

## Krok 4: Wyślij mi strukturę bazy

Skopiuj zawartość `fitnet-structure.txt` lub output z `/api/fitnet/test`.

Potrzebuję zobaczyć:
```
📋 LISTA TABEL:
[nazwy tabel]

💰 TABELE ZE SPRZEDAŻĄ:
[nazwa tabeli] - [kolumny]

🏷️ TABELE Z PRODUKTAMI/KATEGORIAMI:
[nazwa tabeli] - [kolumny]
```

---

## Krok 5: Dokończę integrację

Gdy dostanę strukturę, automatycznie:

✅ Uzupełnię zapytania SQL w `lib/fitnet-queries.ts`
✅ Stworzę API endpoint `/api/fitnet/revenue/daily`
✅ Dodam zakładkę "💰 Przychody" do Sidebar (tylko superadmin)
✅ Stworzę dashboard z:
   - Wykres przychodów
   - Rozbicie na kategorie (basen, fitness, itp.)
   - Statystyki dzienne/tygodniowe/miesięczne
   - Eksport do Excel

---

## 🔧 Troubleshooting

### "Cannot connect to server"
- Sprawdź czy pod ma dostęp do sieci: `kubectl exec -it -n apps deployment/mosir-portal -- ping 192.168.3.5`
- Sprawdź czy SQL Server działa na 192.168.3.5

### "Login failed"
- Sprawdź login/hasło
- Sprawdź czy użytkownik ma uprawnienia do bazy Fitnet
- Sprawdź czy SQL Server ma włączoną SQL Authentication

### "Database does not exist"
- Nazwa bazy może być inna niż "Fitnet"
- Sprawdź dostępne bazy: `SELECT name FROM sys.databases;`

---

## 📞 Wsparcie

Jeśli masz problemy:
1. Uruchom: `./scripts/run-fitnet-inspect-k8s.sh`
2. Wyślij mi pełny output (nawet z błędem)
3. Powiedz mi jaką metodę uwierzytelniania używasz

---

## Co dalej?

Po pierwszym uruchomieniu inspekcji:
1. 📊 Przeanalizuję strukturę bazy
2. 🔧 Dopiszę zapytania SQL
3. 🎨 Stworzę dashboard
4. ✅ Przetestujesz jako superadmin
5. 🚀 Włączysz dla kierowników

**Szacowany czas:** 2-3 godziny po otrzymaniu struktury bazy.
