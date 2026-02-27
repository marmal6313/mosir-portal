# 🔧 Fitnet Integration Scripts

## 📋 Dostępne skrypty

### 0. `backup-fitnet-db.sh` - Backup bazy Fitnet ⭐ NOWY

**Cel:** Tworzy bezpieczny backup produkcyjnej bazy Fitnet.

**Użycie:**
```bash
./scripts/backup-fitnet-db.sh
```

**Co robi:**
1. Pyta o dane dostępowe do produkcji
2. Tworzy backup COPY_ONLY (nie wpływa na łańcuch backupów)
3. Używa kompresji (jeśli dostępna)
4. Zapisuje backup na serwerze SQL

**Wynik:** Plik `.bak` z pełnym backupem bazy

**Czas:** 5-15 minut (zależy od rozmiaru)

**Bezpieczeństwo:**
- ✅ Tylko odczyt (SELECT)
- ✅ COPY_ONLY - nie psuje backupów produkcyjnych
- ✅ Działa z poda K8s (mosir-portal)

---

### 0b. `restore-fitnet-backup.sh` - Restore na testową bazę ⭐ NOWY

**Cel:** Przywraca backup do nowej testowej bazy `Fitnet_Test`.

**Użycie:**
```bash
./scripts/restore-fitnet-backup.sh
```

**Co robi:**
1. Usuwa starą bazę `Fitnet_Test` (jeśli istnieje)
2. Odczytuje strukturę plików z backupu
3. Przywraca backup do nowej bazy
4. Ustawia bazę w tryb MULTI_USER

**Wynik:** Nowa baza `Fitnet_Test` - identyczna kopia produkcji!

**Czas:** ~10 minut

---

### 1. `run-fitnet-inspect-k8s.sh` - Inspekcja bazy Fitnet

**Cel:** Automatycznie zbada strukturę bazy Fitnet z poda K8s.

**Użycie:**
```bash
./scripts/run-fitnet-inspect-k8s.sh
```

**Co robi:**
1. Znajduje pod mosir-virtual lub mosir-portal
2. Kopiuje skrypt `inspect-fitnet-db.js` do poda
3. Instaluje paczkę `mssql`
4. Uruchamia inspekcję bazy
5. Zapisuje wynik do `fitnet-structure.txt`

**Output:**
- Lista wszystkich tabel
- Tabele ze sprzedażą (transakcje, płatności)
- Tabele z produktami/kategoriami
- Strukturę kolumn każdej tabeli
- Przykładowe dane (3 rekordy z każdej tabeli)

---

### 2. `inspect-fitnet-db.js` - Rdzeń inspekcji

**Cel:** Node.js skrypt do analizy struktury bazy MSSQL.

**Wymagania:**
- Musi być uruchomiony z poda który ma dostęp do 192.168.3.5
- Wymaga paczki `mssql`

**Użycie bezpośrednie:**
```bash
# W podzie K8s
npm install mssql
export FITNET_DB_NAME="Fitnet"
export FITNET_DB_USER="login"
export FITNET_DB_PASSWORD="haslo"
export FITNET_DB_USE_WINDOWS_AUTH="false"
node scripts/inspect-fitnet-db.js
```

**Zmienne środowiskowe:**
- `FITNET_DB_SERVER` - domyślnie: `192.168.3.5\fitnet2`
- `FITNET_DB_NAME` - nazwa bazy (wymagane)
- `FITNET_DB_USER` - login (dla SQL Auth)
- `FITNET_DB_PASSWORD` - hasło (dla SQL Auth)
- `FITNET_DB_USE_WINDOWS_AUTH` - `true`/`false`

---

### 3. `add-fitnet-env-to-k8s.sh` - Konfiguracja K8s

**Cel:** Dodaje dane dostępowe Fitnet do K8s secret.

**Użycie:**
```bash
./scripts/add-fitnet-env-to-k8s.sh
```

**Co robi:**
1. Pyta o dane dostępowe (server, baza, login, hasło)
2. Koduje wartości do base64
3. Dodaje do istniejącego secretu `mosir-portal-env`
4. Lub tworzy nowy secret `mosir-portal-fitnet`

**Po uruchomieniu:**
```bash
# Restart deploymentu
kubectl rollout restart deployment/mosir-portal -n apps

# Sprawdź secret
kubectl get secret mosir-portal-env -n apps -o yaml
```

---

## 🔄 Workflow integracji Fitnet

### Workflow A: 🔒 Z backupem (BEZPIECZNE - ZALECANE)

