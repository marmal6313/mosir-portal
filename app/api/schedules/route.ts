import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/schedules
 * Get work schedules with optional filtering
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
      .from('work_schedules')
      .select(`
        *,
        user:users(id, first_name, last_name, email, department_id, position),
        department:departments(id, name)
      `)
      .order('schedule_date', { ascending: true });

    if (userId) {
      query = query.eq('user_id', userId);
    }

    if (departmentId) {
      query = query.eq('department_id', departmentId);
    }

    if (month) {
      // Parse month (YYYY-MM) and get first and last day
      const [year, monthNum] = month.split('-');
      const firstDay = `${year}-${monthNum}-01`;
      const lastDay = new Date(parseInt(year), parseInt(monthNum), 0).getDate();
      const lastDayStr = `${year}-${monthNum}-${lastDay.toString().padStart(2, '0')}`;

      query = query.gte('schedule_date', firstDay).lte('schedule_date', lastDayStr);
    } else {
      if (startDate) {
        query = query.gte('schedule_date', startDate);
      }

      if (endDate) {
        query = query.lte('schedule_date', endDate);
      }
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching schedules:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error in GET /api/schedules:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/schedules
 * Create or update work schedules
 * Body: array of schedule objects or single schedule object
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const schedules = Array.isArray(body) ? body : [body];

    // Validate required fields
    for (const schedule of schedules) {
      if (!schedule.user_id || !schedule.schedule_date || !schedule.shift_start || !schedule.shift_end) {
        return NextResponse.json(
          { error: 'Missing required fields: user_id, schedule_date, shift_start, shift_end' },
          { status: 400 }
        );
      }
    }

    // Insert or update schedules (upsert based on user_id + schedule_date)
    const results = [];
    for (const schedule of schedules) {
      const { data, error } = await supabase
        .from('work_schedules')
        .upsert({
          user_id: schedule.user_id,
          department_id: schedule.department_id || null,
          schedule_date: schedule.schedule_date,
          shift_start: schedule.shift_start,
          shift_end: schedule.shift_end,
          shift_type: schedule.shift_type || 'standard',
          is_day_off: schedule.is_day_off || false,
          notes: schedule.notes || null,
          created_by: schedule.created_by || null,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,schedule_date',
        })
        .select()
        .single();

      if (error) {
        console.error('Error upserting schedule:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      results.push(data);
    }

    return NextResponse.json({ data: results.length === 1 ? results[0] : results }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/schedules:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/schedules?id=xxx
 * Delete a work schedule
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Schedule ID is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('work_schedules')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting schedule:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/schedules:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
