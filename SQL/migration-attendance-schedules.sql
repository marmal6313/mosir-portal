-- Migration: Add attendance tracking and work schedules integration with Roger RACS-5
-- Date: 2026-02-13

-- Table for Roger RACS-5 integration configuration
CREATE TABLE IF NOT EXISTS racs_integration_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_url VARCHAR(255) NOT NULL DEFAULT 'http://127.0.0.1:8892',
    username VARCHAR(100) NOT NULL,
    password_encrypted TEXT NOT NULL,
    last_sync_event_id INTEGER DEFAULT 0,
    sync_enabled BOOLEAN DEFAULT true,
    sync_interval_minutes INTEGER DEFAULT 5,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table for mapping Roger persons/credentials to portal users
CREATE TABLE IF NOT EXISTS racs_user_mapping (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    racs_person_id INTEGER,
    racs_credential_id INTEGER,
    racs_credential_number VARCHAR(100),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id),
    UNIQUE(racs_person_id),
    UNIQUE(racs_credential_id)
);

-- Table for work schedules (grafiki)
CREATE TABLE IF NOT EXISTS work_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
    schedule_date DATE NOT NULL,
    shift_start TIME NOT NULL,
    shift_end TIME NOT NULL,
    shift_type VARCHAR(50) DEFAULT 'standard', -- standard, night, flexible
    is_day_off BOOLEAN DEFAULT false,
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, schedule_date)
);

-- Table for attendance records from Roger RACS-5
CREATE TABLE IF NOT EXISTS attendance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    event_type VARCHAR(50) NOT NULL, -- entry, exit, denied
    racs_event_id INTEGER,
    racs_event_code INTEGER,
    racs_door_id INTEGER,
    racs_door_name VARCHAR(255),
    racs_access_point_id INTEGER,
    schedule_id UUID REFERENCES work_schedules(id) ON DELETE SET NULL,
    is_late BOOLEAN DEFAULT false,
    is_early_leave BOOLEAN DEFAULT false,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(racs_event_id)
);

-- Table for daily attendance summary
CREATE TABLE IF NOT EXISTS attendance_summary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    first_entry TIMESTAMP WITH TIME ZONE,
    last_exit TIMESTAMP WITH TIME ZONE,
    total_hours DECIMAL(5,2),
    scheduled_hours DECIMAL(5,2),
    is_present BOOLEAN DEFAULT false,
    is_late BOOLEAN DEFAULT false,
    is_early_leave BOOLEAN DEFAULT false,
    is_absent BOOLEAN DEFAULT false,
    absence_reason VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, date)
);

-- Table for tracking Roger event sync status
CREATE TABLE IF NOT EXISTS racs_sync_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sync_started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    sync_completed_at TIMESTAMP WITH TIME ZONE,
    last_event_id_synced INTEGER,
    events_processed INTEGER DEFAULT 0,
    events_created INTEGER DEFAULT 0,
    events_skipped INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'in_progress', -- in_progress, completed, failed
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_attendance_records_user_timestamp ON attendance_records(user_id, event_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_records_event_timestamp ON attendance_records(event_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_summary_user_date ON attendance_summary(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_work_schedules_user_date ON work_schedules(user_id, schedule_date DESC);
CREATE INDEX IF NOT EXISTS idx_work_schedules_date ON work_schedules(schedule_date);
CREATE INDEX IF NOT EXISTS idx_racs_user_mapping_user_id ON racs_user_mapping(user_id);

-- Enable Row Level Security
ALTER TABLE racs_integration_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE racs_user_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE racs_sync_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for racs_integration_config (admin only)
CREATE POLICY "Admin can manage RACS config" ON racs_integration_config
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

-- RLS Policies for work_schedules
CREATE POLICY "Users can view own schedules" ON work_schedules
    FOR SELECT USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role IN ('admin', 'manager')
        )
    );

CREATE POLICY "Managers can manage department schedules" ON work_schedules
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND (
                users.role = 'admin' OR
                (users.role = 'manager' AND users.department_id = work_schedules.department_id)
            )
        )
    );

-- RLS Policies for attendance_records
CREATE POLICY "Users can view own attendance" ON attendance_records
    FOR SELECT USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role IN ('admin', 'manager')
        )
    );

CREATE POLICY "System can insert attendance records" ON attendance_records
    FOR INSERT WITH CHECK (true);

-- RLS Policies for attendance_summary
CREATE POLICY "Users can view own attendance summary" ON attendance_summary
    FOR SELECT USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role IN ('admin', 'manager')
        )
    );

CREATE POLICY "System can manage attendance summary" ON attendance_summary
    FOR ALL WITH CHECK (true);

