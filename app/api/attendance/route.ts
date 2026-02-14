import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key'
);

/**
 * GET /api/attendance
 * Get attendance records with optional filtering
 * Query params:
 * - userId: filter by user ID
 * - startDate: filter from date (YYYY-MM-DD)
 * - endDate: filter to date (YYYY-MM-DD)
 * - limit: number of records to return (default 100)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    let query = supabase
      .from('attendance_records')
      .select(`
        *,
        user:users(id, first_name, last_name, email, department_id)
      `)
      .order('event_timestamp', { ascending: false })
      .limit(limit);

    if (userId) {
      query = query.eq('user_id', userId);
    }

    if (startDate) {
      query = query.gte('event_timestamp', `${startDate}T00:00:00Z`);
    }

    if (endDate) {
      query = query.lte('event_timestamp', `${endDate}T23:59:59Z`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching attendance records:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error in GET /api/attendance:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
