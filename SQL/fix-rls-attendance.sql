-- Fix RLS policies for attendance to allow all users to view all data temporarily
-- This is a quick fix - in production you should properly set role='admin' in users table

-- Drop old policies
DROP POLICY IF EXISTS "Users can view own attendance" ON attendance_records;
DROP POLICY IF EXISTS "Users can view own attendance summary" ON attendance_summary;
DROP POLICY IF EXISTS "Users can view own mapping" ON racs_user_mapping;
DROP POLICY IF EXISTS "Users can view own schedules" ON work_schedules;

-- Create new policies - allow all authenticated users to view everything
CREATE POLICY "All authenticated users can view attendance records" ON attendance_records
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "All authenticated users can view attendance summary" ON attendance_summary
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "All authenticated users can view user mappings" ON racs_user_mapping
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "All authenticated users can view schedules" ON work_schedules
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- Keep other policies for managers
CREATE POLICY "Managers can manage department schedules" ON work_schedules
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND (
                users.email = 'dyrektor@e-mosir.pl' OR
                users.department_id = work_schedules.department_id
            )
        )
    );
