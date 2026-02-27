# 🚀 Deploy Fitnet Integration to K8s

## Cel
Wdrożyć nowy kod z integracją Fitnet na produkcję K8s **BEZ ujawniania danych dostępowych**.

---

## 🔒 Zasada bezpieczeństwa

**DANE DOSTĘPOWE:**
- ✅ **K8s Secret** (`mosir-portal-env`) - TUTAJ PRZECHOWUJEMY
- ✅ **Lokalny `.env.local`** - dla local dev (w .gitignore)
- ❌ **NIE w kodzie** - nigdy hardcoded
- ❌ **NIE w Git** - .env.local jest w .gitignore
- ❌ **NIE w Vercel** - jeśli nie masz VPN do 192.168.3.5

---

## 📋 KROK 1: Dodaj dane Fitnet do K8s Secret

### Użyj skryptu (NAJŁATWIEJSZE):

```bash
./scripts/add-fitnet-env-to-k8s.sh
```

**Skrypt zapyta:**
- Server: `192.168.3.5\fitnet2`
- Database: `Fitnet` lub `Fitnet_Test`
- Auth method: `2` (SQL Server Authentication)
- Username: `twój_login`
- Password: `********` (wpisz cicho)

**Wybierz:** `1` (Dodać do istniejącego secretu mosir-portal-env)

### LUB ręcznie (ALTERNATYWA):

```bash
# Zakoduj wartości do base64
echo -n "192.168.3.5\\fitnet2" | base64
echo -n "Fitnet" | base64
echo -n "twoj_user" | base64
echo -n "twoje_haslo" | base64
echo -n "false" | base64

# Dodaj do secretu
kubectl patch secret mosir-portal-env -n apps --type='json' -p='[
  {"op": "add", "path": "/data/FITNET_DB_SERVER", "value": "MTkyLjE2OC4zLjVcZml0bmV0Mg=="},
  {"op": "add", "path": "/data/FITNET_DB_NAME", "value": "Rml0bmV0"},
  {"op": "add", "path": "/data/FITNET_DB_USER", "value": "<BASE64_USER>"},
  {"op": "add", "path": "/data/FITNET_DB_PASSWORD", "value": "<BASE64_PASSWORD>"},
  {"op": "add", "path": "/data/FITNET_DB_USE_WINDOWS_AUTH", "value": "ZmFsc2U="}
]'
```

### Sprawdź czy dodano:

```bash
kubectl get secret mosir-portal-env -n apps -o jsonpath='{.data}' | jq 'keys'
```

Powinieneś zobaczyć:
```json
[
  ...
  "FITNET_DB_NAME",
  "FITNET_DB_PASSWORD",
  "FITNET_DB_SERVER",
  "FITNET_DB_USER",
  "FITNET_DB_USE_WINDOWS_AUTH",
  ...
]
```

---

## 📦 KROK 2: Zbuduj i wdroż nowy obraz

Masz już wypuszczone commity na GitHub (`198deb42` z Fitnet).

### Opcja A: GitHub Actions (ZALECANE)

#### 1. Utwórz tag release:

```bash
# Sprawdź ostatni tag
git tag | sort -V | tail -1

# Utwórz nowy tag (zwiększ numer)
git tag release-20260227
git push origin release-20260227
```

#### 2. GitHub Actions automatycznie:
- Zbuduje obraz Docker z nowym kodem
- Wypchnie do `ghcr.io/marmal6313/mosir-portal:release-20260227`
- Wdroży na K8s

#### 3. Monitoruj deployment:

```bash
# Sprawdź workflow na GitHub
# https://github.com/marmal6313/mosir-portal/actions

# Sprawdź status deploymentu
kubectl rollout status deployment/mosir-portal -n apps

# Sprawdź logi
kubectl logs -n apps -l app=mosir-portal --tail=50 -f
```

### Opcja B: Ręczny build i deploy

```bash
# 1. Zaloguj się do ghcr.io
echo $GITHUB_TOKEN | docker login ghcr.io -u marmal6313 --password-stdin

# 2. Zbuduj obraz
docker build -t ghcr.io/marmal6313/mosir-portal:fitnet-$(date +%Y%m%d) .

# 3. Wypchaj obraz
docker push ghcr.io/marmal6313/mosir-portal:fitnet-$(date +%Y%m%d)

# 4. Zaktualizuj deployment
kubectl set image deployment/mosir-portal -n apps \
  mosir-portal=ghcr.io/marmal6313/mosir-portal:fitnet-$(date +%Y%m%d)

# 5. Poczekaj na rollout
kubectl rollout status deployment/mosir-portal -n apps
```

