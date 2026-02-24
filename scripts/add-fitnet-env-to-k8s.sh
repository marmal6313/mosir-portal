#!/bin/bash

# Skrypt do dodania zmiennych środowiskowych Fitnet do K8s secret
# Bezpieczny sposób - nie zapisuje haseł w plikach

set -e

echo "🔐 Konfiguracja Fitnet dla K8s"
echo "=============================="
echo ""

# Kolory
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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
DB_SERVER_B64=$(echo -n "$DB_SERVER" | base64)
DB_NAME_B64=$(echo -n "$DB_NAME" | base64)
USE_WINDOWS_AUTH_B64=$(echo -n "$USE_WINDOWS_AUTH" | base64)

if [ ! -z "$DB_USER" ]; then
    DB_USER_B64=$(echo -n "$DB_USER" | base64)
    DB_PASSWORD_B64=$(echo -n "$DB_PASSWORD" | base64)
else
    DB_USER_B64=""
    DB_PASSWORD_B64=""
fi

echo -e "${GREEN}✅ Zakodowano${NC}"
echo ""

# Sprawdź czy secret mosir-portal-env istnieje
echo -e "${YELLOW}🔍 Sprawdzam istniejący secret mosir-portal-env...${NC}"

if kubectl get secret mosir-portal-env -n apps &> /dev/null; then
    echo -e "${GREEN}✅ Secret mosir-portal-env istnieje${NC}"
    echo ""
    echo "Co chcesz zrobić?"
    echo "1) Dodać zmienne Fitnet do istniejącego secretu (ZALECANE)"
    echo "2) Utworzyć nowy secret mosir-portal-fitnet"
    read -p "Wybór (1/2): " SECRET_OPTION

    if [ "$SECRET_OPTION" == "1" ]; then
        echo ""
        echo -e "${YELLOW}📝 Dodaję zmienne Fitnet do mosir-portal-env...${NC}"

        # Patch istniejącego secretu
        kubectl patch secret mosir-portal-env -n apps --type='json' -p='[
          {"op": "add", "path": "/data/FITNET_DB_SERVER", "value": "'$DB_SERVER_B64'"},
          {"op": "add", "path": "/data/FITNET_DB_NAME", "value": "'$DB_NAME_B64'"},
          {"op": "add", "path": "/data/FITNET_DB_USE_WINDOWS_AUTH", "value": "'$USE_WINDOWS_AUTH_B64'"}
        ]'

        if [ ! -z "$DB_USER_B64" ]; then
            kubectl patch secret mosir-portal-env -n apps --type='json' -p='[
              {"op": "add", "path": "/data/FITNET_DB_USER", "value": "'$DB_USER_B64'"},
              {"op": "add", "path": "/data/FITNET_DB_PASSWORD", "value": "'$DB_PASSWORD_B64'"}
            ]'
        fi

        echo -e "${GREEN}✅ Zmienne Fitnet dodane do mosir-portal-env${NC}"
    else
        # Utwórz nowy secret
        echo ""
        echo -e "${YELLOW}📝 Tworzę nowy secret mosir-portal-fitnet...${NC}"

        if [ ! -z "$DB_USER_B64" ]; then
            kubectl create secret generic mosir-portal-fitnet -n apps \
              --from-literal=FITNET_DB_SERVER=$DB_SERVER \
              --from-literal=FITNET_DB_NAME=$DB_NAME \
              --from-literal=FITNET_DB_USER=$DB_USER \
              --from-literal=FITNET_DB_PASSWORD=$DB_PASSWORD \
              --from-literal=FITNET_DB_USE_WINDOWS_AUTH=$USE_WINDOWS_AUTH
        else
            kubectl create secret generic mosir-portal-fitnet -n apps \
              --from-literal=FITNET_DB_SERVER=$DB_SERVER \
              --from-literal=FITNET_DB_NAME=$DB_NAME \
              --from-literal=FITNET_DB_USE_WINDOWS_AUTH=$USE_WINDOWS_AUTH
        fi

        echo -e "${GREEN}✅ Secret mosir-portal-fitnet utworzony${NC}"
        echo ""
        echo -e "${YELLOW}⚠️  WAŻNE: Musisz dodać ten secret do deployment.yaml:${NC}"
        echo ""
        echo "envFrom:"
        echo "  - secretRef:"
        echo "      name: mosir-portal-env"
        echo "  - secretRef:"
        echo "      name: mosir-portal-fitnet  # <-- dodaj tę linię"
        echo ""
    fi
else
    echo -e "${YELLOW}⚠️  Secret mosir-portal-env nie istnieje${NC}"
    echo -e "${YELLOW}📝 Tworzę nowy secret mosir-portal-fitnet...${NC}"

    kubectl create secret generic mosir-portal-fitnet -n apps \
      --from-literal=FITNET_DB_SERVER=$DB_SERVER \
      --from-literal=FITNET_DB_NAME=$DB_NAME \
      --from-literal=FITNET_DB_USER=$DB_USER \
      --from-literal=FITNET_DB_PASSWORD=$DB_PASSWORD \
      --from-literal=FITNET_DB_USE_WINDOWS_AUTH=$USE_WINDOWS_AUTH

    echo -e "${GREEN}✅ Secret mosir-portal-fitnet utworzony${NC}"
fi

echo ""
echo -e "${GREEN}✅ Konfiguracja zakończona!${NC}"
echo ""
echo "🔄 Następne kroki:"
echo "1. Restart deploymentu: kubectl rollout restart deployment/mosir-portal -n apps"
echo "2. Test połączenia: curl https://app.e-mosir.pl/api/fitnet/test"
echo ""
echo "📊 Zobacz zmienne:"
echo "   kubectl get secret mosir-portal-env -n apps -o yaml"
echo ""
