#!/bin/bash

# Skrypt do restore backupu Fitnet do testowej bazy
# Przywraca backup do nowej bazy Fitnet_Test

set -e

echo "🔄 FITNET DATABASE RESTORE"
echo "=========================="
echo ""

# Kolory
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${YELLOW}⚠️  WAŻNE: Ten skrypt przywraca backup do NOWEJ testowej bazy${NC}"
echo ""

# Konfiguracja
read -p "Serwer SQL (domyślnie: 192.168.3.5\fitnet2): " SQL_SERVER
SQL_SERVER=${SQL_SERVER:-"192.168.3.5\fitnet2"}

read -p "Nazwa testowej bazy (domyślnie: Fitnet_Test): " TARGET_DB
TARGET_DB=${TARGET_DB:-Fitnet_Test}

read -p "Ścieżka do pliku backupu (.bak): " BACKUP_FILE

if [ -z "$BACKUP_FILE" ]; then
    echo -e "${RED}❌ Musisz podać ścieżkę do pliku backupu${NC}"
    exit 1
fi

read -p "Username SQL: " SQL_USER
read -sp "Password SQL: " SQL_PASSWORD
echo ""

echo ""
echo -e "${YELLOW}📋 Konfiguracja restore:${NC}"
echo "  Serwer: $SQL_SERVER"
echo "  Docelowa baza: $TARGET_DB"
echo "  Plik backupu: $BACKUP_FILE"
echo ""

read -p "Kontynuować? (y/n): " CONFIRM
if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
    echo "Anulowano."
    exit 0
fi

# Znajdź pod
echo ""
echo "🔍 Szukam poda mosir-portal..."
POD_NAME=$(kubectl get pods -n apps -l app=mosir-portal -o jsonpath='{.items[0].metadata.name}')

if [ -z "$POD_NAME" ]; then
    echo -e "${RED}❌ Nie znaleziono poda mosir-portal${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Pod: $POD_NAME${NC}"
echo ""

# Utwórz skrypt SQL do restore
echo -e "${YELLOW}🔄 Przywracam backup...${NC}"
echo ""

kubectl exec -n apps $POD_NAME -- node -e "
const sql = require('mssql');

const config = {
    server: '$SQL_SERVER',
    database: 'master',
    user: '$SQL_USER',
    password: '$SQL_PASSWORD',
    options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true,
    },
    requestTimeout: 1800000, // 30 minut
};

async function restore() {
    try {
        console.log('📡 Łączę się z serwerem SQL...');
        const pool = await sql.connect(config);

        // 1. Sprawdź czy baza już istnieje
        console.log('🔍 Sprawdzam czy baza $TARGET_DB już istnieje...');
        const dbCheck = await pool.request().query(\`
            SELECT database_id FROM sys.databases WHERE name = '$TARGET_DB'
        \`);

        if (dbCheck.recordset.length > 0) {
            console.log('⚠️  Baza $TARGET_DB już istnieje. Usuwam...');
            await pool.request().query(\`
                ALTER DATABASE [$TARGET_DB] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
                DROP DATABASE [$TARGET_DB];
            \`);
            console.log('✅ Stara baza usunięta');
        }

        // 2. Pobierz listę plików z backupu
        console.log('📂 Odczytuję zawartość backupu...');
        const fileList = await pool.request().query(\`
            RESTORE FILELISTONLY FROM DISK = N'$BACKUP_FILE'
        \`);

        if (!fileList.recordset || fileList.recordset.length === 0) {
            throw new Error('Nie można odczytać zawartości backupu');
        }

        console.log('📁 Pliki w backupie:');
        console.table(fileList.recordset.map(f => ({
            LogicalName: f.LogicalName,
            Type: f.Type,
            PhysicalName: f.PhysicalName
        })));

        // 3. Przygotuj MOVE dla każdego pliku
        const dataPath = 'C:\\\\Program Files\\\\Microsoft SQL Server\\\\MSSQL15.FITNET2\\\\MSSQL\\\\DATA\\\\';
        const moveStatements = fileList.recordset.map(file => {
            const extension = file.Type === 'L' ? '.ldf' : '.mdf';
            const newName = '$TARGET_DB' + (file.Type === 'L' ? '_log' : '') + extension;
            return \`MOVE N'\${file.LogicalName}' TO N'\${dataPath}\${newName}'\`;
        }).join(', ');

        // 4. Restore backupu
        console.log('');
        console.log('🔄 Przywracam backup... (może potrwać kilka minut)');
        console.log('');

        const restoreQuery = \`
            RESTORE DATABASE [$TARGET_DB]
            FROM DISK = N'$BACKUP_FILE'
            WITH
                \${moveStatements},
                REPLACE,
                STATS = 10
        \`;

        await pool.request().query(restoreQuery);

        console.log('');
        console.log('✅ Backup przywrócony pomyślnie!');
        console.log('');

        // 5. Ustaw bazę w tryb multi-user
        await pool.request().query(\`
            ALTER DATABASE [$TARGET_DB] SET MULTI_USER;
        \`);

        // 6. Pokaż informacje o przywróconej bazie
        console.log('📊 Informacje o przywróconej bazie:');
        const dbInfo = await pool.request().query(\`
            SELECT
                name as database_name,
                create_date,
                compatibility_level,
                (SELECT SUM(size) * 8 / 1024 FROM sys.master_files WHERE database_id = db.database_id) as size_mb
            FROM sys.databases db
            WHERE name = '$TARGET_DB'
        \`);
        console.table(dbInfo.recordset);

        await pool.close();
        process.exit(0);
    } catch (err) {
        console.error('❌ Błąd:', err.message);
        process.exit(1);
    }
}

restore();
" || {
    echo ""
    echo -e "${RED}❌ Restore nieudany${NC}"
    exit 1
}

echo ""
echo -e "${GREEN}✅ RESTORE ZAKOŃCZONY POMYŚLNIE!${NC}"
echo ""
echo -e "${BLUE}🎯 Testowa baza:${NC}"
echo "   Serwer: $SQL_SERVER"
echo "   Baza: $TARGET_DB"
echo ""
echo -e "${YELLOW}🔄 Następne kroki:${NC}"
echo ""
echo "1️⃣  Skonfiguruj zmienne środowiskowe w K8s:"
echo "   ./scripts/add-fitnet-env-to-k8s.sh"
echo "   Podaj nazwę bazy: $TARGET_DB"
echo ""
echo "2️⃣  Restart deploymentu:"
echo "   kubectl rollout restart deployment/mosir-portal -n apps"
echo ""
echo "3️⃣  Testuj połączenie z testową bazą:"
echo "   curl https://app.e-mosir.pl/api/fitnet/test"
echo ""
echo "4️⃣  Zbadaj strukturę testowej bazy:"
echo "   ./scripts/run-fitnet-inspect-k8s.sh"
echo ""
echo "5️⃣  Pracuj bezpiecznie na kopii! 🎉"
echo ""
echo -e "${GREEN}Teraz możesz spokojnie eksperymentować - produkcja jest bezpieczna!${NC}"
echo ""