### Opcja C: Użyj istniejącego tagu

Jeśli obraz już istnieje (np. `staging` ma nowy kod):

```bash
# Restart deploymentu żeby pobrał nowy kod
kubectl rollout restart deployment/mosir-portal -n apps
kubectl rollout status deployment/mosir-portal -n apps
```

---

## ✅ KROK 3: Zweryfikuj deployment

### 1. Sprawdź czy pod działa:

```bash
kubectl get pods -n apps -l app=mosir-portal
```

Powinno być `Running` i `Ready 1/1`.

### 2. Sprawdź logi:

```bash
kubectl logs -n apps -l app=mosir-portal --tail=20
```

Szukaj błędów związanych z Fitnet.

### 3. Sprawdź zmienne środowiskowe:

```bash
kubectl exec -n apps deployment/mosir-portal -- env | grep FITNET
```

Powinno pokazać:
```
FITNET_DB_SERVER=192.168.3.5\fitnet2
FITNET_DB_NAME=Fitnet
FITNET_DB_USER=***
FITNET_DB_PASSWORD=***
FITNET_DB_USE_WINDOWS_AUTH=false
```

### 4. Test połączenia z Fitnet:

```bash
# Z przeglądarki (jako superadmin):
# 1. Otwórz: https://app.e-mosir.pl
# 2. Zaloguj się jako superadmin
# 3. Kliknij "Fitnet Tools" w menu
# 4. Kliknij "Sprawdź obciążenie"

# LUB z API:
curl https://app.e-mosir.pl/api/fitnet/test
```

Jeśli działa, zobaczysz:
```json
{
  "success": true,
  "message": "Połączenie z bazą Fitnet działa!",
  "connection": {
    "server": "192.168.3.5\\fitnet2",
    "database": "Fitnet"
  },
  "diagnostics": {
    "tablesCount": 50,
    "tables": [...]
  }
}
```

---

## 🔍 Troubleshooting

### Problem 1: Pod nie startuje

```bash
kubectl describe pod -n apps -l app=mosir-portal
```

Szukaj błędów w sekcji `Events`.

### Problem 2: Błąd połączenia z Fitnet

```bash
# Sprawdź czy pod ma dostęp do sieci
kubectl exec -n apps deployment/mosir-portal -- ping 192.168.3.5

# Sprawdź czy zmienne są ustawione
kubectl exec -n apps deployment/mosir-portal -- env | grep FITNET
```

### Problem 3: 401 Unauthorized w /api/fitnet/load

- Sprawdź czy jesteś zalogowany jako superadmin
- Sprawdź w bazie: `SELECT role FROM users WHERE id = 'twoj_user_id'`

### Problem 4: Brak linku "Fitnet Tools" w menu

- Sprawdź czy masz rolę `superadmin` (nie `dyrektor` ani `kierownik`)
- Odśwież stronę (Ctrl+F5)
- Wyloguj się i zaloguj ponownie

---

## 🎯 Podsumowanie

### Co zrobiliśmy:
1. ✅ Dodaliśmy dane Fitnet do K8s Secret (zaszyfrowane)
2. ✅ Zbudowaliśmy nowy obraz Docker z kodem Fitnet
3. ✅ Wdrożyliśmy na K8s
4. ✅ Zweryfikowaliśmy że działa

### Co osiągnęliśmy:
- ✅ Dane dostępowe są **TYLKO w K8s** (bezpieczne)
- ✅ **NIE MA** ich w Git/Vercel/kodzie
- ✅ Tylko superadmin ma dostęp do Fitnet Tools
- ✅ Połączenie działa z poda mosir-portal

### Następne kroki:
1. Zaloguj się jako superadmin
2. Kliknij "Fitnet Tools"
3. Sprawdź obciążenie bazy
4. Jeśli ✅ zielone - zrób backup
5. Wyślij mi strukturę bazy

---

## 📝 Szybka ściąga

```bash
# 1. Dodaj dane do K8s
./scripts/add-fitnet-env-to-k8s.sh

# 2. Utwórz release tag
git tag release-$(date +%Y%m%d)
git push origin release-$(date +%Y%m%d)

# 3. Monitoruj
kubectl rollout status deployment/mosir-portal -n apps

# 4. Testuj
# https://app.e-mosir.pl → Fitnet Tools → Sprawdź obciążenie
```

**Gotowe!** 🚀
