/**
 * Test endpoint dla połączenia z bazą Fitnet
 *
 * GET /api/fitnet/test
 *
 * Tylko dla superadmin - testuje połączenie z bazą Fitnet
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { testFitnetConnection, queryFitnet, closeFitnetConnection } from '@/lib/fitnet-db';

export async function GET(request: NextRequest) {
  try {
    // 1. Weryfikacja użytkownika
    const supabase = createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Sprawdź czy użytkownik to superadmin
    const { data: userProfile } = await supabase
      .from('users')
      .select('role, organization_id')
      .eq('id', user.id)
      .single();

    if (!userProfile || userProfile.role !== 'superadmin') {
      return NextResponse.json(
        { error: 'Forbidden - tylko superadmin' },
        { status: 403 }
      );
    }

    // 3. Test połączenia z Fitnet
    console.log('🧪 Testuję połączenie do bazy Fitnet...');

    const connectionTest = await testFitnetConnection();

    if (!connectionTest) {
      throw new Error('Test połączenia nieudany');
    }

    // 4. Pobierz listę tabel (diagnostyka)
    const tables = await queryFitnet<{ TABLE_NAME: string; TABLE_TYPE: string }>(`
      SELECT
        TABLE_NAME,
        TABLE_TYPE
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME
    `);

    // 5. Sprawdź wersję SQL Server
    const version = await queryFitnet<{ version: string }>(`
      SELECT @@VERSION as version
    `);

    // 6. Sprawdź dostępne bazy
    const databases = await queryFitnet<{ name: string }>(`
      SELECT name FROM sys.databases ORDER BY name
    `);

    await closeFitnetConnection();

    return NextResponse.json({
      success: true,
      message: 'Połączenie z bazą Fitnet działa!',
      connection: {
        server: process.env.FITNET_DB_SERVER,
        database: process.env.FITNET_DB_NAME,
        authMethod: process.env.FITNET_DB_USE_WINDOWS_AUTH === 'true' ? 'Windows Authentication' : 'SQL Server Authentication',
      },
      diagnostics: {
        sqlServerVersion: version[0]?.version || 'unknown',
        tablesCount: tables.length,
        tables: tables.map((t) => t.TABLE_NAME),
        databases: databases.map((d) => d.name),
      },
    });
  } catch (error: any) {
    console.error('❌ Błąd testu połączenia Fitnet:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Unknown error',
        hint: 'Sprawdź zmienne środowiskowe FITNET_DB_* w deployment',
      },
      { status: 500 }
    );
  }
}
