#!/bin/bash

# Skrypt do sprawdzenia obciążenia bazy Fitnet przed backupem
# Pomaga zdecydować czy to dobry moment na backup

set -e

echo "📊 FITNET DATABASE LOAD CHECK"
echo "=============================="
echo ""

# Kolory
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Konfiguracja
read -p "Serwer SQL (domyślnie: 192.168.3.5\fitnet2): " SQL_SERVER
SQL_SERVER=${SQL_SERVER:-"192.168.3.5\fitnet2"}

read -p "Nazwa bazy (domyślnie: Fitnet): " DB_NAME
DB_NAME=${DB_NAME:-Fitnet}

read -p "Username: " SQL_USER
read -sp "Password: " SQL_PASSWORD
echo ""

echo ""
echo "🔍 Sprawdzam obciążenie bazy $DB_NAME..."
echo ""

# Znajdź pod
POD_NAME=$(kubectl get pods -n apps -l app=mosir-portal -o jsonpath='{.items[0].metadata.name}')

if [ -z "$POD_NAME" ]; then
    echo -e "${RED}❌ Nie znaleziono poda mosir-portal${NC}"
    exit 1
fi

# Uruchom diagnostykę
kubectl exec -n apps $POD_NAME -- node -e "
const sql = require('mssql');

const config = {
    server: '$SQL_SERVER',
    database: '$DB_NAME',
    user: '$SQL_USER',
    password: '$SQL_PASSWORD',
    options: {
        encrypt: false,
        trustServerCertificate: true,
    },
    requestTimeout: 30000,
};

