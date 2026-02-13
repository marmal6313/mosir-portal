import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/attendance/summary
 * Get attendance summary with optional filtering
 * Query params:
 * - userId: filter by user ID
 * - departmentId: filter by department ID
 * - startDate: filter from date (YYYY-MM-DD)
 * - endDate: filter to date (YYYY-MM-DD)
 * - month: filter by month (YYYY-MM)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const departmentId = searchParams.get('departmentId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const month = searchParams.get('month');

    let query = supabase
      .from('attendance_summary')
      .select(`
        *,
        user:users(id, first_name, last_name, email, department_id, position)
      `)
      .order('date', { ascending: false });

    if (userId) {
      query = query.eq('user_id', userId);
    }

    if (month) {
      // Parse month (YYYY-MM) and get first and last day
      const [year, monthNum] = month.split('-');
      const firstDay = `${year}-${monthNum}-01`;
      const lastDay = new Date(parseInt(year), parseInt(monthNum), 0).getDate();
      const lastDayStr = `${year}-${monthNum}-${lastDay.toString().padStart(2, '0')}`;

      query = query.gte('date', firstDay).lte('date', lastDayStr);
    } else {
      if (startDate) {
        query = query.gte('date', startDate);
      }

      if (endDate) {
        query = query.lte('date', endDate);
      }
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching attendance summary:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // If department filter is provided, filter in memory (since department_id is in joined user table)
    let filteredData = data;
    if (departmentId && data) {
      filteredData = data.filter((record: any) =>
        record.user?.department_id === departmentId
      );
    }

    // Calculate statistics
    const stats = {
      totalDays: filteredData?.length || 0,
      presentDays: filteredData?.filter((r: any) => r.is_present).length || 0,
      absentDays: filteredData?.filter((r: any) => r.is_absent).length || 0,
      lateDays: filteredData?.filter((r: any) => r.is_late).length || 0,
      earlyLeaveDays: filteredData?.filter((r: any) => r.is_early_leave).length || 0,
      totalHours: filteredData?.reduce((sum: number, r: any) => sum + (r.total_hours || 0), 0) || 0,
      scheduledHours: filteredData?.reduce((sum: number, r: any) => sum + (r.scheduled_hours || 0), 0) || 0,
    };

    return NextResponse.json({ data: filteredData, stats });
  } catch (error) {
    console.error('Error in GET /api/attendance/summary:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
