import { NextRequest, NextResponse } from 'next/server';
import { syncRacsEvents } from '@/lib/racs-sync';

/**
 * Cron endpoint for automatic RACS event synchronization
 * This should be called periodically (e.g., every 5 minutes) by a cron service
 *
 * Setup options:
 * 1. Vercel Cron Jobs (vercel.json)
 * 2. External cron service (cron-job.org, etc.)
 * 3. System cron on the server
 *
 * Add authorization header check in production!
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authorization (add your secret key check here)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[CRON] Starting RACS event synchronization...');

    const result = await syncRacsEvents();

    if (!result.success) {
      console.error('[CRON] RACS sync failed:', result.error);
      return NextResponse.json(
        { error: result.error, result },
        { status: 500 }
      );
    }

    console.log(
      `[CRON] RACS sync completed: ${result.eventsCreated} created, ${result.eventsSkipped} skipped`
    );

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      result,
    });
  } catch (error) {
    console.error('[CRON] Error in RACS sync cron:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// Also support POST for manual triggers
export async function POST(request: NextRequest) {
  return GET(request);
}
