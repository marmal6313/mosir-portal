/**
 * Bezpieczny skrypt do eksploracji struktury bazy MSSQL Fitnet
 * TYLKO ODCZYT - nie modyfikuje żadnych danych
 */

const sql = require('mssql');

// Konfiguracja połączenia - Fitnet na 192.168.3.5\fitnet2
// WAŻNE: Ten skrypt musi być uruchomiony z poda mosir-virtual w K8s
const config = {
  server: '192.168.3.5\\fitnet2', // SQL Server instance
  database: process.env.FITNET_DB_NAME || 'Fitnet', // nazwa bazy - do uzupełnienia jeśli inna
  user: process.env.FITNET_DB_USER, // opcjonalnie, jeśli używasz SQL Auth
  password: process.env.FITNET_DB_PASSWORD, // opcjonalnie
  options: {
    trustedConnection: process.env.FITNET_DB_USE_WINDOWS_AUTH === 'true',
    trustServerCertificate: true,
    enableArithAbort: true,
    encrypt: false, // dla starszych SQL Server
    instanceName: 'fitnet2',
  },
  pool: {
    max: 1,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

async function inspectDatabase() {
  try {
    console.log('🔍 Łączę się z bazą Fitnet...\n');

    const pool = await sql.connect(config);

    // 1. Lista wszystkich tabel
    console.log('📋 LISTA TABEL:\n');
    const tables = await pool.request().query(`
      SELECT
        TABLE_SCHEMA,
        TABLE_NAME,
        TABLE_TYPE
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME
    `);

    console.table(tables.recordset);

    // 2. Szukamy tabel które mogą zawierać sprzedaż
    console.log('\n\n💰 TABELE POTENCJALNIE ZWIĄZANE ZE SPRZEDAŻĄ:\n');
    const salesTables = tables.recordset.filter(t => {
      const name = t.TABLE_NAME.toLowerCase();
      return name.includes('sprzedaz') ||
             name.includes('transakcj') ||
             name.includes('platno') ||
             name.includes('payment') ||
             name.includes('sale') ||
             name.includes('faktur') ||
             name.includes('paragon') ||
             name.includes('bilet') ||
             name.includes('ticket') ||
             name.includes('karnet');
    });

    if (salesTables.length > 0) {
      console.table(salesTables);

      // 3. Dla każdej znalezionej tabeli pokażemy strukturę
      console.log('\n\n📊 STRUKTURA ZNALEZIONYCH TABEL:\n');

      for (const table of salesTables) {
        console.log(`\n--- ${table.TABLE_NAME} ---`);

        const columns = await pool.request().query(`
          SELECT
            COLUMN_NAME,
            DATA_TYPE,
            CHARACTER_MAXIMUM_LENGTH,
            IS_NULLABLE,
            COLUMN_DEFAULT
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_NAME = '${table.TABLE_NAME}'
          ORDER BY ORDINAL_POSITION
        `);

        console.table(columns.recordset);

        // Policz rekordy w tabeli
        const count = await pool.request().query(`
          SELECT COUNT(*) as total FROM [${table.TABLE_NAME}]
        `);
        console.log(`Rekordów w tabeli: ${count.recordset[0].total}`);

        // Pokaż przykładowe 3 rekordy (jeśli istnieją)
        if (count.recordset[0].total > 0) {
          console.log('\nPrzykładowe dane (3 pierwsze rekordy):');
          const sample = await pool.request().query(`
            SELECT TOP 3 * FROM [${table.TABLE_NAME}]
          `);
          console.table(sample.recordset);
        }
      }
    } else {
      console.log('Nie znaleziono tabel ze słowami kluczowymi. Pokazuję wszystkie tabele:');
      console.table(tables.recordset);
    }

    // 4. Szukamy tabel z kategoriami produktów
    console.log('\n\n🏷️  TABELE POTENCJALNIE Z KATEGORIAMI/PRODUKTAMI:\n');
    const productTables = tables.recordset.filter(t => {
      const name = t.TABLE_NAME.toLowerCase();
      return name.includes('produkt') ||
             name.includes('kategori') ||
             name.includes('uslu') ||
             name.includes('product') ||
             name.includes('category') ||
             name.includes('service');
    });

    if (productTables.length > 0) {
      console.table(productTables);
    }

    await pool.close();
    console.log('\n✅ Analiza zakończona!\n');

  } catch (err) {
    console.error('❌ Błąd:', err.message);
    console.error('\n💡 Sprawdź:');
    console.error('   1. Czy nazwa serwera jest poprawna?');
    console.error('   2. Czy nazwa bazy danych jest poprawna?');
    console.error('   3. Czy masz dostęp do bazy przez Windows Authentication?');
    console.error('   4. Czy SQL Server jest uruchomiony?');
    console.error('\n🔧 Możesz sprawdzić dostępne bazy komendą:');
    console.error('   SELECT name FROM sys.databases;');
  }
}

// Uruchom analizę
inspectDatabase();

console.log(`
========================================
  FITNET DATABASE INSPECTOR
========================================

URUCHOMIENIE Z PODA KUBERNETES:

1. Zaloguj się do poda mosir-virtual:
   kubectl exec -it -n apps deployment/mosir-virtual -- /bin/bash

2. Przejdź do katalogu projektu i zainstaluj mssql:
   cd /app
   npm install mssql

3. Ustaw zmienne środowiskowe (opcjonalne):
   export FITNET_DB_NAME="Fitnet"
   export FITNET_DB_USER="twoj_user"  # jeśli używasz SQL Auth
   export FITNET_DB_PASSWORD="haslo"  # jeśli używasz SQL Auth
   export FITNET_DB_USE_WINDOWS_AUTH="false"  # true dla Windows Auth

4. Uruchom skrypt:
   node scripts/inspect-fitnet-db.js > /tmp/fitnet-structure.txt
   cat /tmp/fitnet-structure.txt

5. Skopiuj wynik na lokalny komputer:
   kubectl cp apps/mosir-virtual-xxx:/tmp/fitnet-structure.txt ./fitnet-structure.txt

========================================

Ten skrypt jest w 100% bezpieczny:
- Tylko odczyt (SELECT)
- Nie modyfikuje danych
- Nie usuwa nic
- Pokazuje strukturę bazy
- Działa tylko z poda mosir-virtual (ma dostęp do 192.168.3.5)

========================================
`);
