import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { syncRacsEvents, autoMapRacsUsers } from '@/lib/racs-sync';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key'
);

/**
 * POST /api/racs/sync
 * Trigger manual synchronization of RACS events
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body.action || 'sync';

    if (action === 'sync') {
      // Trigger event synchronization
      const result = await syncRacsEvents();

      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: `Synchronized ${result.eventsCreated} new attendance records`,
        result,
      });
    } else if (action === 'auto-map') {
      // Auto-map RACS persons to portal users
      const result = await autoMapRacsUsers();

      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: `Auto-mapped ${result.mapped} users`,
        result,
      });
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in POST /api/racs/sync:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/racs/sync
 * Get sync status and recent sync logs
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    // Get recent sync logs
    const { data: syncLogs, error: logsError } = await supabase
      .from('racs_sync_log')
      .select('*')
      .order('sync_started_at', { ascending: false })
      .limit(limit);

    if (logsError) {
      console.error('Error fetching sync logs:', logsError);
      return NextResponse.json({ error: logsError.message }, { status: 500 });
    }

    // Get current config
    const { data: config, error: configError } = await supabase
      .from('racs_integration_config')
      .select('id, service_url, username, sync_enabled, sync_interval_minutes, last_sync_event_id, updated_at')
      .eq('sync_enabled', true)
      .single();

    if (configError && configError.code !== 'PGRST116') {
      console.error('Error fetching config:', configError);
    }

    // Get statistics
    const { count: totalRecords } = await supabase
      .from('attendance_records')
      .select('*', { count: 'exact', head: true });

    const { count: mappedUsers } = await supabase
      .from('racs_user_mapping')
      .select('*', { count: 'exact', head: true })
      .eq('active', true);

    return NextResponse.json({
      config,
      syncLogs,
      stats: {
        totalAttendanceRecords: totalRecords || 0,
        mappedUsers: mappedUsers || 0,
      },
    });
  } catch (error) {
    console.error('Error in GET /api/racs/sync:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
