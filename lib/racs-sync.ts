/**
 * Roger RACS-5 Event Synchronization Service
 * Synchronizes event logs from Roger system to attendance records
 *
 * Adapted for production Roger API:
 *  - TakeEntriesStartingFrom(entryId, sessionToken) — no count param
 *  - AccessCredentialID instead of CredentialID
 *  - Deleted instead of Active (inverted logic)
 *  - AccessUserGlobalID instead of PersonID in credentials
 */

import { createClient } from '@supabase/supabase-js';
import { getRacsClient, RACS_EVENT_CODES, RacsEventLogEntry } from './racs-client';

export interface SyncResult {
  success: boolean;
  eventsProcessed: number;
  eventsCreated: number;
  eventsSkipped: number;
  lastEventId: number;
  error?: string;
}

/**
 * Synchronize Roger RACS-5 events to attendance records
 */
export async function syncRacsEvents(): Promise<SyncResult> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const syncStarted = new Date();
  let eventsProcessed = 0;
  let eventsCreated = 0;
  let eventsSkipped = 0;
  let lastEventId = 0;

  // Create sync log entry
  const { data: syncLog, error: syncLogError } = await supabase
    .from('racs_sync_log')
    .insert({
      sync_started_at: syncStarted.toISOString(),
      status: 'in_progress',
    })
    .select()
    .single();

  if (syncLogError || !syncLog) {
    console.error('[RACS Sync] Failed to create sync log:', syncLogError);
    return {
      success: false,
      eventsProcessed: 0,
      eventsCreated: 0,
      eventsSkipped: 0,
      lastEventId: 0,
      error: 'Failed to create sync log',
    };
  }

  try {
    // Get RACS client
    const racsClient = await getRacsClient();
    if (!racsClient) {
      throw new Error('RACS client not configured');
    }

    // Get last synced event ID from config
    const { data: config } = await supabase
      .from('racs_integration_config')
      .select('last_sync_event_id')
      .eq('sync_enabled', true)
      .single();

    const startEventId = config?.last_sync_event_id || 0;

    // Get new events from RACS — no count param in production API
    const events = await racsClient.takeEntriesStartingFrom(startEventId + 1);

    console.log(`[RACS Sync] Retrieved ${events.length} events from RACS starting from ID ${startEventId + 1}`);

    // Get user mappings
    const { data: mappings } = await supabase
      .from('racs_user_mapping')
      .select('*')
      .eq('active', true);

    const personIdToUserId = new Map<number, string>();
    const credentialIdToUserId = new Map<number, string>();

    if (mappings) {
      for (const mapping of mappings) {
        if (mapping.racs_person_id) {
          personIdToUserId.set(mapping.racs_person_id, mapping.user_id);
        }
        if (mapping.racs_credential_id) {
          credentialIdToUserId.set(mapping.racs_credential_id, mapping.user_id);
        }
      }
    }

    // Get door information for better logging
    let doorCache: Map<number, string> = new Map();
    let pointCache: Map<number, { Name: string }> = new Map();

    try {
      const [doors, points] = await Promise.all([
        racsClient.getDoors(),
        racsClient.getPoints()
      ]);

      // Filter out deleted doors and populate caches
      doorCache = new Map(
        doors
          .filter(d => !d.Deleted)
          .map(d => [d.ID, d.Name])
      );

      pointCache = new Map(
        points
          .filter(p => !p.Deleted)
          .map(p => [p.ID, { Name: p.Name }])
      );

      console.log(`[RACS Sync] Loaded ${doors.length} doors and ${points.length} access points`);
    } catch (error) {
      console.warn('[RACS Sync] Failed to load door/point information:', error);
    }

    // Process each event
    for (const event of events) {
      eventsProcessed++;
      lastEventId = Math.max(lastEventId, event.ID);

      // Only process door access events
      if (
        event.EventCode !== RACS_EVENT_CODES.DOOR_ACCESS_GRANTED &&
        event.EventCode !== RACS_EVENT_CODES.DOOR_ACCESS_DENIED
      ) {
        eventsSkipped++;
        continue;
      }

      // Find user by person ID or AccessCredentialID
      let userId: string | undefined;
      if (event.PersonID) {
        userId = personIdToUserId.get(event.PersonID);
      }
      if (!userId && event.AccessCredentialID) {
        userId = credentialIdToUserId.get(event.AccessCredentialID);
      }

      if (!userId) {
        console.warn(
          `[RACS Sync] No user mapping for event ${event.ID}, PersonID: ${event.PersonID}, AccessCredentialID: ${event.AccessCredentialID}`
        );
        eventsSkipped++;
        continue;
      }

      // Determine event type
      let eventType = 'entry'; // Default

      if (event.EventCode === RACS_EVENT_CODES.DOOR_ACCESS_DENIED) {
        eventType = 'denied';
      } else {
        // Check access point name for direction (WE/WEJ = entry, WY/WYJ = exit)
        const point = pointCache.get(event.SourceID);
        if (point) {
          const name = point.Name.toUpperCase();
          if (name.includes('WY') || name.includes('WYJ')) {
            eventType = 'exit';
          }
        }
      }

      // Get door name
      const doorName = event.LocationID ? doorCache.get(event.LocationID) : undefined;

      // Check if this event already exists (deduplication)
      const { data: existingEvent } = await supabase
        .from('attendance_records')
        .select('id')
        .eq('racs_event_id', event.ID)
        .single();

      if (existingEvent) {
        eventsSkipped++;
        continue;
      }

      // Create attendance record
      const { error: insertError } = await supabase
        .from('attendance_records')
        .insert({
          user_id: userId,
          event_timestamp: event.LoggedOn,
          event_type: eventType,
          racs_event_id: event.ID,
          racs_event_code: event.EventCode,
          racs_door_id: event.LocationID,
          racs_door_name: doorName,
          racs_access_point_id: event.SourceID,
        });

      if (insertError) {
        console.error(`[RACS Sync] Failed to insert attendance record for event ${event.ID}:`, insertError);
        eventsSkipped++;
      } else {
        eventsCreated++;
      }
    }

    // Update last synced event ID in config
    if (lastEventId > startEventId) {
      await supabase
        .from('racs_integration_config')
        .update({ last_sync_event_id: lastEventId })
        .eq('sync_enabled', true);
    }

    // Update sync log
    await supabase
      .from('racs_sync_log')
      .update({
        sync_completed_at: new Date().toISOString(),
        last_event_id_synced: lastEventId,
        events_processed: eventsProcessed,
        events_created: eventsCreated,
        events_skipped: eventsSkipped,
        status: 'completed',
      })
      .eq('id', syncLog.id);

    // Disconnect from RACS
    await racsClient.disconnect();

    console.log(`[RACS Sync] Completed: ${eventsCreated} created, ${eventsSkipped} skipped, ${eventsProcessed} total`);

    return {
      success: true,
      eventsProcessed,
      eventsCreated,
      eventsSkipped,
      lastEventId,
    };
  } catch (error) {
    console.error('[RACS Sync] Error:', error);

    // Update sync log with error
    await supabase
      .from('racs_sync_log')
      .update({
        sync_completed_at: new Date().toISOString(),
        status: 'failed',
        error_message: error instanceof Error ? error.message : String(error),
        events_processed: eventsProcessed,
        events_created: eventsCreated,
        events_skipped: eventsSkipped,
      })
      .eq('id', syncLog.id);

    return {
      success: false,
      eventsProcessed,
      eventsCreated,
      eventsSkipped,
      lastEventId,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Sync RACS persons to user mappings
 * This helps administrators map RACS persons to portal users
 */
export async function syncRacsPersons(): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const racsClient = await getRacsClient();
    if (!racsClient) {
      throw new Error('RACS client not configured');
    }

    // Get persons from RACS
    const persons = await racsClient.getPersons();
    const activePersons = persons.filter(p => !p.Deleted);
    console.log(`[RACS Sync] Retrieved ${persons.length} persons (${activePersons.length} active) from RACS`);

    // Get credentials from RACS
    const credentials = await racsClient.getCredentials();
    const activeCredentials = credentials.filter(c => !c.Deleted);
    console.log(`[RACS Sync] Retrieved ${credentials.length} credentials (${activeCredentials.length} active) from RACS`);

    // Disconnect
    await racsClient.disconnect();

    return {
      success: true,
      count: activePersons.length,
    };
  } catch (error) {
    console.error('[RACS Sync] Failed to sync persons:', error);
    return {
      success: false,
      count: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Auto-map RACS persons to portal users based on name/email matching
 * Uses Deleted flag (inverted) and AccessUserGlobalID for credential linking
 */
export async function autoMapRacsUsers(): Promise<{ success: boolean; mapped: number; error?: string }> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const racsClient = await getRacsClient();
    if (!racsClient) {
      throw new Error('RACS client not configured');
    }

    // Get persons from RACS
    const persons = await racsClient.getPersons();

    // Get credentials from RACS
    const credentials = await racsClient.getCredentials();

    // Disconnect
    await racsClient.disconnect();

    // Get all portal users
    const { data: users } = await supabase
      .from('users')
      .select('id, first_name, last_name, email')
      .eq('active', true);

    if (!users) {
      throw new Error('Failed to fetch users');
    }

    let mappedCount = 0;

    // Try to match persons to users (only non-deleted persons)
    for (const person of persons) {
      if (person.Deleted) continue; // Skip deleted persons

      // Find matching user by name or email
      const matchingUser = users.find(u => {
        const nameMatch =
          u.first_name?.toLowerCase() === person.FirstName.toLowerCase() &&
          u.last_name?.toLowerCase() === person.LastName.toLowerCase();

        const emailMatch = person.Email && u.email?.toLowerCase() === person.Email.toLowerCase();

        return nameMatch || emailMatch;
      });

      if (!matchingUser) continue;

      // Find credentials for this person using AccessUserGlobalID
      const personCredentials = credentials.filter(
        c => c.AccessUserGlobalID === person.ID && !c.Deleted
      );
      const primaryCredential = personCredentials[0]; // Take first active credential

      // Check if mapping already exists
      const { data: existingMapping } = await supabase
        .from('racs_user_mapping')
        .select('id')
        .eq('user_id', matchingUser.id)
        .single();

      if (existingMapping) {
        // Update existing mapping
        await supabase
          .from('racs_user_mapping')
          .update({
            racs_person_id: person.ID,
            racs_credential_id: primaryCredential?.ID || null,
            racs_credential_number: primaryCredential?.CredentialNumber || null,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', matchingUser.id);
      } else {
        // Create new mapping
        await supabase
          .from('racs_user_mapping')
          .insert({
            user_id: matchingUser.id,
            racs_person_id: person.ID,
            racs_credential_id: primaryCredential?.ID || null,
            racs_credential_number: primaryCredential?.CredentialNumber || null,
          });
      }

      mappedCount++;
      console.log(
        `[RACS Sync] Mapped RACS person ${person.FirstName} ${person.LastName} → user ${matchingUser.first_name} ${matchingUser.last_name}`
      );
    }

    return {
      success: true,
      mapped: mappedCount,
    };
  } catch (error) {
    console.error('[RACS Sync] Failed to auto-map users:', error);
    return {
      success: false,
      mapped: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
