-- Migration: Add shift preferences for users
-- Date: 2026-02-13

-- Add columns to users table for shift preferences
ALTER TABLE users
ADD COLUMN IF NOT EXISTS allowed_shift_types TEXT[] DEFAULT ARRAY['1', '2', '12', 'wn', 'on', 'wp', 'dw'],
ADD COLUMN IF NOT EXISTS default_shift_type VARCHAR(10) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS default_shift_start TIME DEFAULT '08:00',
ADD COLUMN IF NOT EXISTS default_shift_end TIME DEFAULT '16:00',
ADD COLUMN IF NOT EXISTS is_office_worker BOOLEAN DEFAULT true;

-- Comment for documentation
COMMENT ON COLUMN users.allowed_shift_types IS 'Array of allowed shift types for this user (1, 2, 12, wn, on, wp, dw). NULL = all allowed';
COMMENT ON COLUMN users.default_shift_type IS 'Default shift type when using "Fill Standard" button. NULL = use default_shift_start/end';
COMMENT ON COLUMN users.default_shift_start IS 'Default shift start time (used when is_office_worker=true or default_shift_type is NULL)';
COMMENT ON COLUMN users.default_shift_end IS 'Default shift end time (used when is_office_worker=true or default_shift_type is NULL)';
COMMENT ON COLUMN users.is_office_worker IS 'If true, user is office worker with standard 8:00-16:00 schedule by default';

-- Update existing users - set default values based on position
UPDATE users
SET is_office_worker = true,
    default_shift_start = '08:00',
    default_shift_end = '16:00',
    allowed_shift_types = ARRAY['wp', 'wn', 'on', 'dw']
WHERE position ILIKE '%dział%'
   OR position ILIKE '%księgowa%'
   OR position ILIKE '%kadr%'
   OR position ILIKE '%dyrektor%';

-- Example: Set shift workers (e.g., pool workers) to have shift options
-- UPDATE users
-- SET is_office_worker = false,
--     allowed_shift_types = ARRAY['1', '2', '12', 'wp', 'wn', 'on', 'dw'],
--     default_shift_type = '1'
-- WHERE position ILIKE '%ratowni%' OR position ILIKE '%obsługa basen%';

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_users_is_office_worker ON users(is_office_worker);
