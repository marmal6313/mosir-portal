-- =====================================================
-- MOSiR Portal - Direct Messages & Presence Tracking
-- Migration: Slack-like Channels with DM and Online Status
-- =====================================================
-- This migration adds:
-- 1. Direct message conversations (1-on-1 chat)
-- 2. Direct message content (messages within conversations)
-- 3. User presence tracking (online/away/offline status)
-- 4. RLS policies for privacy
-- 5. Database functions for DM operations
-- 6. General channel creation
-- =====================================================

-- =====================================================
-- 1. TABLES
-- =====================================================

-- Direct message conversations (1-on-1 chat rooms)
CREATE TABLE IF NOT EXISTS direct_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    participant_1 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    participant_2 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_message_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Ensure participant_1 < participant_2 for uniqueness (no duplicate conversations)
    CONSTRAINT dm_participants_ordered CHECK (participant_1 < participant_2),
    CONSTRAINT dm_participants_unique UNIQUE (participant_1, participant_2)
);

-- Indexes for efficient DM queries
CREATE INDEX IF NOT EXISTS idx_dm_participant_1 ON direct_messages(participant_1);
CREATE INDEX IF NOT EXISTS idx_dm_participant_2 ON direct_messages(participant_2);
CREATE INDEX IF NOT EXISTS idx_dm_last_message ON direct_messages(last_message_at DESC);

COMMENT ON TABLE direct_messages IS 'Direct message conversations between two users';
COMMENT ON COLUMN direct_messages.participant_1 IS 'First participant (UUID must be < participant_2)';
COMMENT ON COLUMN direct_messages.participant_2 IS 'Second participant (UUID must be > participant_1)';
COMMENT ON COLUMN direct_messages.last_message_at IS 'Timestamp of last message (for sorting)';

-- Messages within DM conversations
CREATE TABLE IF NOT EXISTS direct_message_content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dm_id UUID NOT NULL REFERENCES direct_messages(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL CHECK (char_length(trim(content)) > 0),
    metadata JSONB DEFAULT '{}'::JSONB,
    read_by_recipient BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient message queries
CREATE INDEX IF NOT EXISTS idx_dm_content_dm_id ON direct_message_content(dm_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dm_content_sender ON direct_message_content(sender_id);
CREATE INDEX IF NOT EXISTS idx_dm_content_unread ON direct_message_content(dm_id, read_by_recipient)
    WHERE read_by_recipient = FALSE;

COMMENT ON TABLE direct_message_content IS 'Messages within direct message conversations';
COMMENT ON COLUMN direct_message_content.read_by_recipient IS 'Whether recipient has read this message (for unread badges)';
COMMENT ON COLUMN direct_message_content.metadata IS 'Optional metadata (mentions, attachments, etc.)';

-- User presence tracking (heartbeat pattern)
CREATE TABLE IF NOT EXISTS user_presence (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'away', 'offline')),
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for presence queries
CREATE INDEX IF NOT EXISTS idx_user_presence_status ON user_presence(status);
CREATE INDEX IF NOT EXISTS idx_user_presence_last_seen ON user_presence(last_seen_at DESC);

COMMENT ON TABLE user_presence IS 'User online/away/offline status tracking';
COMMENT ON COLUMN user_presence.status IS 'online = active, away = idle, offline = disconnected';
COMMENT ON COLUMN user_presence.last_seen_at IS 'Last heartbeat timestamp (updated every 30s)';

-- =====================================================
-- 2. TRIGGERS
-- =====================================================

-- Auto-update timestamp for user_presence
CREATE OR REPLACE FUNCTION update_user_presence_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_presence_updated ON user_presence;
CREATE TRIGGER trg_user_presence_updated
    BEFORE UPDATE ON user_presence
    FOR EACH ROW
    EXECUTE FUNCTION update_user_presence_timestamp();

-- Update DM conversation timestamp when new message arrives
CREATE OR REPLACE FUNCTION bump_dm_last_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE direct_messages
    SET last_message_at = NOW()
    WHERE id = NEW.dm_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_dm_content_last_message ON direct_message_content;
CREATE TRIGGER trg_dm_content_last_message
    AFTER INSERT ON direct_message_content
    FOR EACH ROW
    EXECUTE FUNCTION bump_dm_last_message();

-- =====================================================
-- 3. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all new tables
ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_message_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_presence ENABLE ROW LEVEL SECURITY;

-- ========== DIRECT MESSAGES POLICIES ==========

-- Only participants can see their DM conversations
DROP POLICY IF EXISTS "DM - participants can read" ON direct_messages;
CREATE POLICY "DM - participants can read"
    ON direct_messages
    FOR SELECT
    USING (
        auth.uid() = participant_1
        OR auth.uid() = participant_2
    );

-- Authenticated users can create DMs (must be participant)
DROP POLICY IF EXISTS "DM - authenticated can create" ON direct_messages;
CREATE POLICY "DM - authenticated can create"
    ON direct_messages
    FOR INSERT
    WITH CHECK (
        auth.uid() IS NOT NULL
        AND (auth.uid() = participant_1 OR auth.uid() = participant_2)
    );

-- ========== DIRECT MESSAGE CONTENT POLICIES ==========

-- Only participants can read messages
DROP POLICY IF EXISTS "DM content - participants can read" ON direct_message_content;
CREATE POLICY "DM content - participants can read"
    ON direct_message_content
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM direct_messages dm
            WHERE dm.id = direct_message_content.dm_id
            AND (dm.participant_1 = auth.uid() OR dm.participant_2 = auth.uid())
        )
    );

