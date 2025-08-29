# System Powiadomień - MOSiR Portal

## Przegląd

System powiadomień w MOSiR Portal został zaprojektowany zgodnie z najlepszymi standardami UX/UI i zapewnia użytkownikom natychmiastowe informacje o ważnych zdarzeniach w systemie.

## Funkcjonalności

### 🎯 Typy powiadomień
- **Success** - operacje zakończone pomyślnie
- **Error** - błędy i problemy
- **Warning** - ostrzeżenia i uwagi
- **Info** - informacje ogólne

### 🔔 Kanały powiadomień
1. **Toast Notifications** - krótkie powiadomienia w prawym górnym rogu
2. **Notification Bell** - dzwonek powiadomień w headerze z licznikiem nieprzeczytanych
3. **Real-time Updates** - powiadomienia w czasie rzeczywistym via Supabase Realtime

## Architektura

### Komponenty
```
components/
├── ui/
│   ├── toast.tsx          # Podstawowy komponent toast
│   └── toaster.tsx        # Kontener dla toast notifications
├── notifications/
│   ├── NotificationManager.tsx    # Zarządzanie powiadomieniami
│   └── NotificationBell.tsx       # Dzwonek powiadomień w headerze
```

### Hooki
```
hooks/
├── useToast.ts            # Hook do zarządzania toast
└── useNotifications.ts    # Hook z gotowymi funkcjami powiadomień
```

### Baza danych
```
database/
└── notifications.sql      # Struktura tabeli i funkcje SQL
```

## Użycie

### Podstawowe powiadomienia

```tsx
import { useNotifications } from '@/hooks/useNotifications'

function MyComponent() {
  const { showSuccess, showError, showWarning, showInfo } = useNotifications()

  const handleSuccess = () => {
    showSuccess('Sukces!', 'Operacja została wykonana pomyślnie')
  }

  const handleError = () => {
    showError('Błąd!', 'Wystąpił problem podczas operacji')
  }

  return (
    <div>
      <button onClick={handleSuccess}>Pokaż sukces</button>
      <button onClick={handleError}>Pokaż błąd</button>
    </div>
  )
}
```

### Specjalistyczne powiadomienia

```tsx
const { 
  showTaskCreated, 
  showTaskUpdated, 
  showUserCreated 
} = useNotifications()

// Powiadomienie o utworzeniu zadania
showTaskCreated('Nazwa zadania', 'task-id-123')

// Powiadomienie o aktualizacji zadania
showTaskUpdated('Nazwa zadania', 'task-id-123')

// Powiadomienie o utworzeniu użytkownika
showUserCreated('Jan Kowalski')
```

### Bezpośrednie użycie toast

```tsx
import { useToast } from '@/hooks/useToast'

function MyComponent() {
  const { toast } = useToast()

  const showCustomToast = () => {
    toast({
      title: 'Własny tytuł',
      description: 'Własny opis',
      variant: 'info',
      duration: 5000,
      action: (
        <button onClick={() => console.log('Akcja')}>
          Wykonaj akcję
        </button>
      ),
    })
  }

  return <button onClick={showCustomToast}>Pokaż toast</button>
}
```

## Konfiguracja

### Czas wyświetlania
- **Success**: 4 sekundy (domyślnie)
- **Error**: 6 sekund (domyślnie)
- **Warning**: 5 sekund (domyślnie)
- **Info**: 4 sekundy (domyślnie)

### Pozycjonowanie
- **Desktop**: Prawy górny róg
- **Mobile**: Górna część ekranu
- **Z-index**: 100 (najwyższy priorytet)

## Integracja z Supabase

### Realtime Notifications
System automatycznie nasłuchuje na zmiany w tabeli `notifications` i wyświetla powiadomienia w czasie rzeczywistym.

### Automatyczne powiadomienia
- Nowe zadania
- Zmiany statusu zadań
- Aktualizacje użytkowników
- Operacje na plikach

## Dostosowywanie

### Nowe typy powiadomień
1. Dodaj nowy typ w `toastVariants` w `components/ui/toast.tsx`
2. Dodaj odpowiednią funkcję w `hooks/useNotifications.ts`
3. Zaktualizuj typy w `types/database.ts`

### Nowe funkcje powiadomień
```tsx
// W hooks/useNotifications.ts
const showCustomNotification = (data: any) => {
  toast({
    title: 'Tytuł',
    description: 'Opis',
    variant: 'info',
    duration: 4000,
    action: (
      <button onClick={() => handleAction(data)}>
        Akcja
      </button>
    ),
  })
}
```

## Najlepsze praktyki

### ✅ Zalecane
- Używaj predefiniowanych funkcji z `useNotifications`
- Dostosowuj czas wyświetlania do typu powiadomienia
- Dodawaj akcje do ważnych powiadomień
- Grupuj powiadomienia logicznie

### ❌ Unikaj
- Zbyt wielu powiadomień jednocześnie
- Długich opisów w toast notifications
- Powiadomień bez akcji dla ważnych zdarzeń
- Ignorowania błędów użytkownika

## Testowanie

### Testowanie toast
```tsx
// W komponencie testowym
const { showSuccess, showError } = useNotifications()

// Test różnych typów
showSuccess('Test', 'To jest test sukcesu')
showError('Test', 'To jest test błędu')
```

### Testowanie NotificationBell
```tsx
// Sprawdź czy dzwonek wyświetla się
// Sprawdź licznik nieprzeczytanych
// Sprawdź dropdown z powiadomieniami
```

## Rozwiązywanie problemów

### Powiadomienia się nie wyświetlają
1. Sprawdź czy `Toaster` jest dodany do layoutu
2. Sprawdź czy `NotificationManager` jest aktywny
3. Sprawdź konsolę przeglądarki pod kątem błędów

### Błąd z Supabase
1. Sprawdź połączenie z bazą danych
2. Sprawdź uprawnienia RLS
3. Sprawdź logi Supabase

### Problemy z wydajnością
1. Ogranicz liczbę jednoczesnych powiadomień
2. Użyj `useCallback` dla funkcji powiadomień
3. Sprawdź czy nie ma memory leaks w useEffect

## Przyszłe rozszerzenia

- [ ] Powiadomienia email
- [ ] Powiadomienia push (Push API)
- [ ] Powiadomienia SMS
- [ ] Kategorie powiadomień
- [ ] Preferencje użytkownika
- [ ] Historia powiadomień
- [ ] Eksport powiadomień
- [ ] Integracja z kalendarzem




