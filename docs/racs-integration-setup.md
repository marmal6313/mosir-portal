# Roger RACS-5 Attendance Integration - Setup Guide

This guide explains how to set up and use the Roger RACS-5 Access Control System integration for attendance tracking in the MOSIR Portal.

## Overview

The integration allows you to:
- Automatically track employee attendance from Roger RACS-5 door access events
- Manage work schedules (grafiki) for employees
- View attendance reports and summaries
- Track late arrivals, early departures, and absences
- Match RACS persons/credentials to portal users

## Architecture

```
Roger RACS-5 System
    ↓ (SOAP/WCF API)
RACS Client (lib/racs-client.ts)
    ↓
RACS Sync Service (lib/racs-sync.ts)
    ↓
PostgreSQL Database (Supabase)
    ↓
API Routes (/api/attendance, /api/schedules, /api/racs)
    ↓
Frontend UI Components
```

## Database Schema

The integration adds the following tables:

- **racs_integration_config** - Roger system connection settings
- **racs_user_mapping** - Maps portal users to RACS persons/credentials
- **work_schedules** - Employee work schedules (grafiki)
- **attendance_records** - Raw attendance events from RACS
- **attendance_summary** - Daily attendance summaries with calculated metrics
- **racs_sync_log** - Synchronization history and status

## Setup Instructions

### 1. Run Database Migration

Execute the SQL migration to create the required tables:

```bash
# Using Supabase CLI
supabase db reset  # if in development
# or
psql -h your-db-host -U your-user -d your-db -f SQL/migration-attendance-schedules.sql
```

Or manually run the SQL from: `SQL/migration-attendance-schedules.sql`

### 2. Configure Roger RACS-5 Connection

You need the following information from your Roger RACS-5 system:

- **Service URL**: Default is `http://127.0.0.1:8892` (or your RACS server IP)
- **Username**: VISO Operator username
- **Password**: VISO Operator password

#### Option A: Through the UI (Recommended)

1. Navigate to Admin Settings → RACS Integration
2. Enter the service URL, username, and password
3. Enable synchronization
4. Set sync interval (default: 5 minutes)
5. Click "Save Configuration"

#### Option B: Through API

```bash
curl -X POST http://localhost:3000/api/racs/config \
  -H "Content-Type: application/json" \
  -d '{
    "service_url": "http://192.168.1.100:8892",
    "username": "admin",
    "password": "your-password",
    "sync_enabled": true,
    "sync_interval_minutes": 5
  }'
```

#### Option C: Direct Database Insert

```sql
INSERT INTO racs_integration_config (
  service_url,
  username,
  password_encrypted,
  sync_enabled,
  sync_interval_minutes
) VALUES (
  'http://192.168.1.100:8892',
  'admin',
  'your-password',  -- TODO: Implement encryption
  true,
  5
);
```

### 3. Map Users to RACS Persons/Credentials

Before attendance tracking works, you need to map portal users to their RACS persons/credentials.

#### Auto-Mapping (Recommended First Step)

This automatically maps users based on matching names and emails:

```bash
curl -X POST http://localhost:3000/api/racs/sync \
  -H "Content-Type: application/json" \
  -d '{"action": "auto-map"}'
```

#### Manual Mapping

For users not auto-mapped, create mappings manually:

```bash
curl -X POST http://localhost:3000/api/racs/mappings \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "uuid-of-portal-user",
    "racs_person_id": 123,
    "racs_credential_id": 456,
    "racs_credential_number": "12345678"
  }'
```

To get RACS person IDs and credential IDs, you can query the RACS system:

```javascript
const racsClient = await getRacsClient();
const persons = await racsClient.getPersons();
const credentials = await racsClient.getCredentials();
```

### 4. Set Up Automatic Synchronization

The system needs to periodically pull events from RACS. Choose one option:

#### Option A: Vercel Cron Jobs (if using Vercel)

