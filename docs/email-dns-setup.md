# Konfiguracja email: SMTP + DNS (SPF/DKIM/DMARC)

## 0. Gdzie znaleźć dane SMTP? (OVH MX Plan / Zimbra)

### Oficjalna konfiguracja OVH SMTP

Zgodnie z dokumentacją OVH:

**Dla serwerów EUROPE (Polska):**
- **Host SMTP:** `smtp.mail.ovh.net` lub `ssl0.ovh.net`
- **Port:** `465`
- **Typ bezpieczeństwa:** SSL/TLS
- **Login:** pełny adres email (np. `powiadomienia@e-mosir.pl`)
- **Hasło:** hasło do konta email

**Dla serwerów AMERIQUE/ASIE-PACIFIQUE:**
- **Host SMTP:** `smtp.mail.ovh.ca`

### Konfiguracja dla aplikacji:

```env
SMTP_HOST=smtp.mail.ovh.net        # lub ssl0.ovh.net (Europa)
SMTP_PORT=465                      # SSL/TLS (wymagane dla OVH)
SMTP_USER=powiadomienia@e-mosir.pl # pełny adres email
SMTP_PASS=<hasło_do_konta>         # hasło do konta email w OVH
SMTP_FROM=MOSiR Portal <powiadomienia@e-mosir.pl>
```

**Uwaga:** Port `465` wymaga SSL/TLS (nie STARTTLS). Kod automatycznie wykrywa port 465 i używa `secure: true`.

### Utworzenie konta dla powiadomień:

1. Zaloguj się do panelu OVH lub Zimbra
2. Utwórz nowe konto email: `powiadomienia@e-mosir.pl`
3. Ustaw hasło (zapisz je — będzie potrzebne w `SMTP_PASS`)

## 1. Zmienne środowiskowe

Dodaj w `.env.local` (dev) oraz w K8s secret `mosir-portal-env` (produkcja):

```env
SMTP_HOST=mail.e-mosir.pl
SMTP_PORT=587
SMTP_USER=powiadomienia@e-mosir.pl
SMTP_PASS=<hasło>
SMTP_FROM=MOSiR Portal <powiadomienia@e-mosir.pl>

# WhatsApp (opcjonalnie — webhook do n8n)
N8N_WHATSAPP_WEBHOOK_URL=https://n8n.e-mosir.pl/webhook/whatsapp-notification
```

### Aktualizacja K8s secret

```bash
kubectl delete secret mosir-portal-env -n apps
kubectl create secret generic mosir-portal-env \
  --from-env-file=k8s/app/secret.env \
  -n apps
kubectl rollout restart deployment/mosir-portal -n apps
```

## 2. Konfiguracja DNS (anti-spam)

Bez tych rekordów maile z własnego SMTP **wpadną do spamu**. Wszystkie rekordy dodaj w panelu DNS domeny `e-mosir.pl`.

### SPF (Sender Policy Framework)

Rekord TXT na `e-mosir.pl`:

```
v=spf1 ip4:<IP_SERWERA_SMTP> include:_spf.google.com ~all
```

- `ip4:<IP>` — publiczny IP serwera SMTP (zapytaj admina serwera pocztowego).
- `include:_spf.google.com` — tylko jeśli używasz Google Workspace do maili; jeśli nie, pomiń.
- `~all` — soft fail dla nieznanych źródeł.

### DKIM (DomainKeys Identified Mail)

Rekord TXT — dane z serwera SMTP:

```
<selector>._domainkey.e-mosir.pl  TXT  "v=DKIM1; k=rsa; p=<KLUCZ_PUBLICZNY>"
```

- `<selector>` — dostarczony przez admina SMTP (np. `default`, `mail`, `s1`).
- `<KLUCZ_PUBLICZNY>` — klucz publiczny RSA z konfiguracji serwera SMTP.

### DMARC (Domain-based Message Authentication)

Rekord TXT na `_dmarc.e-mosir.pl`:

```
v=DMARC1; p=quarantine; rua=mailto:admin@e-mosir.pl; pct=100
```

- `p=quarantine` — maile bez SPF/DKIM trafiają do spamu.
- `rua=mailto:...` — adres do raportów DMARC (opcjonalnie, ale przydatne).
- Po stabilizacji zmień na `p=reject`.

## 3. Checklist

- [ ] SMTP działa: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` ustawione
- [ ] SPF record dodany w DNS
- [ ] DKIM record dodany w DNS (klucz od admina SMTP)
- [ ] DMARC record dodany w DNS
- [ ] Test wysyłki: włącz powiadomienia email w profilu → wyślij testowe powiadomienie
- [ ] Sprawdź nagłówki emaila (Gmail → "Pokaż oryginał"): SPF=pass, DKIM=pass, DMARC=pass

## 4. Narzędzia do testowania

- [mail-tester.com](https://www.mail-tester.com/) — wyślij testowy mail, sprawdź score
- [mxtoolbox.com/dmarc](https://mxtoolbox.com/dmarc.aspx) — sprawdź rekordy DNS
- [dmarcian.com/dmarc-inspector](https://dmarcian.com/dmarc-inspector/) — analiza DMARC

## 5. WhatsApp (przez n8n)

1. W n8n utwórz workflow:
   - Trigger: **Webhook** (`POST /webhook/whatsapp-notification`)
   - Node: **WhatsApp Business Cloud API** (lub Twilio WhatsApp)
   - Payload: `{ phone, title, message, task_url }`

2. Aktywuj workflow i skopiuj URL webhooka.

3. Ustaw `N8N_WHATSAPP_WEBHOOK_URL` w env.

## 6. Migracja SQL

Przed pierwszym użyciem uruchom w Supabase SQL Editor:

```
SQL/migration-notification-preferences.sql
```

Tworzy tabelę `notification_preferences` z RLS i funkcję `get_notification_preferences()`.
