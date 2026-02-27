#!/bin/bash

# Skrypt do dodania zmiennych środowiskowych Fitnet do K8s secret (środowisko DEV)
# Bezpieczny sposób - nie zapisuje haseł w plikach

set -e

echo "🔐 Konfiguracja Fitnet dla K8s (DEV ENVIRONMENT)"
echo "================================================"
echo ""
echo "⚠️  To jest środowisko DEV - do testów!"
echo ""

# Kolory
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Zbierz dane
read -p "FITNET_DB_SERVER (domyślnie: 192.168.3.5\fitnet2): " DB_SERVER
DB_SERVER=${DB_SERVER:-"192.168.3.5\fitnet2"}

read -p "FITNET_DB_NAME (domyślnie: Fitnet): " DB_NAME
DB_NAME=${DB_NAME:-"Fitnet"}

echo ""
echo "Metoda uwierzytelniania:"
echo "1) Windows Authentication"
echo "2) SQL Server Authentication (login/hasło)"
read -p "Wybór (1/2): " AUTH_TYPE

if [ "$AUTH_TYPE" == "1" ]; then
    DB_USER=""
    DB_PASSWORD=""
    USE_WINDOWS_AUTH="true"
else
    read -p "FITNET_DB_USER: " DB_USER
    read -sp "FITNET_DB_PASSWORD: " DB_PASSWORD
    echo ""
    USE_WINDOWS_AUTH="false"
fi

echo ""
echo -e "${YELLOW}📝 Koduję wartości do base64...${NC}"

# Koduj wartości do base64
DB_SERVER_B64=$(echo -n "$DB_SERVER" | base64 -w 0)
DB_NAME_B64=$(echo -n "$DB_NAME" | base64 -w 0)
USE_WINDOWS_AUTH_B64=$(echo -n "$USE_WINDOWS_AUTH" | base64 -w 0)

if [ ! -z "$DB_USER" ]; then
    DB_USER_B64=$(echo -n "$DB_USER" | base64 -w 0)
    DB_PASSWORD_B64=$(echo -n "$DB_PASSWORD" | base64 -w 0)
fi

echo -e "${GREEN}✅ Zakodowano${NC}"
echo ""

# Sprawdź czy secret mosir-portal-env istnieje
echo -e "${YELLOW}🔍 Sprawdzam istniejący secret mosir-portal-env...${NC}"

if kubectl get secret mosir-portal-env -n apps &> /dev/null; then
    echo -e "${GREEN}✅ Secret mosir-portal-env istnieje${NC}"
    echo ""
    echo -e "${YELLOW}📝 Dodaję zmienne Fitnet do mosir-portal-env (DEV)...${NC}"

    # Patch istniejącego secretu
    kubectl patch secret mosir-portal-env -n apps --type='json' -p="[
      {\"op\": \"add\", \"path\": \"/data/FITNET_DB_SERVER\", \"value\": \"$DB_SERVER_B64\"},
      {\"op\": \"add\", \"path\": \"/data/FITNET_DB_NAME\", \"value\": \"$DB_NAME_B64\"},
      {\"op\": \"add\", \"path\": \"/data/FITNET_DB_USE_WINDOWS_AUTH\", \"value\": \"$USE_WINDOWS_AUTH_B64\"}
    ]"

    if [ ! -z "$DB_USER_B64" ]; then
        kubectl patch secret mosir-portal-env -n apps --type='json' -p="[
          {\"op\": \"add\", \"path\": \"/data/FITNET_DB_USER\", \"value\": \"$DB_USER_B64\"},
          {\"op\": \"add\", \"path\": \"/data/FITNET_DB_PASSWORD\", \"value\": \"$DB_PASSWORD_B64\"}
        ]"
    fi

    echo -e "${GREEN}✅ Zmienne Fitnet dodane do mosir-portal-env${NC}"
else
    echo -e "${RED}❌ Secret mosir-portal-env nie istnieje!${NC}"
    echo "Utwórz najpierw podstawowy secret dla aplikacji."
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Konfiguracja DEV zakończona!${NC}"
echo ""
echo "🔄 Następne kroki:"
echo "1. Zbuduj i wdróż nową wersję z tagiem dev"
echo "2. Restart deploymentu: kubectl rollout restart deployment/mosir-portal -n apps"
echo "3. Test połączenia: kubectl exec -n apps deploy/mosir-portal -- curl http://localhost:3000/api/fitnet/test"
echo ""
echo "📋 Sprawdź logi:"
echo "   kubectl logs -n apps -l app=mosir-portal --tail=50 -f"
echo ""