-- RLS Policies for racs_user_mapping
CREATE POLICY "Users can view own mapping" ON racs_user_mapping
    FOR SELECT USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

CREATE POLICY "Admin can manage user mappings" ON racs_user_mapping
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

-- RLS Policies for sync log (admin only)
CREATE POLICY "Admin can view sync logs" ON racs_sync_log
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

-- Function to calculate attendance summary
CREATE OR REPLACE FUNCTION calculate_attendance_summary(p_user_id UUID, p_date DATE)
RETURNS void AS $$
DECLARE
    v_first_entry TIMESTAMP WITH TIME ZONE;
    v_last_exit TIMESTAMP WITH TIME ZONE;
    v_total_hours DECIMAL(5,2);
    v_scheduled_hours DECIMAL(5,2);
    v_is_late BOOLEAN DEFAULT false;
    v_is_early_leave BOOLEAN DEFAULT false;
    v_schedule_start TIME;
    v_schedule_end TIME;
BEGIN
    -- Get first entry and last exit for the day
    SELECT MIN(event_timestamp), MAX(event_timestamp)
    INTO v_first_entry, v_last_exit
    FROM attendance_records
    WHERE user_id = p_user_id
    AND DATE(event_timestamp) = p_date
    AND event_type = 'entry';

    -- Get scheduled hours
    SELECT shift_start, shift_end
    INTO v_schedule_start, v_schedule_end
    FROM work_schedules
    WHERE user_id = p_user_id
    AND schedule_date = p_date
    AND is_day_off = false;

    -- Calculate total hours if we have both entry and exit
    IF v_first_entry IS NOT NULL AND v_last_exit IS NOT NULL THEN
        v_total_hours := EXTRACT(EPOCH FROM (v_last_exit - v_first_entry)) / 3600;
    END IF;

    -- Calculate scheduled hours
    IF v_schedule_start IS NOT NULL AND v_schedule_end IS NOT NULL THEN
        v_scheduled_hours := EXTRACT(EPOCH FROM (v_schedule_end - v_schedule_start)) / 3600;

        -- Check if late (more than 15 minutes)
        IF v_first_entry IS NOT NULL AND v_first_entry::TIME > (v_schedule_start + INTERVAL '15 minutes') THEN
            v_is_late := true;
        END IF;

        -- Check if early leave (more than 15 minutes)
        IF v_last_exit IS NOT NULL AND v_last_exit::TIME < (v_schedule_end - INTERVAL '15 minutes') THEN
            v_is_early_leave := true;
        END IF;
    END IF;

    -- Insert or update summary
    INSERT INTO attendance_summary (
        user_id, date, first_entry, last_exit, total_hours, scheduled_hours,
        is_present, is_late, is_early_leave, is_absent, updated_at
    ) VALUES (
        p_user_id, p_date, v_first_entry, v_last_exit, v_total_hours, v_scheduled_hours,
        v_first_entry IS NOT NULL, v_is_late, v_is_early_leave, v_first_entry IS NULL,
        CURRENT_TIMESTAMP
    )
    ON CONFLICT (user_id, date) DO UPDATE SET
        first_entry = EXCLUDED.first_entry,
        last_exit = EXCLUDED.last_exit,
        total_hours = EXCLUDED.total_hours,
        scheduled_hours = EXCLUDED.scheduled_hours,
        is_present = EXCLUDED.is_present,
        is_late = EXCLUDED.is_late,
        is_early_leave = EXCLUDED.is_early_leave,
        is_absent = EXCLUDED.is_absent,
        updated_at = CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update attendance summary when attendance records are inserted
CREATE OR REPLACE FUNCTION trigger_update_attendance_summary()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM calculate_attendance_summary(NEW.user_id, DATE(NEW.event_timestamp));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_attendance_summary_on_insert
AFTER INSERT ON attendance_records
FOR EACH ROW
EXECUTE FUNCTION trigger_update_attendance_summary();

-- Comments for documentation
COMMENT ON TABLE racs_integration_config IS 'Configuration for Roger RACS-5 access control system integration';
COMMENT ON TABLE racs_user_mapping IS 'Maps portal users to Roger RACS-5 persons and credentials';
COMMENT ON TABLE work_schedules IS 'Work schedules (grafiki) for employees';
COMMENT ON TABLE attendance_records IS 'Attendance records synchronized from Roger RACS-5 event log';
COMMENT ON TABLE attendance_summary IS 'Daily attendance summary calculated from attendance records';
COMMENT ON TABLE racs_sync_log IS 'Log of Roger RACS-5 event synchronization runs';
