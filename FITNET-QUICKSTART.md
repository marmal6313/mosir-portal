# 🚀 FITNET INTEGRATION - QUICK START

> Integracja systemu sprzedażowego Fitnet (192.168.3.5\fitnet2) z portalem Drabio
> **Cel:** Wyświetlanie przychodów dziennych z podziałem na kategorie (basen, fitness, itp.)

---

## 🛡️ BEZPIECZNY WORKFLOW - Praca na backupie

**ZALECANE:** Pracuj na kopii bazy zamiast bezpośrednio na produkcji!

### Workflow A: 🔒 Z backupem (BEZPIECZNE - POLECANE)

1. 💾 **Backup produkcji** → `Fitnet_Backup_20260227.bak`
2. 🔄 **Restore na testową bazę** → `Fitnet_Test`
3. 🔍 **Inspekcja testowej bazy** → poznaj strukturę
4. ⚙️ **Konfiguracja K8s** → wskaż na `Fitnet_Test`
5. 🚀 **Pracuj bezpiecznie** - produkcja nietknięta!

### Workflow B: ⚠️ Bez backupu (mniej bezpieczne)

1. 🔍 **Inspekcja produkcji** (tylko SELECT)
2. ⚙️ **Konfiguracja K8s** → wskaż na produkcję
3. 🚀 **Pracuj ostrożnie** - read-only zabezpieczenia

---

## 🎯 Plan - Workflow A (z backupem) - łącznie ~2.5h

0. 💾 **Backup bazy Fitnet** (15 min) - NOWY KROK
1. 🔄 **Restore na testową bazę** (10 min) - NOWY KROK
2. 🔍 **Zbadaj strukturę testowej bazy** (10 min)
3. ⚙️ **Skonfiguruj zmienne K8s** (5 min)
4. ✅ **Testuj API** (15 min)
5. 🎨 **Uzupełnij zapytania SQL** (30 min) - po otrzymaniu struktury
6. 📊 **Dodaj dashboard** (1h)

---

## Krok 0: 💾 Backup produkcyjnej bazy Fitnet (ZALECANE)

### ⚠️ WAŻNE: Kiedy robić backup?

Fitnet działa **24/7 produkcyjnie** - ludzie kupują bilety/karnety cały czas!

**SPRAWDŹ OBCIĄŻENIE przed backupem:**
```bash
./scripts/check-fitnet-load.sh
```

Ten skrypt pokaże:
- 👥 Ile osób używa systemu TERAZ
- 💾 Rozmiar bazy
- ⏱️ Szacowany czas backupu
- ✅ Czy to DOBRY moment na backup

**NAJLEPSZY MOMENT:**
- 🌙 **Noc:** 23:00 - 06:00 (MOSiR zamknięty)
- 📅 **Weekend:** Sobota/Niedziela rano
- ⏰ **Teraz:** Tylko jeśli `check-fitnet-load.sh` pokazuje ✅

📖 **Przeczytaj:** [docs/FITNET-BACKUP-SAFETY.md](docs/FITNET-BACKUP-SAFETY.md) - pełna analiza bezpieczeństwa

---

### Utwórz backup produkcji:

```bash
./scripts/backup-fitnet-db.sh
```

Skrypt zapyta o:
- **Nazwa bazy źródłowej:** `Fitnet` (lub inna)
- **Username/Password:** dane do produkcyjnej bazy
- **Gdzie zapisać backup:**
  - Opcja 1: Na tym samym serwerze SQL (np. `C:\Backups`)
  - Opcja 2: Na lokalnym serwerze MOSiR

**Wynik:**
- Plik backupu: `C:\Backups\Fitnet_Backup_20260227_143025.bak`
- Backup używa `COPY_ONLY` - nie wpływa na produkcyjne backupy
- Kompresja włączona (jeśli dostępna)

**Czas:** ~5-15 minut (zależnie od rozmiaru bazy)

---

## Krok 1: 🔄 Restore backupu na testową bazę

### Przywróć backup do nowej bazy testowej:

```bash
./scripts/restore-fitnet-backup.sh
```

Skrypt zapyta o:
- **Serwer SQL:** `192.168.3.5\fitnet2`
- **Nazwa testowej bazy:** `Fitnet_Test`
- **Ścieżka do backupu:** `C:\Backups\Fitnet_Backup_20260227_143025.bak`
- **Username/Password:** dane dostępowe