Create/update `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/racs-sync",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

Set environment variable:
```bash
CRON_SECRET=your-random-secret-key
```

#### Option B: External Cron Service

Use a service like cron-job.org or EasyCron:

1. Create a cron job that calls: `https://your-domain.com/api/cron/racs-sync`
2. Set schedule to every 5 minutes: `*/5 * * * *`
3. Add authorization header: `Bearer your-cron-secret`

#### Option C: System Cron (Linux server)

Add to crontab:

```bash
*/5 * * * * curl -X POST https://your-domain.com/api/cron/racs-sync \
  -H "Authorization: Bearer your-cron-secret"
```

#### Option D: Manual Sync (for testing)

Trigger synchronization manually via API:

```bash
curl -X POST http://localhost:3000/api/racs/sync \
  -H "Content-Type: application/json" \
  -d '{"action": "sync"}'
```

### 5. Create Work Schedules (Grafiki)

Create work schedules for employees so the system can calculate late arrivals and early departures:

```bash
curl -X POST http://localhost:3000/api/schedules \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "uuid-of-user",
    "schedule_date": "2026-02-13",
    "shift_start": "08:00:00",
    "shift_end": "16:00:00",
    "shift_type": "standard"
  }'
```

Or create bulk schedules for a week/month:

```javascript
const schedules = [];
for (let day = 1; day <= 28; day++) {
  schedules.push({
    user_id: "uuid-of-user",
    schedule_date: `2026-02-${day.toString().padStart(2, '0')}`,
    shift_start: "08:00:00",
    shift_end: "16:00:00",
    shift_type: "standard",
    is_day_off: day % 7 === 0 || day % 7 === 6 // Weekends off
  });
}

await fetch('/api/schedules', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(schedules)
});
```

## API Endpoints

### Attendance

- `GET /api/attendance?userId=xxx&startDate=2026-02-01&endDate=2026-02-28`
  - Get attendance records

- `GET /api/attendance/summary?userId=xxx&month=2026-02`
  - Get attendance summary with statistics

### Schedules

- `GET /api/schedules?userId=xxx&month=2026-02`
  - Get work schedules

- `POST /api/schedules`
  - Create/update schedules

- `DELETE /api/schedules?id=xxx`
  - Delete schedule

### RACS Integration

- `GET /api/racs/config`
  - Get RACS configuration

- `POST /api/racs/config`
  - Create/update RACS configuration

- `POST /api/racs/sync`
  - Trigger manual sync (action: "sync" or "auto-map")

- `GET /api/racs/sync`
  - Get sync status and logs

- `GET /api/racs/mappings`
  - Get user mappings

- `POST /api/racs/mappings`
  - Create/update user mapping

- `DELETE /api/racs/mappings?id=xxx`
  - Delete user mapping

## How It Works

### Event Synchronization Flow

1. **Cron job triggers** → `/api/cron/racs-sync`
2. **RACS Sync Service** connects to Roger RACS-5 via SOAP API
3. **Retrieves new events** starting from last synced event ID
4. **Filters door access events** (event codes 601, 602)
5. **Maps events to users** via racs_user_mapping table
6. **Creates attendance records** in database
7. **Trigger fires** to update attendance_summary table
8. **Calculates metrics**:
   - First entry / last exit time
   - Total hours worked
   - Late arrival (>15 min after schedule)
   - Early departure (>15 min before schedule)
   - Absence detection

### Event Types

- **Event 601 - Door Access Granted**: Entry to building
- **Event 602 - Door Access Denied**: Denied entry (tracked but not counted as attendance)
- Other events are ignored for attendance purposes

### Attendance Calculation

The system automatically calculates:

- **First Entry**: Earliest door access of the day
- **Last Exit**: Latest door access of the day
- **Total Hours**: Time between first entry and last exit
- **Scheduled Hours**: From work_schedules table
- **Is Late**: Entry more than 15 minutes after scheduled start
- **Is Early Leave**: Exit more than 15 minutes before scheduled end
- **Is Absent**: No entry recorded for a scheduled work day