-- Only sender can insert (and must be participant)
DROP POLICY IF EXISTS "DM content - sender can insert" ON direct_message_content;
CREATE POLICY "DM content - sender can insert"
    ON direct_message_content
    FOR INSERT
    WITH CHECK (
        sender_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM direct_messages dm
            WHERE dm.id = direct_message_content.dm_id
            AND (dm.participant_1 = auth.uid() OR dm.participant_2 = auth.uid())
        )
    );

-- Recipient can mark as read
DROP POLICY IF EXISTS "DM content - recipient can update read status" ON direct_message_content;
CREATE POLICY "DM content - recipient can update read status"
    ON direct_message_content
    FOR UPDATE
    USING (
        -- Only recipient (not sender) can update
        EXISTS (
            SELECT 1 FROM direct_messages dm
            WHERE dm.id = direct_message_content.dm_id
            AND (
                (dm.participant_1 = auth.uid() AND sender_id = dm.participant_2)
                OR (dm.participant_2 = auth.uid() AND sender_id = dm.participant_1)
            )
        )
    );

-- ========== USER PRESENCE POLICIES ==========

-- All authenticated users can see presence status
DROP POLICY IF EXISTS "Presence - authenticated can read all" ON user_presence;
CREATE POLICY "Presence - authenticated can read all"
    ON user_presence
    FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- Users can insert their own presence
DROP POLICY IF EXISTS "Presence - users insert own" ON user_presence;
CREATE POLICY "Presence - users insert own"
    ON user_presence
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- Users can only update their own presence
DROP POLICY IF EXISTS "Presence - users update own status" ON user_presence;
CREATE POLICY "Presence - users update own status"
    ON user_presence
    FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- =====================================================
-- 4. DATABASE FUNCTIONS
-- =====================================================

