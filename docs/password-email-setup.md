# Konfiguracja haseł i poczty w Supabase

Ten dokument opisuje pełen proces przygotowania obsługi zmiany hasła w aplikacji MOSiR Portal, konfiguracji projektu Supabase oraz ustawienia własnego adresu e-mail, z którego będą wysyłane powiadomienia (np. linki resetu hasła).

## 1. Wymagane zmienne środowiskowe

Upewnij się, że w pliku `.env.local` (lub odpowiednim pliku środowiskowym używanym w produkcji) znajdują się następujące wpisy. Wartości znajdziesz w panelu Supabase → Project Settings → API.

```env
NEXT_PUBLIC_SUPABASE_URL="https://<twoj-projekt>.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="<anon-key>"
SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"

# adres produkcyjny aplikacji wykorzystywany w linkach resetu hasła
NEXT_PUBLIC_SITE_URL="https://portal.twojadomena.pl"
```

Po zapisaniu zmian zrestartuj środowisko developerskie (`npm run dev`) lub ponownie wypchnij zmienne do serwera/CI.

## 2. Konfiguracja resetu i zmiany hasła

1. Zaloguj się do Supabase i przejdź do **Authentication → URL Configuration**. Ustaw:
   - `Site URL` na publiczny adres aplikacji (np. `https://portal.twojadomena.pl`). Supabase wykorzystuje tę wartość podczas generowania linków resetu hasła.
   - (Opcjonalnie) `Redirect URL` jeśli chcesz wymusić konkretny adres po zalogowaniu.
2. W **Authentication → Providers → Email** włącz logowanie/hasła (powinno być już domyślnie aktywne) i upewnij się, że zaznaczona jest opcja wysyłania e-maili resetujących.
3. W aplikacji (strona `Mój profil`) użytkownik może teraz:
   - Zweryfikować aktualne hasło (podaje obecne).
   - Wprowadzić nowe hasło oraz potwierdzenie.
   - Po poprawnej weryfikacji formularz korzysta z `supabase.auth.updateUser`, więc cały proces jest realizowany bez udziału administratora.

## 3. Własny nadawca wiadomości e-mail

Domyślnie Supabase wysyła e-maile z domeny `supabase.com`. Aby używać własnego adresu (np. `no-reply@twojadomena.pl`):

1. Wejdź w **Authentication → Email Templates** i zapoznaj się z treściami wysyłanych wiadomości. Możesz je dostosować do brandingu MOSiR.
2. Przejdź do **Authentication → SMTP Settings** i wybierz jedną z dwóch opcji:
   - **Konto SMTP (rekomendowane)** – wprowadź dane serwera pocztowego (host, port, login, hasło) dostarczone przez Twojego operatora poczty. Ustal również `Sender name` i `Sender email` (np. `MOSiR Portal`, `no-reply@twojadomena.pl`).
   - **Supabase Email (default)** – jeśli nie masz własnego SMTP, Supabase może nadal wysyłać wiadomości, ale będą podpisane jako `no-reply@supabase.com`.
3. Po zapisaniu ustawień wyślij e-mail testowy (przycisk „Send Test Email”), aby zweryfikować konfigurację.
4. Jeśli używasz własnego SMTP, pamiętaj o:
   - Dodaniu rekordów SPF/DKIM/DMARC w DNS, aby zwiększyć dostarczalność.
   - Sprawdzeniu, czy konto mailowe ma włączony „dostęp dla aplikacji” lub wygenerowane hasło aplikacji (w zależności od dostawcy).

## 4. Dodatkowe wskazówki bezpieczeństwa

- Wymuszaj silne hasła (co najmniej 8 znaków, zalecane kombinacje liter, cyfr i znaków specjalnych).
- Rozważ włączenie `Email OTP` w Supabase, aby korzystać z jednorazowych kodów logowania w krytycznych działaniach administracyjnych.
- Regularnie monitoruj zakładkę **Authentication → Logs** w Supabase – znajdziesz tam informacje o błędach wysyłki e-maili lub nieudanych resetach.

## 5. Test końcowy

Po wprowadzeniu zmian wykonaj test „end-to-end”:

1. Zaloguj się jako użytkownik i uruchom formularz „Zmiana hasła” w profilu.
2. Spróbuj wprowadzić błędne aktualne hasło – aplikacja powinna wyświetlić ostrzeżenie.
3. Wprowadź nowe hasło i upewnij się, że komunikat potwierdza sukces.
4. Wyloguj się i zaloguj ponownie, używając nowego hasła.
5. Skorzystaj z opcji „Nie pamiętam hasła” na ekranie logowania – potwierdź, że link resetu przychodzi z Twojego nadawcy SMTP.

Po przejściu powyższych kroków konfiguracja jest kompletna, a użytkownicy MOSiR Portal mogą samodzielnie resetować i zmieniać swoje hasła, korzystając z wysyłki e-mail z własnej domeny.