## Troubleshooting

### No attendance records appearing

1. Check RACS configuration is enabled:
   ```sql
   SELECT * FROM racs_integration_config WHERE sync_enabled = true;
   ```

2. Check sync logs for errors:
   ```sql
   SELECT * FROM racs_sync_log ORDER BY sync_started_at DESC LIMIT 10;
   ```

3. Verify user mappings exist:
   ```sql
   SELECT * FROM racs_user_mapping WHERE active = true;
   ```

4. Test RACS connection manually:
   ```bash
   curl -X POST http://localhost:3000/api/racs/sync \
     -H "Content-Type: application/json" \
     -d '{"action": "sync"}'
   ```

### Users not being mapped

1. Run auto-mapping:
   ```bash
   curl -X POST http://localhost:3000/api/racs/sync \
     -H "Content-Type: application/json" \
     -d '{"action": "auto-map"}'
   ```

2. Check RACS persons and credentials are available
3. Manually create mappings for users that can't be auto-matched

### Late/Early flags not working

1. Ensure work schedules are created:
   ```sql
   SELECT * FROM work_schedules WHERE user_id = 'xxx' AND schedule_date = '2026-02-13';
   ```

2. Verify schedule times are correct
3. Check attendance_summary calculation trigger is working

### RACS connection errors

1. Verify RACS service URL is correct and accessible
2. Check username/password are correct
3. Ensure RACS Web Services are enabled and running
4. Check firewall rules allow connection to port 8892
5. Test connection from server:
   ```bash
   curl http://racs-server:8892/SessionManagement
   ```

## Security Considerations

### Production Deployment

1. **Encrypt passwords**: Implement proper encryption for RACS password in database
   ```typescript
   // Add encryption before storing
   const encryptedPassword = await encrypt(password);
   ```

2. **Secure cron endpoint**: Add strong authorization
   ```typescript
   const cronSecret = process.env.CRON_SECRET;
   if (authHeader !== `Bearer ${cronSecret}`) {
     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
   }
   ```

3. **Use HTTPS**: Always use HTTPS in production
4. **Network security**: Place RACS server on internal network
5. **Rate limiting**: Add rate limiting to API endpoints
6. **Audit logging**: Log all configuration changes and manual syncs

## Performance Optimization

- Sync runs every 5 minutes by default
- Each sync fetches up to 500 events
- Events are deduplicated by racs_event_id
- Attendance summary is calculated via database trigger (efficient)
- Use indexes on frequently queried columns (already added in migration)

## Monitoring

Monitor these metrics:

- Sync success rate (from racs_sync_log)
- Number of unmapped users
- Events processed per sync
- API response times
- Database table sizes

```sql
-- Check sync health
SELECT
  status,
  COUNT(*) as count,
  AVG(events_processed) as avg_events
FROM racs_sync_log
WHERE sync_started_at > NOW() - INTERVAL '24 hours'
GROUP BY status;

-- Check unmapped users with attendance
SELECT DISTINCT ar.user_id, u.first_name, u.last_name
FROM attendance_records ar
LEFT JOIN racs_user_mapping rum ON ar.user_id = rum.user_id
JOIN users u ON ar.user_id = u.id
WHERE rum.id IS NULL;
```

## Future Enhancements

Potential improvements:

- Real-time webhooks instead of polling
- Multiple RACS systems support
- Geofencing/location-based attendance
- Mobile app check-in/check-out
- Overtime calculation
- Leave request integration
- Biometric data integration
- Shift swap/trade functionality
- Department-based schedule templates

## Support

For issues or questions:
1. Check sync logs: `GET /api/racs/sync`
2. Review RACS-5 Integration Manual PDF
3. Check database constraints and RLS policies
4. Contact Roger support for RACS API issues