-- Get or create DM conversation
CREATE OR REPLACE FUNCTION get_or_create_dm(p_other_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_dm_id UUID;
    v_participant_1 UUID;
    v_participant_2 UUID;
BEGIN
    -- Check authentication
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Prevent DM with yourself
    IF v_user_id = p_other_user_id THEN
        RAISE EXCEPTION 'Cannot create DM with yourself';
    END IF;

    -- Ensure participant_1 < participant_2 for uniqueness constraint
    IF v_user_id < p_other_user_id THEN
        v_participant_1 := v_user_id;
        v_participant_2 := p_other_user_id;
    ELSE
        v_participant_1 := p_other_user_id;
        v_participant_2 := v_user_id;
    END IF;

    -- Try to find existing DM
    SELECT id INTO v_dm_id
    FROM direct_messages
    WHERE participant_1 = v_participant_1
      AND participant_2 = v_participant_2;

    -- Create if doesn't exist
    IF v_dm_id IS NULL THEN
        INSERT INTO direct_messages (participant_1, participant_2)
        VALUES (v_participant_1, v_participant_2)
        RETURNING id INTO v_dm_id;
    END IF;

    RETURN v_dm_id;
END;
$$;

GRANT EXECUTE ON FUNCTION get_or_create_dm(UUID) TO authenticated;

COMMENT ON FUNCTION get_or_create_dm IS 'Get existing DM conversation or create new one between current user and another user';

-- Send direct message
CREATE OR REPLACE FUNCTION send_dm_message(
    p_dm_id UUID,
    p_content TEXT
)
RETURNS direct_message_content
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_sender_id UUID := auth.uid();
    v_message direct_message_content%ROWTYPE;
    v_recipient_id UUID;
BEGIN
    -- Check authentication
    IF v_sender_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Verify sender is participant in this DM
    IF NOT EXISTS (
        SELECT 1 FROM direct_messages
        WHERE id = p_dm_id
        AND (participant_1 = v_sender_id OR participant_2 = v_sender_id)
    ) THEN
        RAISE EXCEPTION 'Access denied to this DM';
    END IF;

    -- Insert message
    INSERT INTO direct_message_content (dm_id, sender_id, content)
    VALUES (p_dm_id, v_sender_id, p_content)
    RETURNING * INTO v_message;

    -- Get recipient ID for notification
    SELECT
        CASE
            WHEN participant_1 = v_sender_id THEN participant_2
            ELSE participant_1
        END INTO v_recipient_id
    FROM direct_messages
    WHERE id = p_dm_id;

    -- Create notification for recipient
    INSERT INTO notifications (user_id, title, message, type, action_url)
    VALUES (
        v_recipient_id,
        'Nowa wiadomość',
        'Otrzymałeś nową wiadomość prywatną',
        'info',
        '/dashboard/channels?dm=' || p_dm_id
    );

    RETURN v_message;
END;
$$;

GRANT EXECUTE ON FUNCTION send_dm_message(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION send_dm_message IS 'Send a direct message and create notification for recipient';

-- Update user presence (heartbeat)
CREATE OR REPLACE FUNCTION update_presence(
    p_status TEXT DEFAULT 'online'
)
RETURNS user_presence
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_presence user_presence%ROWTYPE;
BEGIN
    -- Check authentication
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Validate status
    IF p_status NOT IN ('online', 'away', 'offline') THEN
        RAISE EXCEPTION 'Invalid status. Must be: online, away, or offline';
    END IF;

    -- Upsert presence (insert or update)
    INSERT INTO user_presence (user_id, status, last_seen_at)
    VALUES (v_user_id, p_status, NOW())
    ON CONFLICT (user_id)
    DO UPDATE SET
        status = EXCLUDED.status,
        last_seen_at = NOW()
    RETURNING * INTO v_presence;

    RETURN v_presence;
END;
$$;

GRANT EXECUTE ON FUNCTION update_presence(TEXT) TO authenticated;

COMMENT ON FUNCTION update_presence IS 'Update or insert user presence status (called every 30s by client heartbeat)';

-- Create General channel (run once during migration)
CREATE OR REPLACE FUNCTION create_general_channel()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_channel_id UUID;
    v_superadmin_id UUID;
BEGIN
    -- Get first superadmin user
    SELECT id INTO v_superadmin_id
    FROM users
    WHERE role = 'superadmin'
    LIMIT 1;

    -- Require superadmin to exist
    IF v_superadmin_id IS NULL THEN
        RAISE EXCEPTION 'No superadmin found to create General channel';
    END IF;

    -- Check if General channel already exists
    SELECT id INTO v_channel_id
    FROM communication_channels
    WHERE name = 'General';

    -- Return existing channel ID if found
    IF v_channel_id IS NOT NULL THEN
        RAISE NOTICE 'General channel already exists with ID: %', v_channel_id;
        RETURN v_channel_id;
    END IF;

    -- Create General channel
    INSERT INTO communication_channels (
        name,
        description,
        visibility,
        created_by,
        is_archived
    )
    VALUES (
        'General',
        'Główny kanał komunikacji dostępny dla wszystkich użytkowników',
        'public',
        v_superadmin_id,
        FALSE
    )
    RETURNING id INTO v_channel_id;

    RAISE NOTICE 'General channel created with ID: %', v_channel_id;
    RETURN v_channel_id;
END;
$$;

COMMENT ON FUNCTION create_general_channel IS 'Create the default General channel visible to all users (idempotent)';

-- =====================================================
-- 5. EXECUTE GENERAL CHANNEL CREATION
-- =====================================================

-- Create the General channel (safe to run multiple times)
SELECT create_general_channel();

-- =====================================================
-- 6. VERIFICATION QUERIES
-- =====================================================

-- Verify tables were created
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename IN ('direct_messages', 'direct_message_content', 'user_presence')
    ) THEN
        RAISE NOTICE '✓ Direct message tables created successfully';
    ELSE
        RAISE WARNING '✗ Some tables are missing';
    END IF;
END $$;

-- Verify RLS is enabled
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename IN ('direct_messages', 'direct_message_content', 'user_presence')
        AND rowsecurity = true
    ) THEN
        RAISE NOTICE '✓ Row Level Security enabled on all tables';
    ELSE
        RAISE WARNING '✗ RLS not enabled on all tables';
    END IF;
END $$;

-- Verify General channel exists
DO $$
DECLARE
    v_general_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM communication_channels WHERE name = 'General'
    ) INTO v_general_exists;

    IF v_general_exists THEN
        RAISE NOTICE '✓ General channel exists';
    ELSE
        RAISE WARNING '✗ General channel not created';
    END IF;
END $$;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

-- Summary
DO $$
BEGIN
    RAISE NOTICE '====================================';
    RAISE NOTICE 'Migration completed successfully!';
    RAISE NOTICE '====================================';
    RAISE NOTICE 'Tables created:';
    RAISE NOTICE '  - direct_messages';
    RAISE NOTICE '  - direct_message_content';
    RAISE NOTICE '  - user_presence';
    RAISE NOTICE '';
    RAISE NOTICE 'Functions created:';
    RAISE NOTICE '  - get_or_create_dm(UUID)';
    RAISE NOTICE '  - send_dm_message(UUID, TEXT)';
    RAISE NOTICE '  - update_presence(TEXT)';
    RAISE NOTICE '  - create_general_channel()';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '  1. Update types/database.ts';
    RAISE NOTICE '  2. Create hooks/usePresence.tsx';
    RAISE NOTICE '  3. Create hooks/useDirectMessages.tsx';
    RAISE NOTICE '  4. Build UI components';
    RAISE NOTICE '====================================';
END $$;
