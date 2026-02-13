-- Verification script for release-250213 migrations
-- Run this in Supabase SQL Editor to check if all migrations were executed

-- Check 1: RACS integration tables (migration-attendance-schedules.sql)
SELECT 'Check 1: RACS tables' AS check_name,
       EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'racs_integration_config') AS racs_integration_config,
       EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'racs_user_mapping') AS racs_user_mapping,
       EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'work_schedules') AS work_schedules,
       EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'attendance_records') AS attendance_records,
       EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'attendance_summary') AS attendance_summary,
       EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'racs_sync_log') AS racs_sync_log;

-- Check 2: User shift preferences columns (migration-user-shift-preferences.sql)
SELECT 'Check 2: User shift preferences' AS check_name,
       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'allowed_shift_types') AS allowed_shift_types,
       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'default_shift_type') AS default_shift_type,
       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'default_shift_start') AS default_shift_start,
       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'default_shift_end') AS default_shift_end,
       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'is_office_worker') AS is_office_worker;

-- Check 3: RLS policies for attendance (fix-rls-attendance.sql)
SELECT 'Check 3: Attendance RLS policies' AS check_name,
       COUNT(*) FILTER (WHERE tablename = 'attendance_records') AS attendance_records_policies,
       COUNT(*) FILTER (WHERE tablename = 'attendance_summary') AS attendance_summary_policies
FROM pg_policies
WHERE tablename IN ('attendance_records', 'attendance_summary');

-- Summary
SELECT
    CASE
        WHEN (SELECT COUNT(*) FROM information_schema.tables WHERE table_name IN ('racs_integration_config', 'racs_user_mapping', 'work_schedules', 'attendance_records', 'attendance_summary', 'racs_sync_log')) = 6
             AND (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'users' AND column_name IN ('allowed_shift_types', 'default_shift_type', 'default_shift_start', 'default_shift_end', 'is_office_worker')) = 5
        THEN '✅ ALL MIGRATIONS EXECUTED'
        ELSE '❌ MIGRATIONS MISSING - RUN MIGRATIONS BEFORE DEPLOYMENT!'
    END AS migration_status;