```bash
# 0. Backup produkcji
./scripts/backup-fitnet-db.sh
# → Wynik: C:\Backups\Fitnet_Backup_20260227.bak

# 1. Restore na testową bazę
./scripts/restore-fitnet-backup.sh
# → Wynik: Baza Fitnet_Test

# 2. Zbadaj TESTOWĄ bazę
./scripts/run-fitnet-inspect-k8s.sh
# Podaj: Fitnet_Test (nie Fitnet!)
# → Wynik: fitnet-structure.txt

# 3. Skonfiguruj K8s z testową bazą
./scripts/add-fitnet-env-to-k8s.sh
# Podaj: Database = Fitnet_Test
kubectl rollout restart deployment/mosir-portal -n apps

# 4. Testuj połączenie
curl https://app.e-mosir.pl/api/fitnet/test
# Sprawdź czy pokazuje: "database": "Fitnet_Test"

# 5. Uzupełnij zapytania SQL (na podstawie struktury)
# Edytuj: lib/fitnet-queries.ts

# 6. Testuj API
curl https://app.e-mosir.pl/api/fitnet/revenue/daily?date=2026-02-24

# 7. Po przetestowaniu - przełącz na produkcję
kubectl edit secret mosir-portal-env -n apps
# Zmień: FITNET_DB_NAME: Fitnet_Test → Fitnet
kubectl rollout restart deployment/mosir-portal -n apps
```

### Workflow B: ⚠️ Bez backupu (tylko odczyt produkcji)

```bash
# 1. Zbadaj bazę produkcyjną
./scripts/run-fitnet-inspect-k8s.sh
# → Wynik: fitnet-structure.txt

# 2. Skonfiguruj K8s
./scripts/add-fitnet-env-to-k8s.sh
kubectl rollout restart deployment/mosir-portal -n apps

# 3. Testuj połączenie
curl https://app.e-mosir.pl/api/fitnet/test

# 4. Uzupełnij zapytania SQL
# Edytuj: lib/fitnet-queries.ts

# 5. Testuj API
curl https://app.e-mosir.pl/api/fitnet/revenue/daily?date=2026-02-24
```

---

## 🛡️ Bezpieczeństwo

### Zabezpieczenia w skryptach:

1. **Hasła nie są zapisywane** w plikach
   - `add-fitnet-env-to-k8s.sh` używa `read -sp` (silent password input)
   - Wartości od razu kodowane do base64 i wysyłane do K8s

2. **Tylko SELECT** w bazie
   - `lib/fitnet-db.ts` blokuje INSERT/UPDATE/DELETE
   - Weryfikuje każde zapytanie przed wykonaniem

3. **Dostęp tylko z poda K8s**
   - Baza 192.168.3.5 dostępna tylko z sieci MOSiR
   - Skrypty działają tylko w podach mosir-virtual/mosir-portal

4. **Tylko superadmin** w API
   - Endpointy `/api/fitnet/*` wymagają roli `superadmin`

---

## 🔧 Troubleshooting

### "Cannot find pod"
```bash
kubectl get pods -n apps
# Sprawdź czy mosir-portal lub mosir-virtual działa
```

### "Connection failed"
```bash
# Sprawdź czy pod ma dostęp do sieci
kubectl exec -it -n apps deployment/mosir-portal -- ping 192.168.3.5
```

### "Login failed"
- Sprawdź czy login/hasło są poprawne
- Sprawdź czy SQL Server ma włączoną SQL Authentication
- Sprawdź czy użytkownik ma uprawnienia do bazy Fitnet

### "Database does not exist"
```bash
# Sprawdź dostępne bazy
kubectl exec -it -n apps deployment/mosir-portal -- node -e "
const sql = require('mssql');
sql.connect({server:'192.168.3.5\\\\fitnet2',user:'login',password:'haslo',options:{encrypt:false}})
  .then(p=>p.request().query('SELECT name FROM sys.databases'))
  .then(r=>console.table(r.recordset))
"
```

---

## 📞 Wsparcie

Jeśli masz problemy:
1. Uruchom skrypt z flagą debug
2. Wyślij output (nawet z błędem)
3. Sprawdź logi poda: `kubectl logs -n apps -l app=mosir-portal --tail=100`

---

**Dokumentacja:** [docs/FITNET-INTEGRATION-GUIDE.md](../docs/FITNET-INTEGRATION-GUIDE.md)
**Quick Start:** [FITNET-QUICKSTART.md](../FITNET-QUICKSTART.md)
