# Mock RACS Server - Przewodnik

Mock serwer Roger RACS-5 do testów i rozwoju bez dostępu do prawdziwego serwera.

## 🚀 Szybki start

### 1. Uruchom Mock RACS Server

W **PIERWSZYM terminalu** (zostaw działający):

```bash
npm run mock-racs
```

Powinieneś zobaczyć:
```
🚀 Mock RACS Server started!
📡 Listening on: http://localhost:8892
📊 Mock data:
   - 5 persons
   - 5 credentials
   - ~300 events (last 30 days)
   - 3 doors
✅ Ready to accept connections!
```

### 2. Uruchom aplikację Next.js

W **DRUGIM terminalu**:

```bash
npm run dev
```

Aplikacja uruchomi się na `http://localhost:3001` (lub 3000).

### 3. Skonfiguruj połączenie z mock RACS

W **TRZECIM terminalu**:

```bash
curl -X POST http://localhost:3001/api/racs/config \
  -H "Content-Type: application/json" \
  -d '{
    "service_url": "http://localhost:8892",
    "username": "mock",
    "password": "mock",
    "sync_enabled": true,
    "sync_interval_minutes": 5
  }'
```

### 4. Auto-mapuj użytkowników

```bash
curl -X POST http://localhost:3001/api/racs/sync \
  -H "Content-Type: application/json" \
  -d '{"action": "auto-map"}'
```

Odpowiedź:
```json
{
  "success": true,
  "message": "Auto-mapped X users",
  "result": { "success": true, "mapped": X }
}
```

### 5. Synchronizuj zdarzenia (obecności)

```bash
curl -X POST http://localhost:3001/api/racs/sync \
  -H "Content-Type: application/json" \
  -d '{"action": "sync"}'
```

Odpowiedź:
```json
{
  "success": true,
  "message": "Synchronized X new attendance records",
  "result": {
    "success": true,
    "eventsProcessed": X,
    "eventsCreated": X,
    "eventsSkipped": X
  }
}
```

## 📊 Sprawdź dane

### Pobierz podsumowanie obecności

```bash
curl "http://localhost:3001/api/attendance/summary?month=2026-02"
```

### Pobierz rekordy obecności

```bash
curl "http://localhost:3001/api/attendance?limit=10"
```

### Sprawdź status synchronizacji

```bash
curl "http://localhost:3001/api/racs/sync"
```

## 🎭 Mock dane

Mock server generuje:

### Osoby (dostosuj w pliku jeśli chcesz):
- Jan Kowalski (jan.kowalski@mosir.pl)
- Anna Nowak (anna.nowak@mosir.pl)
- Piotr Wiśniewski (piotr.wisniewski@mosir.pl)
- Maria Wójcik (maria.wojcik@mosir.pl)
- Tomasz Kamiński (tomasz.kaminski@mosir.pl)

### Zdarzenia dostępu:
- Ostatnie 30 dni
- 2-4 zdarzenia dziennie na osobę
- Wejście: 7:30-9:00
- Wyjście: 15:30-17:00
- Losowe spóźnienia/wcześniejsze wyjścia
- Weekendy częściowo pominięte

### Drzwi:
- Wejście główne
- Wejście boczne
- Wejście biuro

## 🔧 Dostosowanie mock danych

Edytuj plik `scripts/mock-racs-server.js`:

```javascript
// Linia ~10 - Dodaj/usuń osoby
const mockPersons = [
  { ID: 1, FirstName: 'Jan', LastName: 'Kowalski', Email: 'jan.kowalski@mosir.pl', Active: true },
  // Dodaj więcej...
];

// Linia ~20 - Dopasuj karty do osób
const mockCredentials = [
  { ID: 101, PersonID: 1, CredentialNumber: '12345678', Active: true },
  // Dodaj więcej...
];

// Linia ~28 - Zmień nazwy drzwi
const mockDoors = [
  { ID: 1, Name: 'Twoja nazwa', AccessPointID: 1 },
  // Dodaj więcej...
];
```

Po zmianach zatrzymaj (Ctrl+C) i uruchom ponownie:
```bash
npm run mock-racs
```

## 🔄 Za tydzień - przełączenie na prawdziwy RACS

Gdy będziesz mieć dostęp do prawdziwego serwera RACS:

1. **Zatrzymaj mock server** (Ctrl+C w terminalu gdzie działa)

2. **Zaktualizuj konfigurację:**

```bash
curl -X POST http://localhost:3001/api/racs/config \
  -H "Content-Type: application/json" \
  -d '{
    "service_url": "http://PRAWDZIWY_IP_RACS:8892",
    "username": "mmaliszewski",
    "password": "1234Qwer!",
    "sync_enabled": true,
    "sync_interval_minutes": 5
  }'
```

3. **Ponownie zmapuj użytkowników:**

```bash
curl -X POST http://localhost:3001/api/racs/sync \
  -H "Content-Type: application/json" \
  -d '{"action": "auto-map"}'
```

4. **Zsynchronizuj prawdziwe zdarzenia:**

```bash
curl -X POST http://localhost:3001/api/racs/sync \
  -H "Content-Type: application/json" \
  -d '{"action": "sync"}'
```

I gotowe! 🎉

## 🐛 Troubleshooting

### Mock server nie startuje - port zajęty

Jeśli prawdziwy RACS działa na porcie 8892:

1. Zmień port w `scripts/mock-racs-server.js`:
   ```javascript
   const PORT = 18892; // Zmień na inny
   ```

2. W konfiguracji użyj:
   ```bash
   "service_url": "http://localhost:18892"
   ```

### Nie ma użytkowników do zmapowania

Mock persons muszą pasować do użytkowników w bazie. Sprawdź:

```bash
# Pobierz użytkowników z bazy (Supabase Dashboard)
SELECT first_name, last_name, email FROM users;
```

Dopasuj mock persons do prawdziwych użytkowników.

### Zdarzenia się nie tworzą

Sprawdź logi w terminalu gdzie działa `npm run dev`. Jeśli błąd o mapowaniach - użytkownicy nie są zmapowani.

## 📚 Co dalej?

- Stwórz grafiki dla użytkowników: `/api/schedules`
- Zobacz UI obecności (gdy będzie gotowe)
- Testuj raporty i statystyki
- Za tydzień podłącz prawdziwy RACS!
