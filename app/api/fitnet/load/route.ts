/**
 * API Endpoint: Sprawdź obciążenie bazy Fitnet
 *
 * GET /api/fitnet/load
 *
 * Tylko dla superadmin - sprawdza czy to dobry moment na backup
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { queryFitnet } from '@/lib/fitnet-db';

interface LoadStatus {
  activeConnections: number;
  databaseSizeMB: number;
  databaseSizeGB: number;
  estimatedBackupTime: string;
  diskSpace?: Array<{ drive: string; mb_free: number }>;
  longRunningQueries: number;
  recommendation: 'excellent' | 'good' | 'medium' | 'poor';
  recommendationText: string;
  canBackupNow: boolean;
}

export async function GET(request: NextRequest) {
  try {
    // 1. Weryfikacja użytkownika
    const supabase = await createSupabaseServerClient(request);
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

    console.log('🔍 Sprawdzam obciążenie bazy Fitnet...');

    // 3. Pobierz aktywne połączenia
    const activeConns = await queryFitnet<{ active_connections: number }>(`
      SELECT COUNT(*) as active_connections
      FROM sys.dm_exec_sessions
      WHERE database_id = DB_ID('${process.env.FITNET_DB_NAME || 'Fitnet'}')
      AND is_user_process = 1
    `);

    const activeConnections = activeConns[0]?.active_connections || 0;

    // 4. Pobierz rozmiar bazy
    const dbSize = await queryFitnet<{ SizeMB: number; SizeGB: number }>(`
      SELECT
        SUM(size) * 8 / 1024 as SizeMB,
        SUM(size) * 8 / 1024.0 / 1024.0 as SizeGB
      FROM sys.master_files
      WHERE database_id = DB_ID('${process.env.FITNET_DB_NAME || 'Fitnet'}')
    `);

    const databaseSizeMB = Math.round(dbSize[0]?.SizeMB || 0);
    const databaseSizeGB = parseFloat((dbSize[0]?.SizeGB || 0).toFixed(2));

    // 5. Szacowany czas backupu
    let estimatedBackupTime: string;
    if (databaseSizeMB < 1024) {
      estimatedBackupTime = '2-5 minut';
    } else if (databaseSizeMB < 5120) {
      estimatedBackupTime = '5-10 minut';
    } else if (databaseSizeMB < 20480) {
      estimatedBackupTime = '10-20 minut';
    } else {
      estimatedBackupTime = '20-60 minut';
    }

    // 6. Sprawdź wolne miejsce na dysku (opcjonalne - wymaga uprawnień xp_fixeddrives)
    let diskSpace: Array<{ drive: string; mb_free: number }> | undefined;
    try {
      diskSpace = await queryFitnet<{ drive: string; 'MB free': number }>(`
        EXEC xp_fixeddrives
      `).then((results) =>
        results.map((d) => ({
          drive: d.drive,
          mb_free: d['MB free'],
        }))
      );
    } catch (e) {
      // Brak uprawnień xp_fixeddrives - ignoruj
      console.log('⚠️  Brak uprawnień xp_fixeddrives');
    }

    // 7. Długo działające zapytania
    const queries = await queryFitnet<{ elapsed_seconds: number }>(`
      SELECT
        total_elapsed_time / 1000 as elapsed_seconds
      FROM sys.dm_exec_requests
      WHERE database_id = DB_ID('${process.env.FITNET_DB_NAME || 'Fitnet'}')
      AND total_elapsed_time > 60000
    `);

    const longRunningQueries = queries.length;

    // 8. Rekomendacja
    let recommendation: LoadStatus['recommendation'];
    let recommendationText: string;
    let canBackupNow: boolean;

    if (activeConnections === 0) {
      recommendation = 'excellent';
      recommendationText = 'Brak aktywnych połączeń - IDEALNY moment na backup!';
      canBackupNow = true;
    } else if (activeConnections < 5) {
      recommendation = 'good';
      recommendationText = 'Bardzo małe obciążenie - DOBRY moment na backup';
      canBackupNow = true;
    } else if (activeConnections < 20) {
      recommendation = 'medium';
      recommendationText =
        'Średnie obciążenie - backup możliwy, może być wolniejszy';
      canBackupNow = true;
    } else {
      recommendation = 'poor';
      recommendationText =
        'Duże obciążenie - NIE ZALECANY moment na backup. Poczekaj do wieczora/weekendu.';
      canBackupNow = false;
    }

    // Ostrzeżenie o długich zapytaniach
    if (longRunningQueries > 0) {
      recommendationText += ` ⚠️ Wykryto ${longRunningQueries} długo działających zapytań.`;
      if (canBackupNow) {
        recommendationText += ' Rozważ odczekanie aż się zakończą.';
      }
    }

    const loadStatus: LoadStatus = {
      activeConnections,
      databaseSizeMB,
      databaseSizeGB,
      estimatedBackupTime,
      diskSpace,
      longRunningQueries,
      recommendation,
      recommendationText,
      canBackupNow,
    };

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      database: process.env.FITNET_DB_NAME || 'Fitnet',
      ...loadStatus,
    });
  } catch (error: any) {
    console.error('❌ Błąd sprawdzania obciążenia Fitnet:', error);

    return NextResponse.json(
      {
        error: error.message || 'Unknown error',
        hint: 'Sprawdź czy połączenie z Fitnet działa: GET /api/fitnet/test',
      },
      { status: 500 }
    );
  }
}
