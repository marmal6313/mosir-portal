import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key'
);

/**
 * GET /api/racs/mappings
 * Get user mappings between RACS and portal
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const includeInactive = searchParams.get('includeInactive') === 'true';

    let query = supabase
      .from('racs_user_mapping')
      .select(`
        *,
        user:users(id, first_name, last_name, email, department_id, position, active)
      `)
      .order('created_at', { ascending: false });

    if (userId) {
      query = query.eq('user_id', userId);
    }

    if (!includeInactive) {
      query = query.eq('active', true);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching RACS mappings:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error in GET /api/racs/mappings:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/racs/mappings
 * Create or update user mapping
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.user_id) {
      return NextResponse.json(
        { error: 'Missing required field: user_id' },
        { status: 400 }
      );
    }

    // Check if mapping already exists for this user
    const { data: existingMapping } = await supabase
      .from('racs_user_mapping')
      .select('id')
      .eq('user_id', body.user_id)
      .single();

    let result;

    if (existingMapping) {
      // Update existing mapping
      const { data, error } = await supabase
        .from('racs_user_mapping')
        .update({
          racs_person_id: body.racs_person_id || null,
          racs_credential_id: body.racs_credential_id || null,
          racs_credential_number: body.racs_credential_number || null,
          active: body.active !== undefined ? body.active : true,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', body.user_id)
        .select()
        .single();

      if (error) {
        console.error('Error updating RACS mapping:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      result = data;
    } else {
      // Create new mapping
      const { data, error } = await supabase
        .from('racs_user_mapping')
        .insert({
          user_id: body.user_id,
          racs_person_id: body.racs_person_id || null,
          racs_credential_id: body.racs_credential_id || null,
          racs_credential_number: body.racs_credential_number || null,
          active: body.active !== undefined ? body.active : true,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating RACS mapping:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      result = data;
    }

    return NextResponse.json({ data: result }, { status: existingMapping ? 200 : 201 });
  } catch (error) {
    console.error('Error in POST /api/racs/mappings:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/racs/mappings?id=xxx
 * Delete or deactivate a user mapping
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');
    const soft = searchParams.get('soft') === 'true'; // Soft delete (deactivate) vs hard delete

    if (!id) {
      return NextResponse.json({ error: 'Mapping ID is required' }, { status: 400 });
    }

    if (soft) {
      // Soft delete - just deactivate
      const { error } = await supabase
        .from('racs_user_mapping')
        .update({ active: false, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) {
        console.error('Error deactivating RACS mapping:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    } else {
      // Hard delete
      const { error } = await supabase
        .from('racs_user_mapping')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting RACS mapping:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/racs/mappings:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
