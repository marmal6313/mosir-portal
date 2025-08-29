# Konfiguracja systemu MOSiR Portal

## Przegląd

System został rozszerzony o możliwość konfiguracji ikony MOSiR bezpośrednio z poziomu interfejsu użytkownika. Dyrektor@e-mosir.pl otrzymał rolę superadmina, która umożliwia dostęp do panelu ustawień systemu.

## Nowe funkcjonalności

### 1. Konfigurowalna ikona MOSiR
- Ikona w lewym panelu nawigacyjnym może być zmieniona bez edycji kodu
- Obsługuje formaty: SVG, PNG, JPG
- Automatyczny fallback do domyślnej ikony w przypadku błędu ładowania

### 2. Panel ustawień systemu
- Dostępny tylko dla użytkowników z rolą `superadmin`
- Możliwość zmiany:
  - Ścieżki do logo MOSiR
  - Nazwy systemu
  - Nazwy firmy/organizacji
- Podgląd logo przed zapisaniem

### 3. Rola superadmina
- Użytkownik `dyrektor@e-mosir.pl` ma teraz pełne uprawnienia administracyjne
- Może zarządzać wszystkimi ustawieniami systemu

## Instrukcja konfiguracji

### Krok 1: Wykonanie skryptu SQL
1. Otwórz Supabase Dashboard
2. Przejdź do SQL Editor
3. Skopiuj i wklej zawartość pliku `database-setup.sql`
4. Wykonaj skrypt

### Krok 2: Uruchomienie aplikacji
```bash
# Zatrzymaj wszystkie procesy
pkill -f "next-server"
pkill -f "npm"

# Wyczyść cache
rm -rf .next

# Przebuduj projekt
npm run build

# Uruchom serwer
npm start
```

### Krok 3: Logowanie jako superadmin
1. Zaloguj się na konto `dyrektor@e-mosir.pl`
2. W lewym panelu nawigacyjnym pojawi się nowa zakładka "Ustawienia"
3. Kliknij "Ustawienia"

### Krok 4: Konfiguracja ikony
1. W sekcji "Logo MOSiR" wprowadź ścieżkę do nowej ikony
2. Możliwe opcje:
   - `/images/mosir-logo.png` - dla pliku PNG w folderze public/images
   - `/custom-logo.svg` - dla pliku SVG w folderze public
   - `https://example.com/logo.png` - dla zewnętrznego URL
3. Użyj przycisku "Oko" aby zobaczyć podgląd
4. Zmiany są zapisywane automatycznie

## Struktura plików

### Nowe pliki
- `app/dashboard/settings/page.tsx` - Strona ustawień systemu
- `database-setup.sql` - Skrypt konfiguracji bazy danych
- `README-SETTINGS.md` - Ta dokumentacja

### Zmodyfikowane pliki
- `types/database.ts` - Dodana tabela `system_settings`
- `components/layouts/Sidebar.tsx` - Konfigurowalna ikona i nazwy
- `components/ui/card.tsx` - Komponenty UI dla strony ustawień

## Baza danych

### Tabela system_settings
```sql
CREATE TABLE system_settings (
    id UUID PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    value TEXT,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE,
    updated_by UUID REFERENCES users(id)
);
```

### Domyślne ustawienia
- `mosir_logo`: `/mosir-logo.svg`
- `system_name`: `MOSiR Portal`
- `company_name`: `MOSiR`

## Bezpieczeństwo

- Dostęp do ustawień systemu mają tylko użytkownicy z rolą `superadmin`
- Wszystkie zmiany są logowane (kto i kiedy zmienił)
- Walidacja typów plików i ścieżek

## Rozwiązywanie problemów

### Ikona się nie wyświetla
1. Sprawdź czy ścieżka jest poprawna
2. Upewnij się, że plik istnieje w folderze `public`
3. Sprawdź konsolę przeglądarki pod kątem błędów 404

### Błąd dostępu do ustawień
1. Sprawdź czy użytkownik ma rolę `superadmin`
2. Wykonaj ponownie skrypt SQL
3. Wyloguj się i zaloguj ponownie

### Zmiany nie są widoczne
1. Odśwież stronę (Ctrl+F5)
2. Sprawdź czy nie ma błędów w konsoli
3. Sprawdź czy ustawienia zostały zapisane w bazie danych

## Rozszerzenia

System można łatwo rozszerzyć o dodatkowe ustawienia:
1. Dodaj nowy klucz w tabeli `system_settings`
2. Zaktualizuj interfejs w `app/dashboard/settings/page.tsx`
3. Dodaj logikę w odpowiednich komponentach

## Wsparcie

W przypadku problemów:
1. Sprawdź logi w konsoli przeglądarki
2. Sprawdź logi Supabase
3. Upewnij się, że wszystkie pliki zostały poprawnie utworzone







