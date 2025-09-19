# Kanały komunikacji między działami

Ten dokument opisuje, jak uruchomić nowy moduł kanałów komunikacyjnych w projekcie MOSiR Portal. Moduł umożliwia tworzenie kanałów podobnych do Slacka, w których zespoły mogą wymieniać wiadomości w ramach wybranych działów lub globalnie dla całej organizacji.

## 1. Migracja schematu bazy danych

1. Zaloguj się do panelu Supabase i otwórz zakładkę **SQL**.
2. Wklej zawartość pliku [`database/communication_channels.sql`](../database/communication_channels.sql) do edytora i uruchom zapytanie. Skrypt utworzy cztery tabele:
   - `communication_channels` – definicje kanałów wraz z metadanymi,
   - `channel_departments` – powiązania kanałów z działami,
   - `channel_messages` – wiadomości publikowane w kanałach,
   - `channel_message_mentions` – wzmianki użytkowników w konkretnych wiadomościach.
   Jeśli uruchamiałeś wcześniejszą wersję skryptu, odpal go ponownie – zaktualizowane funkcje i polityki RLS eliminują błąd `42P17 (infinite recursion detected in policy for relation "channel_departments")`.
3. Skrypt włącza polityki RLS. Upewnij się, że *Authentication → Policies* pokazuje nowo dodane reguły. Jeśli potrzebujesz bardziej restrykcyjnych zasad (np. prywatne kanały, ręczne zapraszanie użytkowników), rozbuduj polityki przed wdrożeniem na produkcję.
4. Skrypt dodaje również funkcje RPC `create_channel` oraz `create_channel_message`, których używa frontend. W zakładce **Database → Functions** sprawdź, czy obie funkcje istnieją i mają przyznane uprawnienia dla roli `authenticated`.

> **Wskazówka:** jeżeli korzystasz z `supabase db push`, dodaj powyższy plik SQL do procesu migracji lub przenieś definicje do dedykowanego katalogu migracji.

## 2. Wymagane uprawnienia użytkowników

Polityki RLS zakładają, że każdy użytkownik posiada rekord w tabeli `public.users` z wypełnionym `department_id`. Na tej podstawie system decyduje, do których kanałów ma dostęp (`public` – wszyscy, `restricted` – tylko wskazane działy).

Upewnij się, że w procesie onboardingu nowy użytkownik zawsze otrzymuje przypisanie do działu. W przeciwnym razie zobaczy tylko kanały globalne.

## 3. Sprzątanie danych testowych

Dla środowiska developerskiego możesz dodać kilka przykładowych kanałów:

```sql
INSERT INTO communication_channels (name, description, visibility, created_by)
SELECT 'Kanał ogólny', 'Otwarty kanał dyskusyjny dla wszystkich', 'public', id
FROM users
WHERE email = 'twoj.superadmin@mosir.pl'
LIMIT 1;

INSERT INTO communication_channels (name, description, visibility, created_by)
SELECT 'Akcje specjalne', 'Wspólna tablica dla działów Marketing i Eventy', 'restricted', id
FROM users
WHERE email = 'twoj.superadmin@mosir.pl'
LIMIT 1;
```

Następnie przypisz działy do kanału ograniczonego:

```sql
WITH kanał AS (
  SELECT id FROM communication_channels WHERE name = 'Akcje specjalne'
)
INSERT INTO channel_departments (channel_id, department_id)
SELECT kanał.id, d.id
FROM kanał
JOIN departments d ON d.name IN ('Marketing', 'Eventy');
```

## 4. Kontrola dostępu w aplikacji

Frontend korzysta z nowego API Supabase, dlatego przed wdrożeniem na produkcję sprawdź:

- Czy użytkownicy z różnych działów widzą tylko kanały do których mają dostęp.
- Czy wysyłanie wiadomości działa w czasie rzeczywistym (Supabase Realtime) i poprawnie odświeża listę kanałów / ostatniej wiadomości.
- Czy archiwizacja kanału (`is_archived`) działa zgodnie z oczekiwaniami – plik SQL zawiera tylko kolumnę, logika archiwizacji znajduje się w kodzie Next.js.
- Czy RPC `create_channel` tworzy kanały i przypisuje działy zgodnie z widocznością.
- Czy RPC `create_channel_message` zapisuje wiadomości, wzmianki oraz wysyła powiadomienia.

Po wykonaniu powyższych kroków moduł kanałów komunikacyjnych będzie gotowy do użycia.
