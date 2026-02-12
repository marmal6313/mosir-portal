Supabase — CORS i URL (app.e-mosir.pl)
======================================

Cel: zapewnić działające REST/Realtime (brak błędów CORS/WS w przeglądarce).

Wymagane wartości
-----------------
- Site URL: `https://app.e-mosir.pl`
- Redirect URLs: `https://app.e-mosir.pl` (jeśli lista jest pusta)
- Allowed CORS origins: `https://app.e-mosir.pl`

Kroki w panelu Supabase
-----------------------
1) Settings → Authentication → URL Configuration:
   - Site URL: ustaw `https://app.e-mosir.pl` (zapisz).
   - Redirect URLs: dodaj `https://app.e-mosir.pl` (zapisz).
2) Settings → API → Config:
   - Allowed CORS origins: dodaj `https://app.e-mosir.pl` (zapisz).

Uwagi
-----
- Zawsze używaj protokołu https (nie http), inaczej Supabase traktuje połączenie jako obce i blokuje preflight/WS.
- Po zmianach najlepiej odświeżyć aplikację w trybie prywatnym, aby wyczyścić stare sesje/cashe.
- Jeśli UI nie pokazuje pola CORS, możesz ustawić je w SQL (Supabase SQL editor):
  ```sql
  alter database postgres set "pgrst.db_allow_origin" = 'https://app.e-mosir.pl';
  ```
  Po zapisaniu odczekaj chwilę i przetestuj w incognito.
