#!/bin/bash

# Skrypt pomocniczy do uruchomienia inspekcji bazy Fitnet z poda mosir-virtual
# WAŻNE: Ten skrypt automatyzuje proces inspekcji bazy Fitnet

set -e

echo "🚀 FITNET DATABASE INSPECTOR - K8S Runner"
echo "=========================================="
echo ""

# Kolory
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Sprawdź czy mosir-virtual deployment istnieje
echo "📡 Sprawdzam czy deployment mosir-virtual istnieje..."
if ! kubectl get deployment mosir-virtual -n apps &> /dev/null; then
    echo -e "${RED}❌ Deployment mosir-virtual nie istnieje w namespace apps${NC}"
    echo ""
    echo "💡 Dostępne deploymenty w namespace apps:"
    kubectl get deployments -n apps
    echo ""
    echo "Czy chcesz użyć deployment mosir-portal zamiast mosir-virtual? (ten deployment ma dostęp do sieci MOSiR)"
    read -p "Użyć mosir-portal? (y/n): " use_portal

    if [[ "$use_portal" == "y" || "$use_portal" == "Y" ]]; then
        DEPLOYMENT="mosir-portal"
    else
        echo -e "${RED}Przerwano.${NC}"
        exit 1
    fi
else
    DEPLOYMENT="mosir-virtual"
fi

echo -e "${GREEN}✅ Znaleziono deployment: $DEPLOYMENT${NC}"
echo ""

# Pobierz nazwę poda
echo "🔍 Pobieram nazwę poda..."
POD_NAME=$(kubectl get pods -n apps -l app=$DEPLOYMENT -o jsonpath='{.items[0].metadata.name}')

if [ -z "$POD_NAME" ]; then
    echo -e "${RED}❌ Nie znaleziono aktywnego poda dla deployment $DEPLOYMENT${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Pod: $POD_NAME${NC}"
echo ""

# Pytaj o dane dostępowe
echo "🔐 Konfiguracja połączenia do bazy Fitnet"
echo "=========================================="
echo ""

read -p "Nazwa bazy danych (domyślnie: Fitnet): " DB_NAME
DB_NAME=${DB_NAME:-Fitnet}

echo ""
echo "Wybierz metodę uwierzytelniania:"
echo "1) Windows Authentication (domyślnie)"
echo "2) SQL Server Authentication (user/password)"
read -p "Wybór (1/2): " AUTH_TYPE
AUTH_TYPE=${AUTH_TYPE:-1}

if [ "$AUTH_TYPE" == "2" ]; then
    read -p "Username: " DB_USER
    read -sp "Password: " DB_PASSWORD
    echo ""
    USE_WINDOWS_AUTH="false"
else
    DB_USER=""
    DB_PASSWORD=""
    USE_WINDOWS_AUTH="true"
fi

echo ""
echo -e "${YELLOW}⚙️  Kopiuję skrypt do poda...${NC}"

# Skopiuj skrypt do poda
kubectl cp scripts/inspect-fitnet-db.js apps/$POD_NAME:/tmp/inspect-fitnet-db.js

echo -e "${GREEN}✅ Skrypt skopiowany${NC}"
echo ""

# Uruchom skrypt w podzie
echo -e "${YELLOW}🔧 Instaluję mssql w podzie...${NC}"
kubectl exec -n apps $POD_NAME -- npm install mssql 2>&1 | grep -v "npm WARN" || true

echo ""
echo -e "${YELLOW}🚀 Uruchamiam inspekcję bazy Fitnet...${NC}"
echo ""

# Przygotuj zmienne środowiskowe
ENV_VARS="FITNET_DB_NAME=$DB_NAME FITNET_DB_USE_WINDOWS_AUTH=$USE_WINDOWS_AUTH"
if [ ! -z "$DB_USER" ]; then
    ENV_VARS="$ENV_VARS FITNET_DB_USER=$DB_USER FITNET_DB_PASSWORD=$DB_PASSWORD"
fi

# Uruchom skrypt
kubectl exec -n apps $POD_NAME -- sh -c "$ENV_VARS node /tmp/inspect-fitnet-db.js" > ./fitnet-structure.txt 2>&1

echo ""
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Inspekcja zakończona pomyślnie!${NC}"
    echo ""
    echo "📄 Wynik zapisany w: ./fitnet-structure.txt"
    echo ""
    echo "🔍 Pokaż pierwsze 50 linii wyniku:"
    echo "   head -n 50 ./fitnet-structure.txt"
    echo ""
    echo "📋 Zobacz wszystko:"
    echo "   cat ./fitnet-structure.txt"
    echo ""
    echo "📊 Zobacz tylko tabele:"
    echo "   grep -A 5 'LISTA TABEL' ./fitnet-structure.txt"
    echo ""
else
    echo -e "${RED}❌ Błąd podczas inspekcji${NC}"
    echo ""
    echo "🔍 Zobacz szczegóły błędu:"
    cat ./fitnet-structure.txt
    exit 1
fi

# Cleanup
echo ""
echo -e "${YELLOW}🧹 Czyszczenie...${NC}"
kubectl exec -n apps $POD_NAME -- rm -f /tmp/inspect-fitnet-db.js
echo -e "${GREEN}✅ Gotowe!${NC}"
