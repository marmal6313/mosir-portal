import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/racs/config
 * Get RACS integration configuration (without sensitive data)
 */
export async function GET(request: NextRequest) {
  try {
    const { data, error } = await supabase
      .from('racs_integration_config')
      .select('id, service_url, username, sync_enabled, sync_interval_minutes, last_sync_event_id, created_at, updated_at')
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching RACS config:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error in GET /api/racs/config:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/racs/config
 * Create or update RACS integration configuration
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.service_url || !body.username) {
      return NextResponse.json(
        { error: 'Missing required fields: service_url, username' },
        { status: 400 }
      );
    }

    // Check if config exists
    const { data: existingConfig } = await supabase
      .from('racs_integration_config')
      .select('id')
      .single();

    let result;

    if (existingConfig) {
      // Update existing config
      const updateData: any = {
        service_url: body.service_url,
        username: body.username,
        sync_enabled: body.sync_enabled !== undefined ? body.sync_enabled : true,
        sync_interval_minutes: body.sync_interval_minutes || 5,
        updated_at: new Date().toISOString(),
      };

      // Only update password if provided
      if (body.password) {
        // TODO: Implement encryption in production
        updateData.password_encrypted = body.password;
      }

      const { data, error } = await supabase
        .from('racs_integration_config')
        .update(updateData)
        .eq('id', existingConfig.id)
        .select('id, service_url, username, sync_enabled, sync_interval_minutes, updated_at')
        .single();

      if (error) {
        console.error('Error updating RACS config:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      result = data;
    } else {
      // Create new config
      if (!body.password) {
        return NextResponse.json(
          { error: 'Password is required for new configuration' },
          { status: 400 }
        );
      }

      const { data, error } = await supabase
        .from('racs_integration_config')
        .insert({
          service_url: body.service_url,
          username: body.username,
          password_encrypted: body.password, // TODO: Implement encryption in production
          sync_enabled: body.sync_enabled !== undefined ? body.sync_enabled : true,
          sync_interval_minutes: body.sync_interval_minutes || 5,
        })
        .select('id, service_url, username, sync_enabled, sync_interval_minutes, created_at')
        .single();

      if (error) {
        console.error('Error creating RACS config:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      result = data;
    }

    return NextResponse.json({ data: result }, { status: existingConfig ? 200 : 201 });
  } catch (error) {
    console.error('Error in POST /api/racs/config:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/racs/config
 * Partially update RACS configuration (e.g., toggle sync_enabled)
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();

    const { data: existingConfig } = await supabase
      .from('racs_integration_config')
      .select('id')
      .single();

    if (!existingConfig) {
      return NextResponse.json(
        { error: 'RACS configuration not found' },
        { status: 404 }
      );
    }

    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (body.sync_enabled !== undefined) {
      updateData.sync_enabled = body.sync_enabled;
    }

    if (body.sync_interval_minutes !== undefined) {
      updateData.sync_interval_minutes = body.sync_interval_minutes;
    }

    const { data, error } = await supabase
      .from('racs_integration_config')
      .update(updateData)
      .eq('id', existingConfig.id)
      .select('id, service_url, username, sync_enabled, sync_interval_minutes, updated_at')
      .single();

    if (error) {
      console.error('Error updating RACS config:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error in PATCH /api/racs/config:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
