# Troubleshooting: Authentication Timeout After Deployment

**Problem:** User cannot login after deploying release-250213. Browser shows error:
```
Auth check timed out, clearing local session and redirecting to /login
```

## Root Cause Analysis

The authentication timeout in [app/page.tsx:26](app/page.tsx#L26) has a 4-second limit. When `supabase.auth.getSession()` takes longer than 4 seconds, it triggers the timeout.

### Possible Causes

1. **SQL Migrations Not Executed** ⚠️ MOST LIKELY
   - The PRE-DEPLOYMENT-CHECKLIST requires running 3 SQL migrations BEFORE deployment
   - If migrations weren't run, the database schema doesn't match what the app expects
   - This can cause slow queries or errors that delay authentication

2. **New RLS Policies Causing Slow Queries**
   - The `fix-rls-attendance.sql` migration modifies RLS policies
   - If improperly configured, RLS can slow down auth-related queries

3. **Supabase Service Latency**
   - Network connectivity verified OK (REST API responds quickly)
   - Unlikely but possible during high load

## Solution

### Step 1: Verify SQL Migrations Were Executed

Run this verification script in **Supabase Dashboard → SQL Editor**:

```bash
# Open this file and copy its contents to Supabase SQL Editor
cat SQL/verify-release-250213-migrations.sql
```

**Expected Result:**
```
✅ ALL MIGRATIONS EXECUTED
```

**If you see:** `❌ MIGRATIONS MISSING`
→ **You MUST run the migrations before deploying!**

### Step 2: Execute Missing Migrations (If Needed)

**CRITICAL:** Execute in this exact order:

1. **Migration 1:** `SQL/migration-attendance-schedules.sql`
   - Creates 6 tables for RACS integration
   - Verify: `SELECT * FROM racs_integration_config LIMIT 1;` (should return empty result, not error)

2. **Migration 2:** `SQL/fix-rls-attendance.sql`
   - Fixes RLS policies for attendance tables
   - Verify: `SELECT * FROM pg_policies WHERE tablename = 'attendance_records';`

3. **Migration 3:** `SQL/migration-user-shift-preferences.sql`
   - Adds 5 columns to users table
   - Verify: `SELECT allowed_shift_types FROM users LIMIT 1;`

### Step 3: Deploy Hotfix with Increased Timeout

If migrations are correct but timeout still occurs, deploy the hotfix:

```bash
# Hotfix commit: b9432738
# - Increases auth timeout from 4s to 10s
# - Adds performance logging to track getSession() duration

# Tag is already pushed: release-250213-hotfix1
# Wait for GitHub Actions to build, then deploy:

kubectl set image deployment/mosir-portal \
  mosir-portal=ghcr.io/marmal6313/mosir-portal:release-250213-hotfix1 \
  -n apps

kubectl rollout status deployment/mosir-portal -n apps
```

### Step 4: Monitor Auth Performance

After deployment, check browser console for new logging:
```
Starting auth session check...
Auth session check completed in XXXms
```

- **< 1000ms**: Excellent
- **1000-4000ms**: Normal (original timeout)
- **4000-10000ms**: Slow (investigate RLS/Supabase)
- **> 10000ms**: Critical (check migrations, RLS policies)

## Prevention

### Before Every Deployment

1. ✅ Run SQL migrations in Supabase FIRST
2. ✅ Run verification script to confirm migrations
3. ✅ Then deploy application code
4. ✅ Check smoke tests including login

### Checklist Integration

The `docs/PRE-DEPLOYMENT-CHECKLIST.md` already includes this:

```markdown
### 1. Migracje SQL (Supabase)
**KRYTYCZNE:** Wykonaj migracje PRZED deployem aplikacji!

- [ ] Migration 1: SQL/migration-attendance-schedules.sql
- [ ] Migration 2: SQL/fix-rls-attendance.sql
- [ ] Migration 3: SQL/migration-user-shift-preferences.sql
```

**Always follow the checklist!**

## Files Modified

- [app/page.tsx:26](app/page.tsx#L26) - Increased timeout to 10s, added logging
- [SQL/verify-release-250213-migrations.sql](SQL/verify-release-250213-migrations.sql) - Verification script

## Related Issues

- GitHub Actions image pull timeout: Separate issue with GHCR pulls on k8s nodes
- Fixed by deploying from working tag

---

**Status:** Rolled back to `release-250213` (stable)
**Next Steps:**
1. Verify migrations in Supabase
2. Re-deploy with hotfix if needed
3. Update deployment procedures to enforce migration verification
