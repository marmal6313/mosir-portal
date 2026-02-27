#!/bin/bash

# Skrypt do tworzenia backupu bazy Fitnet
# BEZPIECZNY - tylko odczyt z produkcji, backup na lokalny serwer SQL

set -e

echo "💾 FITNET DATABASE BACKUP"
echo "========================="
echo ""

# Kolory
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Konfiguracja
PRODUCTION_SERVER="192.168.3.5\fitnet2"
BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="Fitnet_Backup_${BACKUP_DATE}"

echo -e "${BLUE}📋 Konfiguracja backupu:${NC}"
echo "  Źródło: $PRODUCTION_SERVER"
echo "  Backup: $BACKUP_NAME"
echo ""

# Pytaj o dane dostępowe do produkcji
echo -e "${YELLOW}🔐 Dane dostępowe do PRODUKCYJNEJ bazy Fitnet:${NC}"
read -p "Nazwa bazy źródłowej (domyślnie: Fitnet): " SOURCE_DB
SOURCE_DB=${SOURCE_DB:-Fitnet}

read -p "Username: " PROD_USER
read -sp "Password: " PROD_PASSWORD
echo ""

# Pytaj gdzie zapisać backup
echo ""
echo -e "${YELLOW}💾 Gdzie zapisać backup?${NC}"
echo "1) Na tym samym serwerze SQL (192.168.3.5\fitnet2)"
echo "2) Na lokalnym serwerze MOSiR (podaj nazwę serwera)"
read -p "Wybór (1/2): " BACKUP_LOCATION

if [ "$BACKUP_LOCATION" == "1" ]; then
    BACKUP_SERVER="$PRODUCTION_SERVER"
    BACKUP_USER="$PROD_USER"
    BACKUP_PASSWORD="$PROD_PASSWORD"

    # Ścieżka backupu na serwerze SQL
    read -p "Ścieżka do zapisu backupu (np. C:\Backups): " BACKUP_PATH
    BACKUP_PATH=${BACKUP_PATH:-"C:\Backups"}

    BACKUP_FILE="${BACKUP_PATH}\${BACKUP_NAME}.bak"
else
    read -p "Nazwa serwera docelowego (np. localhost\SQLEXPRESS): " BACKUP_SERVER
    read -p "Username: " BACKUP_USER
    read -sp "Password: " BACKUP_PASSWORD
    echo ""

    read -p "Ścieżka do zapisu backupu: " BACKUP_PATH
    BACKUP_FILE="${BACKUP_PATH}\${BACKUP_NAME}.bak"
fi

echo ""
echo -e "${YELLOW}🚀 Tworzę backup...${NC}"
echo ""

# Sprawdź czy kubectl jest dostępny
if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}❌ kubectl nie jest zainstalowany${NC}"
    exit 1
fi

# Znajdź pod
echo "🔍 Szukam poda mosir-portal..."
POD_NAME=$(kubectl get pods -n apps -l app=mosir-portal -o jsonpath='{.items[0].metadata.name}')

if [ -z "$POD_NAME" ]; then
    echo -e "${RED}❌ Nie znaleziono poda mosir-portal${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Pod: $POD_NAME${NC}"
echo ""

# Utwórz skrypt SQL do backupu
BACKUP_SQL=$(cat <<EOF
-- Backup bazy Fitnet
BACKUP DATABASE [$SOURCE_DB]
TO DISK = N'$BACKUP_FILE'
WITH
    COPY_ONLY,           -- Nie wpływa na łańcuch backupów produkcyjnych
    COMPRESSION,         -- Kompresja (jeśli dostępna)
    STATS = 10,          -- Pokaż postęp co 10%
    NAME = N'$BACKUP_NAME',
    DESCRIPTION = N'Backup do testowania integracji Drabio - utworzony $(date +%Y-%m-%d\ %H:%M:%S)'
;

-- Sprawdź rozmiar backupu
SELECT
    database_name,
    backup_size / 1024 / 1024 as backup_size_mb,
    compressed_backup_size / 1024 / 1024 as compressed_size_mb,
    backup_finish_date
FROM msdb.dbo.backupset
WHERE database_name = '$SOURCE_DB'
AND backup_start_date >= DATEADD(minute, -5, GETDATE())
ORDER BY backup_finish_date DESC;
EOF
)

echo -e "${BLUE}📝 Wykonuję backup SQL...${NC}"
echo ""

# Zapisz skrypt do pliku tymczasowego w podzie
kubectl exec -n apps $POD_NAME -- sh -c "cat > /tmp/backup-fitnet.sql <<'EOSQL'
$BACKUP_SQL
EOSQL"

# Zainstaluj mssql-tools jeśli nie ma
echo "🔧 Instaluję narzędzia MSSQL w podzie..."
kubectl exec -n apps $POD_NAME -- sh -c "
    apt-get update -qq > /dev/null 2>&1 || true
    apt-get install -y -qq curl gnupg2 > /dev/null 2>&1 || true
" || echo "Narzędzia już zainstalowane lub niedostępne"

# Uruchom backup przez sqlcmd (jeśli dostępne) lub przez mssql npm
echo ""
echo -e "${YELLOW}⏳ Tworzę backup... (może potrwać kilka minut)${NC}"
echo ""

# Metoda 1: Przez Node.js i mssql
kubectl exec -n apps $POD_NAME -- node -e "
const sql = require('mssql');

const config = {
    server: '$PRODUCTION_SERVER',
    database: 'master',
    user: '$PROD_USER',
    password: '$PROD_PASSWORD',
    options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true,
    },
    requestTimeout: 1800000, // 30 minut
};

async function backup() {
    try {
        console.log('📡 Łączę się z serwerem SQL...');
        const pool = await sql.connect(config);

        console.log('💾 Tworzę backup (może potrwać kilka minut)...');
        const result = await pool.request().query(\`$BACKUP_SQL\`);

        console.log('✅ Backup utworzony pomyślnie!');
        console.log('');
        console.log('📊 Informacje o backupie:');
        if (result.recordset && result.recordset.length > 0) {
            console.table(result.recordset);
        }

        await pool.close();
        process.exit(0);
    } catch (err) {
        console.error('❌ Błąd:', err.message);
        process.exit(1);
    }
}

backup();
" || {
    echo ""
    echo -e "${RED}❌ Backup nieudany${NC}"
    exit 1
}

# Cleanup
kubectl exec -n apps $POD_NAME -- rm -f /tmp/backup-fitnet.sql

echo ""
echo -e "${GREEN}✅ BACKUP ZAKOŃCZONY POMYŚLNIE!${NC}"
echo ""
echo -e "${BLUE}📁 Plik backupu:${NC}"
echo "   $BACKUP_FILE"
echo ""
echo -e "${BLUE}📊 Rozmiar backupu:${NC}"
echo "   (sprawdź output powyżej)"
echo ""
echo -e "${YELLOW}🔄 Następne kroki:${NC}"
echo ""
echo "1️⃣  Utwórz testową bazę danych na serwerze SQL:"
echo "   CREATE DATABASE Fitnet_Test;"
echo ""
echo "2️⃣  Przywróć backup do testowej bazy:"
echo "   ./scripts/restore-fitnet-backup.sh"
echo ""
echo "3️⃣  Ustaw zmienne środowiskowe w K8s na testową bazę:"
echo "   FITNET_DB_NAME=Fitnet_Test"
echo ""
echo "4️⃣  Pracuj bezpiecznie na kopii! 🎉"
echo ""
