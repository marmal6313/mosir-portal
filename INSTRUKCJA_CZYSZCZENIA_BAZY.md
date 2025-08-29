# Instrukcja czyszczenia bazy danych MOSiR Portal i włączenia RLS

## 🚨 UWAGA: To jest nieodwracalna operacja!

**Przed rozpoczęciem:**
- Upewnij się, że masz kopię zapasową bazy danych
- Upewnij się, że aplikacja nie jest używana przez użytkowników
- Wszystkie dane zadań zostaną utracone

## 📋 Kolejność wykonywania

### Krok 1: Sprawdzenie aktualnego stanu bazy
1. Otwórz **Supabase Dashboard**
2. Przejdź do **SQL Editor**
3. Skopiuj i wklej zawartość pliku `check_views.sql`
4. Uruchom skrypt
5. **Zapisz wyniki** - będą potrzebne do analizy

### Krok 2: Czyszczenie bazy danych
1. W **SQL Editor** skopiuj i wklej zawartość pliku `cleanup_database.sql`
2. **Uruchom skrypt** - to usunie wszystkie zadania
3. Sprawdź wyniki - powinny pokazać 0 zadań

### Krok 3: Sprawdzenie widoków po czyszczeniu
1. Ponownie uruchom `check_views.sql`
2. Sprawdź czy widoki są puste
3. Sprawdź czy nie ma błędów

### Krok 4: Włączenie RLS
1. W **SQL Editor** skopiuj i wklej zawartość pliku `enable_rls.sql`
2. **Uruchom skrypt** - to włączy RLS i utworzy polityki
3. Sprawdź wyniki - RLS powinno być włączone

### Krok 5: Testowanie
1. Sprawdź czy aplikacja działa
2. Spróbuj utworzyć nowe zadanie
3. Sprawdź czy RLS działa poprawnie

## 🔍 Co robią skrypty

### `check_views.sql`
- Sprawdza definicje widoków
- Sprawdza strukturę tabel
- Sprawdza relacje i klucze obce
- Testuje działanie widoków

### `cleanup_database.sql`
- **Usuwa wszystkie zadania** z tabeli `tasks`
- Usuwa powiadomienia związane z zadaniami
- Sprawdza stan po usunięciu
- Analizuje relacje i uprawnienia

### `enable_rls.sql`
- Włącza RLS na wszystkich tabelach
- Tworzy polityki bezpieczeństwa
- Ustawia uprawnienia dla użytkowników
- Sprawdza czy RLS działa

## 🛡️ Polityki RLS

Po włączeniu RLS:
- **Użytkownicy widzą tylko zadania ze swojego działu**
- **Mogą tworzyć/edytować zadania tylko w swoim dziale**
- **Widzą tylko osoby ze swojego działu**
- **Dostęp do danych jest ograniczony według roli i działu**

## ⚠️ Potencjalne problemy

### Jeśli widoki mają błędy:
1. Sprawdź definicje widoków
2. Może być konieczne ich odtworzenie
3. Sprawdź relacje między tabelami

### Jeśli RLS nie działa:
1. Sprawdź czy polityki zostały utworzone
2. Sprawdź uprawnienia użytkowników
3. Sprawdź czy auth.uid() zwraca poprawną wartość

### Jeśli aplikacja nie działa:
1. Sprawdź logi błędów
2. Sprawdź czy widoki zwracają dane
3. Sprawdź czy RLS nie blokuje dostępu

## 🔄 Po zakończeniu

1. **Utwórz nowe zadania** z poprawnymi danymi
2. **Sprawdź czy RLS działa** - użytkownicy powinni widzieć tylko swoje dane
3. **Przetestuj aplikację** - wszystkie funkcje powinny działać
4. **Monitoruj logi** - sprawdź czy nie ma błędów

## 📞 Wsparcie

Jeśli coś pójdzie nie tak:
1. Sprawdź logi w Supabase
2. Sprawdź wyniki skryptów
3. Może być konieczne przywrócenie z kopii zapasowej

## 📝 Notatki

- **Data wykonania:** _____________
- **Wykonane przez:** _____________
- **Wyniki:** _____________
- **Problemy:** _____________
- **Rozwiązania:** _____________