**Co robi skrypt:**
1. Sprawdza czy `Fitnet_Test` już istnieje (usuwa jeśli tak)
2. Odczytuje zawartość backupu
3. Przywraca backup do nowej bazy `Fitnet_Test`
4. Ustawia bazę w tryb MULTI_USER

**Wynik:** Gotowa baza testowa `Fitnet_Test` - identyczna kopia produkcji!

**Czas:** ~10 minut

---

## Krok 2: 🔍 Zbadaj strukturę testowej bazy

### Automatycznie (najłatwiejsze):

```bash
./scripts/run-fitnet-inspect-k8s.sh
```

Podaj:
- **Nazwa bazy:** `Fitnet_Test` ← TESTOWA, nie produkcja!
- **Uwierzytelnianie:** `2` (SQL Server Authentication)
- **Username:** `twój_login`
- **Password:** `twoje_hasło`

**Wynik:** Plik `fitnet-structure.txt` z listą tabel i struktur.

---

## Krok 3: ⚙️ Skonfiguruj zmienne środowiskowe w K8s

Dodaj dane dostępowe do **testowej bazy** w K8s:

```bash
./scripts/add-fitnet-env-to-k8s.sh
```

**WAŻNE:** Podaj nazwę **TESTOWEJ** bazy:
- Server: `192.168.3.5\fitnet2`
- Database: `Fitnet_Test` ← nie `Fitnet`!
- Username/Password: te same dane

Następnie restart deploymentu:
```bash
kubectl rollout restart deployment/mosir-portal -n apps
kubectl rollout status deployment/mosir-portal -n apps
```

---

## Krok 4: ✅ Testuj połączenie

Test API (zaloguj się jako superadmin w przeglądarce, potem):

```bash
curl https://app.e-mosir.pl/api/fitnet/test
```

Powinieneś zobaczyć:
```json
{
  "success": true,
  "message": "Połączenie z bazą Fitnet działa!",
  "connection": {
    "database": "Fitnet_Test"  ← sprawdź czy to testowa!
  },
  "diagnostics": {
    "tablesCount": 50,
    "tables": ["...", "..."]
  }
}
```

✅ **Jeśli widzisz `Fitnet_Test` - działa! Pracujesz na bezpiecznej kopii!**

---

## Krok 5: 📤 Wyślij mi strukturę bazy

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

## Krok 6: 🎨 Dokończę integrację

Gdy dostanę strukturę, automatycznie:

✅ Uzupełnię zapytania SQL w `lib/fitnet-queries.ts`
✅ Zaktualizuję endpoint `/api/fitnet/revenue/daily`
✅ Dodam zakładkę "💰 Przychody" do Sidebar (tylko superadmin)
✅ Stworzę dashboard z:
   - Wykres przychodów
   - Rozbicie na kategorie (basen, fitness, itp.)
   - Statystyki dzienne/tygodniowe/miesięczne
   - Eksport do Excel

**Czas:** ~1.5h po otrzymaniu struktury

---

## 🎉 Podsumowanie bezpieczeństwa

### ✅ Co chroni produkcję:

1. **Backup COPY_ONLY** - nie wpływa na łańcuch backupów produkcyjnych
2. **Osobna baza testowa** - `Fitnet_Test` vs `Fitnet`
3. **Read-only w kodzie** - `lib/fitnet-db.ts` blokuje INSERT/UPDATE/DELETE
4. **Tylko SELECT** - wszystkie zapytania weryfikowane przed wykonaniem
5. **K8s secrets** - hasła bezpiecznie przechowywane
6. **Superadmin only** - tylko Ty masz dostęp na początku

### 🔄 Kiedy przełączyć na produkcję?

Po przetestowaniu na `Fitnet_Test`:
1. Wszystko działa poprawnie
2. Dashboard pokazuje dobre dane
3. Gotowy do użycia przez kierowników

Wtedy:
```bash
# Zmień nazwę bazy w K8s secret
kubectl edit secret mosir-portal-env -n apps
# Zmień: FITNET_DB_NAME: Fitnet_Test → FITNET_DB_NAME: Fitnet

# Restart
kubectl rollout restart deployment/mosir-portal -n apps
```

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