async function checkLoad() {
    try {
        console.log('📡 Łączę się z bazą Fitnet...');
        const pool = await sql.connect(config);

        console.log('');
        console.log('═══════════════════════════════════════════════════════════');
        console.log('  RAPORT OBCIĄŻENIA BAZY FITNET - $(date +\"%Y-%m-%d %H:%M:%S\")');
        console.log('═══════════════════════════════════════════════════════════');
        console.log('');

        // 1. Aktywne połączenia
        console.log('👥 AKTYWNE POŁĄCZENIA:');
        console.log('───────────────────────────────────────────────────────────');
        const connections = await pool.request().query(\`
            SELECT COUNT(*) as active_connections
            FROM sys.dm_exec_sessions
            WHERE database_id = DB_ID('$DB_NAME')
            AND is_user_process = 1
        \`);
        const activeConn = connections.recordset[0].active_connections;
        console.log('Połączenia: ' + activeConn);

        if (activeConn === 0) {
            console.log('✅ Brak aktywnych połączeń - IDEALNY moment na backup!');
        } else if (activeConn < 5) {
            console.log('✅ Bardzo małe obciążenie - DOBRY moment na backup');
        } else if (activeConn < 20) {
            console.log('⚠️  Średnie obciążenie - backup możliwy, może być wolniejszy');
        } else {
            console.log('❌ Duże obciążenie - NIE ZALECANY moment na backup');
        }
        console.log('');

        // 2. Rozmiar bazy
        console.log('💾 ROZMIAR BAZY:');
        console.log('───────────────────────────────────────────────────────────');
        const size = await pool.request().query(\`
            SELECT
                SUM(size) * 8 / 1024 as SizeMB,
                SUM(size) * 8 / 1024 / 1024 as SizeGB
            FROM sys.master_files
            WHERE database_id = DB_ID('$DB_NAME')
        \`);
        const sizeMB = Math.round(size.recordset[0].SizeMB);
        const sizeGB = size.recordset[0].SizeGB.toFixed(2);

        console.log('Rozmiar: ' + sizeMB + ' MB (' + sizeGB + ' GB)');

        let estimatedTime;
        if (sizeMB < 1024) {
            estimatedTime = '2-5 minut';
        } else if (sizeMB < 5120) {
            estimatedTime = '5-10 minut';
        } else if (sizeMB < 20480) {
            estimatedTime = '10-20 minut';
        } else {
            estimatedTime = '20-60 minut';
        }

        console.log('Szacowany czas backupu: ' + estimatedTime + ' (z kompresją)');
        console.log('');

        // 3. Wolne miejsce na dysku
        console.log('💿 WOLNE MIEJSCE NA DYSKU:');
        console.log('───────────────────────────────────────────────────────────');
        try {
            const diskSpace = await pool.request().query(\`EXEC xp_fixeddrives\`);
            console.table(diskSpace.recordset);

            // Sprawdź czy dysk C: ma wystarczająco miejsca
            const cDrive = diskSpace.recordset.find(d => d.drive === 'C');
            if (cDrive) {
                const freeMB = cDrive['MB free'];
                const requiredMB = sizeMB * 0.7; // Backup z kompresją ~70% rozmiaru

                if (freeMB > requiredMB * 2) {
                    console.log('✅ Dużo miejsca - backup bezpiecznie zmieści się');
                } else if (freeMB > requiredMB) {
                    console.log('⚠️  Wystarczające miejsce, ale nieduża rezerwa');
                } else {
                    console.log('❌ BRAK MIEJSCA! Backup może się nie powieść');
                }
            }
        } catch (e) {
            console.log('⚠️  Nie można sprawdzić wolnego miejsca (brak uprawnień xp_fixeddrives)');
        }
        console.log('');

        // 4. Długo działające zapytania
        console.log('⏱️  AKTYWNE ZAPYTANIA:');
        console.log('───────────────────────────────────────────────────────────');
        const queries = await pool.request().query(\`
            SELECT TOP 5
                session_id,
                status,
                command,
                wait_type,
                cpu_time,
                total_elapsed_time / 1000 as elapsed_seconds
            FROM sys.dm_exec_requests
            WHERE database_id = DB_ID('$DB_NAME')
            ORDER BY total_elapsed_time DESC
        \`);

        if (queries.recordset.length === 0) {
            console.log('✅ Brak długo działających zapytań');
        } else {
            console.table(queries.recordset);
            const maxElapsed = Math.max(...queries.recordset.map(q => q.elapsed_seconds));
            if (maxElapsed > 300) {
                console.log('❌ Są zapytania działające > 5 minut - poczekaj aż się skończą');
            } else if (maxElapsed > 60) {
                console.log('⚠️  Są zapytania działające > 1 minuty');
            } else {
                console.log('✅ Wszystkie zapytania krótkie');
            }
        }
        console.log('');

        // 5. Ostatni backup
        console.log('📅 OSTATNI BACKUP:');
        console.log('───────────────────────────────────────────────────────────');
        const lastBackup = await pool.request().query(\`
            SELECT TOP 1
                backup_finish_date,
                DATEDIFF(day, backup_finish_date, GETDATE()) as days_ago,
                backup_size / 1024 / 1024 as size_mb,
                CASE type
                    WHEN 'D' THEN 'Full'
                    WHEN 'I' THEN 'Differential'
                    WHEN 'L' THEN 'Log'
                END as backup_type
            FROM msdb.dbo.backupset
            WHERE database_name = '$DB_NAME'
            AND type = 'D'  -- tylko pełne backupy
            ORDER BY backup_finish_date DESC
        \`);

        if (lastBackup.recordset.length > 0) {
            const last = lastBackup.recordset[0];
            console.log('Data: ' + last.backup_finish_date);
            console.log('Dni temu: ' + last.days_ago);
            console.log('Rozmiar: ' + Math.round(last.size_mb) + ' MB');
            console.log('Typ: ' + last.backup_type);
        } else {
            console.log('⚠️  Nie znaleziono poprzednich backupów (lub brak dostępu do msdb)');
        }
        console.log('');

        // PODSUMOWANIE
        console.log('═══════════════════════════════════════════════════════════');
        console.log('  REKOMENDACJA');
        console.log('═══════════════════════════════════════════════════════════');
        console.log('');

        let recommendation = '';
        let color = '';

        if (activeConn === 0) {
            recommendation = '✅ IDEALNY moment - możesz zrobić backup TERAZ!';
            color = 'green';
        } else if (activeConn < 5) {
            recommendation = '✅ DOBRY moment - backup zalecany';
            color = 'green';
        } else if (activeConn < 20) {
            recommendation = '⚠️  ŚREDNIE obciążenie - backup możliwy ale może być wolniejszy';
            color = 'yellow';
        } else {
            recommendation = '❌ DUŻE obciążenie - poczekaj do wieczora/weekendu';
            color = 'red';
        }

        console.log(recommendation);
        console.log('');
        console.log('Szacowany czas backupu: ' + estimatedTime);
        console.log('');

        await pool.close();
        process.exit(activeConn < 20 ? 0 : 1);

    } catch (err) {
        console.error('❌ Błąd:', err.message);
        process.exit(1);
    }
}

checkLoad();
"

EXIT_CODE=$?

echo ""
if [ $EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✅ Możesz zrobić backup teraz${NC}"
    echo ""
    echo "Uruchom:"
    echo "  ./scripts/backup-fitnet-db.sh"
else
    echo -e "${RED}⚠️  Zalecane odczekanie do momentu z mniejszym obciążeniem${NC}"
    echo ""
    echo "Sugerowane godziny:"
    echo "  - Wieczór: 22:00 - 06:00"
    echo "  - Weekend: Sobota/Niedziela rano"
fi

echo ""
