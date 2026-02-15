-- ============================================================
-- Migration: Chat Notification Preferences + Channel Message Notifications
-- Data: 2026-02-15
-- Opis: Dodaje preferencje powiadomień czatu (kanały, DM, dźwięk)
--        oraz tworzy notyfikacje dla wszystkich członków kanału
-- ============================================================

-- 1. Dodaj nowe kolumny do notification_preferences
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS notify_channel_messages BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_dm_messages BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sound_enabled BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.notification_preferences.notify_channel_messages IS 'Czy powiadamiać o wiadomościach na kanałach (domyślnie: tak)';
COMMENT ON COLUMN public.notification_preferences.notify_dm_messages IS 'Czy powiadamiać o wiadomościach prywatnych (domyślnie: tak)';
COMMENT ON COLUMN public.notification_preferences.sound_enabled IS 'Czy odtwarzać dźwięk powiadomienia (domyślnie: tak)';

-- 2. Zaktualizuj funkcję get_notification_preferences
--    (DROP wymagany bo zmienił się typ zwracany - nowe kolumny OUT)
DROP FUNCTION IF EXISTS public.get_notification_preferences(UUID);
CREATE OR REPLACE FUNCTION public.get_notification_preferences(p_user_id UUID)
RETURNS TABLE(
  email_enabled BOOLEAN,
  whatsapp_enabled BOOLEAN,
  email_address TEXT,
  whatsapp_number TEXT,
  notify_task_assigned BOOLEAN,
  notify_task_completed BOOLEAN,
  notify_task_overdue BOOLEAN,
  notify_mentions BOOLEAN,
  notify_channel_messages BOOLEAN,
  notify_dm_messages BOOLEAN,
  sound_enabled BOOLEAN,
  quiet_hours_start TIME,
  quiet_hours_end TIME
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(np.email_enabled, false),
    COALESCE(np.whatsapp_enabled, false),
    COALESCE(np.email_address, au.email),
    COALESCE(np.whatsapp_number, u.whatsapp),
    COALESCE(np.notify_task_assigned, true),
    COALESCE(np.notify_task_completed, true),
    COALESCE(np.notify_task_overdue, true),
    COALESCE(np.notify_mentions, true),
    COALESCE(np.notify_channel_messages, true),
    COALESCE(np.notify_dm_messages, true),
    COALESCE(np.sound_enabled, true),
    np.quiet_hours_start,
    np.quiet_hours_end
  FROM auth.users au
  LEFT JOIN public.users u ON u.id = au.id
  LEFT JOIN public.notification_preferences np ON np.user_id = au.id
  WHERE au.id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Zaktualizuj create_channel_message - dodaj powiadomienia dla członków kanału
CREATE OR REPLACE FUNCTION create_channel_message(
    p_channel_id UUID,
    p_content TEXT,
    p_mentions UUID[] DEFAULT NULL
)
RETURNS channel_messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_sender UUID := auth.uid();
    v_message channel_messages%ROWTYPE;
    v_unique_mentions UUID[];
    v_channel_name TEXT;
    v_sender_first TEXT;
    v_sender_last TEXT;
    v_sender_name TEXT;
    v_channel_visibility TEXT;
BEGIN
    IF v_sender IS NULL THEN
        RAISE EXCEPTION 'Brak uwierzytelnionego użytkownika';
    END IF;

    IF NOT channel_is_accessible(p_channel_id) THEN
        RAISE EXCEPTION 'Brak uprawnień do tego kanału';
    END IF;

    INSERT INTO channel_messages (channel_id, sender_id, content)
    VALUES (p_channel_id, v_sender, p_content)
    RETURNING * INTO v_message;

    SELECT name, visibility INTO v_channel_name, v_channel_visibility
    FROM communication_channels WHERE id = p_channel_id;

    SELECT first_name, last_name INTO v_sender_first, v_sender_last FROM users WHERE id = v_sender;
    v_sender_name := TRIM(COALESCE(v_sender_first, '') || ' ' || COALESCE(v_sender_last, ''));

    -- Handle @mentions
    IF p_mentions IS NOT NULL THEN
        SELECT ARRAY(
            SELECT DISTINCT uid
            FROM UNNEST(p_mentions) AS uid
            WHERE uid IS NOT NULL AND uid <> v_sender
        ) INTO v_unique_mentions;

        IF v_unique_mentions IS NOT NULL AND array_length(v_unique_mentions, 1) > 0 THEN
            INSERT INTO channel_message_mentions (message_id, user_id)
            SELECT v_message.id, uid FROM UNNEST(v_unique_mentions) AS uid;

            INSERT INTO notifications (user_id, title, message, type, action_url)
            SELECT
              uid,
              'Nowa wzmianka w kanale',
              COALESCE(v_channel_name, 'Kanał') || ': wspomnienie od ' || v_sender_name,
              'mention',
              '/dashboard/channels?channel=' || p_channel_id
            FROM UNNEST(v_unique_mentions) AS uid;
        END IF;
    END IF;

    -- Create notifications for channel members (excluding sender and already-mentioned users)
    IF v_channel_visibility = 'public' THEN
        -- Public channel: notify all authenticated users (except sender and mentioned)
        INSERT INTO notifications (user_id, title, message, type, action_url)
        SELECT
          u.id,
          'Nowa wiadomość: ' || COALESCE(v_channel_name, 'Kanał'),
          v_sender_name || ': ' || LEFT(p_content, 100),
          'channel_message',
          '/dashboard/channels?channel=' || p_channel_id
        FROM users u
        WHERE u.id <> v_sender
          AND u.is_active = true
          AND (v_unique_mentions IS NULL OR u.id <> ALL(v_unique_mentions));
    ELSE
        -- Restricted channel: notify only members (via channel_members + department matching)
        INSERT INTO notifications (user_id, title, message, type, action_url)
        SELECT DISTINCT
          u.id,
          'Nowa wiadomość: ' || COALESCE(v_channel_name, 'Kanał'),
          v_sender_name || ': ' || LEFT(p_content, 100),
          'channel_message',
          '/dashboard/channels?channel=' || p_channel_id
        FROM users u
        WHERE u.id <> v_sender
          AND u.is_active = true
          AND (v_unique_mentions IS NULL OR u.id <> ALL(v_unique_mentions))
          AND (
            -- Direct channel member
            EXISTS (SELECT 1 FROM channel_members cm WHERE cm.channel_id = p_channel_id AND cm.user_id = u.id)
            -- Or department match
            OR EXISTS (
              SELECT 1 FROM channel_departments cd
              WHERE cd.channel_id = p_channel_id AND cd.department_id = u.department_id
            )
            -- Or admin/superadmin
            OR u.role IN ('superadmin', 'dyrektor')
          );
    END IF;

    RETURN v_message;
END;
$$;

GRANT EXECUTE ON FUNCTION create_channel_message(UUID, TEXT, UUID[]) TO authenticated, service_role;

-- 4. Zaktualizuj send_dm_message - zmień typ na 'dm_message' i dodaj szczegóły
CREATE OR REPLACE FUNCTION send_dm_message(p_dm_id UUID, p_content TEXT)
RETURNS direct_message_content
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_sender_id UUID := auth.uid();
    v_message direct_message_content%ROWTYPE;
    v_recipient_id UUID;
    v_sender_first TEXT;
    v_sender_last TEXT;
    v_sender_name TEXT;
BEGIN
    IF v_sender_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Verify sender is participant
    IF NOT EXISTS (
        SELECT 1 FROM direct_messages
        WHERE id = p_dm_id AND (participant_1 = v_sender_id OR participant_2 = v_sender_id)
    ) THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    -- Insert message
    INSERT INTO direct_message_content (dm_id, sender_id, content)
    VALUES (p_dm_id, v_sender_id, p_content)
    RETURNING * INTO v_message;

    -- Get recipient ID
    SELECT CASE WHEN participant_1 = v_sender_id THEN participant_2 ELSE participant_1 END
    INTO v_recipient_id FROM direct_messages WHERE id = p_dm_id;

    -- Get sender name
    SELECT first_name, last_name INTO v_sender_first, v_sender_last FROM users WHERE id = v_sender_id;
    v_sender_name := TRIM(COALESCE(v_sender_first, '') || ' ' || COALESCE(v_sender_last, ''));

    -- Create notification with dm_message type
    INSERT INTO notifications (user_id, title, message, type, action_url)
    VALUES (
        v_recipient_id,
        'Wiadomość od ' || v_sender_name,
        LEFT(p_content, 100),
        'dm_message',
        '/dashboard/channels?dm=' || p_dm_id
    );

    RETURN v_message;
END;
$$;

GRANT EXECUTE ON FUNCTION send_dm_message(UUID, TEXT) TO authenticated;

-- 5. Włącz Realtime dla notifications (aby useChatNotifications hook działał)
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- 6. Verify
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'notification_preferences'
  AND column_name IN ('notify_channel_messages', 'notify_dm_messages', 'sound_enabled');
