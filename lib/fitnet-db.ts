/**
 * Fitnet MSSQL Database Connection Module
 *
 * BEZPIECZNE połączenie do bazy Fitnet (READ-ONLY)
 * Działa tylko z poda mosir-virtual w K8s (dostęp do 192.168.3.5)
 */

import sql from 'mssql';

// Konfiguracja połączenia
const config: sql.config = {
  server: process.env.FITNET_DB_SERVER || '192.168.3.5\\fitnet2',
  database: process.env.FITNET_DB_NAME || 'Fitnet',
  user: process.env.FITNET_DB_USER,
  password: process.env.FITNET_DB_PASSWORD,
  options: {
    trustedConnection: process.env.FITNET_DB_USE_WINDOWS_AUTH === 'true',
    trustServerCertificate: true,
    enableArithAbort: true,
    encrypt: false, // dla starszych SQL Server
    instanceName: 'fitnet2',
  },
  pool: {
    max: 10, // maksymalnie 10 połączeń
    min: 0,
    idleTimeoutMillis: 30000, // 30 sekund
  },
  connectionTimeout: 15000, // 15 sekund timeout
  requestTimeout: 30000, // 30 sekund na zapytanie
};

// Connection pool (singleton)
let pool: sql.ConnectionPool | null = null;

/**
 * Pobierz połączenie do bazy Fitnet
 * @returns Connection pool
 */
export async function getFitnetConnection(): Promise<sql.ConnectionPool> {
  if (!pool) {
    // Walidacja zmiennych środowiskowych
    const useWindowsAuth = process.env.FITNET_DB_USE_WINDOWS_AUTH === 'true';
    if (!useWindowsAuth && (!process.env.FITNET_DB_USER || !process.env.FITNET_DB_PASSWORD)) {
      throw new Error(
        'FITNET CONNECTION ERROR: Missing credentials. ' +
        'Please set FITNET_DB_USER and FITNET_DB_PASSWORD environment variables, ' +
        'or set FITNET_DB_USE_WINDOWS_AUTH=true for Windows Authentication. ' +
        'Run: ./scripts/add-fitnet-env-dev.sh to configure.'
      );
    }

    console.log('🔌 Tworzę nowe połączenie do bazy Fitnet...');
    pool = await sql.connect(config);

    pool.on('error', (err) => {
      console.error('❌ Błąd połączenia Fitnet:', err);
      pool = null; // Reset pool on error
    });

    console.log('✅ Połączono z bazą Fitnet');
  }

  return pool;
}

/**
 * Zamknij połączenie do bazy Fitnet
 */
export async function closeFitnetConnection(): Promise<void> {
  if (pool) {
    await pool.close();
    pool = null;
    console.log('🔌 Zamknięto połączenie do bazy Fitnet');
  }
}

/**
 * Wykonaj bezpieczne zapytanie SELECT do bazy Fitnet
 * @param query - Zapytanie SQL (tylko SELECT)
 * @param params - Parametry zapytania
 * @returns Wynik zapytania
 */
export async function queryFitnet<T = any>(
  query: string,
  params?: Record<string, any>
): Promise<T[]> {
  // Zabezpieczenie: tylko SELECT
  const trimmedQuery = query.trim().toLowerCase();
  if (!trimmedQuery.startsWith('select')) {
    throw new Error('SECURITY ERROR: Only SELECT queries are allowed on Fitnet database');
  }

  // Zabezpieczenie: blokuj niebezpieczne operacje
  const forbidden = ['insert', 'update', 'delete', 'drop', 'create', 'alter', 'truncate'];
  for (const keyword of forbidden) {
    if (trimmedQuery.includes(keyword)) {
      throw new Error(`SECURITY ERROR: Keyword '${keyword}' is not allowed on Fitnet database`);
    }
  }

  const connection = await getFitnetConnection();
  const request = connection.request();

  // Dodaj parametry
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      request.input(key, value);
    });
  }

  const result = await request.query(query);
  return result.recordset as T[];
}

/**
 * Test połączenia do bazy Fitnet
 * @returns true jeśli połączenie działa
 */
export async function testFitnetConnection(): Promise<boolean> {
  try {
    const result = await queryFitnet('SELECT 1 as test');
    return result.length > 0 && result[0].test === 1;
  } catch (error) {
    console.error('❌ Test połączenia Fitnet nieudany:', error);
    return false;
  }
}

// Cleanup on process exit
if (typeof process !== 'undefined') {
  process.on('beforeExit', async () => {
    await closeFitnetConnection();
  });
}
