-- Kanały komunikacyjne pomiędzy działami
CREATE TABLE IF NOT EXISTS communication_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL CHECK (char_length(name) BETWEEN 3 AND 64),
    description TEXT,
    visibility TEXT NOT NULL DEFAULT 'public'
        CHECK (visibility IN ('public', 'restricted')),
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_communication_channels_visibility
    ON communication_channels(visibility);
CREATE INDEX IF NOT EXISTS idx_communication_channels_last_message
    ON communication_channels(last_message_at DESC);

CREATE OR REPLACE FUNCTION set_communication_channels_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Powiązania kanałów z działami
CREATE TABLE IF NOT EXISTS channel_departments (
    channel_id UUID NOT NULL REFERENCES communication_channels(id) ON DELETE CASCADE,
    department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (channel_id, department_id)
);

CREATE INDEX IF NOT EXISTS idx_channel_departments_department
    ON channel_departments(department_id);

-- Wiadomości w kanałach
CREATE TABLE IF NOT EXISTS channel_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID NOT NULL REFERENCES communication_channels(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL CHECK (char_length(trim(content)) > 0),
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_channel_messages_channel
    ON channel_messages(channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_channel_messages_sender
    ON channel_messages(sender_id);

-- Wzmianki w wiadomościach
CREATE TABLE IF NOT EXISTS channel_message_mentions (
    message_id UUID NOT NULL REFERENCES channel_messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_channel_message_mentions_user
    ON channel_message_mentions(user_id);

CREATE OR REPLACE FUNCTION bump_channel_last_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE communication_channels
    SET last_message_at = NOW(), updated_at = NOW()
    WHERE id = NEW.channel_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_channel_messages_last_message ON channel_messages;
CREATE TRIGGER trg_channel_messages_last_message
    AFTER INSERT ON channel_messages
    FOR EACH ROW
    EXECUTE FUNCTION bump_channel_last_message();

-- RLS konfiguracja
ALTER TABLE communication_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_message_mentions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION channel_is_accessible(p_channel UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user UUID := auth.uid();
    v_visibility TEXT;
    v_created_by UUID;
    v_department_id INTEGER;
BEGIN
    IF v_user IS NULL THEN
        RETURN FALSE;
    END IF;

    SELECT visibility, created_by
      INTO v_visibility, v_created_by
      FROM communication_channels
     WHERE id = p_channel;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    IF v_visibility = 'public' OR v_created_by = v_user THEN
        RETURN TRUE;
    END IF;

    SELECT department_id
      INTO v_department_id
      FROM users
     WHERE id = v_user;

    IF v_department_id IS NULL THEN
        RETURN FALSE;
    END IF;

    RETURN EXISTS (
        SELECT 1
          FROM channel_departments cd
         WHERE cd.channel_id = p_channel
           AND cd.department_id = v_department_id
    );
END;
$$;

CREATE OR REPLACE FUNCTION channel_is_owned_by_user(p_channel UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user UUID := auth.uid();
    v_role TEXT;
BEGIN
    IF v_user IS NULL THEN
        RETURN FALSE;
    END IF;

    SELECT role INTO v_role FROM users WHERE id = v_user;

    IF v_role IN ('superadmin', 'dyrektor') THEN
        RETURN TRUE;
    END IF;

    RETURN EXISTS (
        SELECT 1
          FROM communication_channels cc
         WHERE cc.id = p_channel
           AND cc.created_by = v_user
    );
END;
$$;

CREATE OR REPLACE FUNCTION set_channel_created_by()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user UUID := auth.uid();
BEGIN
    IF v_user IS NOT NULL THEN
        NEW.created_by = v_user;
    END IF;

    RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION channel_is_accessible(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION channel_is_owned_by_user(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION set_channel_created_by() TO authenticated, service_role;

DROP FUNCTION IF EXISTS create_channel(uuid, text, text, text, integer[]);
DROP FUNCTION IF EXISTS create_channel(text, text, text, integer[]);
DROP FUNCTION IF EXISTS create_channel_message(uuid, text, uuid[]);

CREATE OR REPLACE FUNCTION create_channel(
    p_name TEXT,
    p_description TEXT DEFAULT NULL,
    p_visibility TEXT DEFAULT 'public',
    p_departments INTEGER[] DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user UUID := auth.uid();
    v_channel_id UUID;
    v_clean_visibility TEXT;
BEGIN
    IF v_user IS NULL THEN
        RAISE EXCEPTION 'Brak uwierzytelnionego użytkownika';
    END IF;

    v_clean_visibility := LOWER(COALESCE(p_visibility, 'public'));
    IF v_clean_visibility NOT IN ('public', 'restricted') THEN
        RAISE EXCEPTION 'Nieprawidłowa widoczność kanału. Dozwolone wartości: public, restricted';
    END IF;

    INSERT INTO communication_channels (name, description, visibility, created_by)
    VALUES (
        TRIM(p_name),
        NULLIF(TRIM(COALESCE(p_description, '')), ''),
        v_clean_visibility,
        v_user
    )
    RETURNING id INTO v_channel_id;

    IF v_clean_visibility = 'restricted' THEN
        IF p_departments IS NULL OR array_length(p_departments, 1) = 0 THEN
            RAISE EXCEPTION 'Kanał o ograniczonej widoczności wymaga wskazania przynajmniej jednego działu';
        END IF;

        INSERT INTO channel_departments (channel_id, department_id)
        SELECT DISTINCT v_channel_id, dept_id
        FROM UNNEST(p_departments) AS dept_id
        WHERE dept_id IS NOT NULL;
    END IF;

    RETURN v_channel_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_channel(TEXT, TEXT, TEXT, INTEGER[]) TO authenticated, service_role;

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

    SELECT name INTO v_channel_name FROM communication_channels WHERE id = p_channel_id;
    SELECT first_name, last_name INTO v_sender_first, v_sender_last FROM users WHERE id = v_sender;

    IF p_mentions IS NOT NULL THEN
        SELECT ARRAY(
            SELECT DISTINCT uid
            FROM UNNEST(p_mentions) AS uid
            WHERE uid IS NOT NULL AND uid <> v_sender
        ) INTO v_unique_mentions;

        IF v_unique_mentions IS NOT NULL AND array_length(v_unique_mentions, 1) > 0 THEN
            INSERT INTO channel_message_mentions (message_id, user_id)
            SELECT v_message.id, uid FROM UNNEST(v_unique_mentions) AS uid;

            INSERT INTO notifications (user_id, title, message, type)
            SELECT
              uid,
              'Nowa wzmianka w kanale',
              COALESCE(v_channel_name, 'Kanał') || ': wspomnienie od ' ||
                TRIM(COALESCE(v_sender_first, '') || ' ' || COALESCE(v_sender_last, '')),
              'info'
            FROM UNNEST(v_unique_mentions) AS uid;
        END IF;
    END IF;

    RETURN v_message;
END;
$$;

GRANT EXECUTE ON FUNCTION create_channel_message(UUID, TEXT, UUID[]) TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_communication_channels_updated_at ON communication_channels;
CREATE TRIGGER trg_communication_channels_updated_at
    BEFORE UPDATE ON communication_channels
    FOR EACH ROW
    EXECUTE FUNCTION set_communication_channels_updated_at();

DROP TRIGGER IF EXISTS trg_communication_channels_created_by ON communication_channels;
CREATE TRIGGER trg_communication_channels_created_by
    BEFORE INSERT ON communication_channels
    FOR EACH ROW
    EXECUTE FUNCTION set_channel_created_by();

DROP POLICY IF EXISTS "Channels - everyone can read public" ON communication_channels;
DROP POLICY IF EXISTS "Channels - authenticated can create" ON communication_channels;
DROP POLICY IF EXISTS "Channels - owner can manage" ON communication_channels;
DROP POLICY IF EXISTS "Channels - read access" ON communication_channels;
DROP POLICY IF EXISTS "Channels - insert" ON communication_channels;
DROP POLICY IF EXISTS "Channels - update" ON communication_channels;
DROP POLICY IF EXISTS "Channels - delete" ON communication_channels;
DROP POLICY IF EXISTS "Channel departments - visible for members" ON channel_departments;
DROP POLICY IF EXISTS "Channel departments - owner manages" ON channel_departments;
DROP POLICY IF EXISTS "Channel departments - read access" ON channel_departments;
DROP POLICY IF EXISTS "Channel departments - insert" ON channel_departments;
DROP POLICY IF EXISTS "Channel departments - delete" ON channel_departments;
DROP POLICY IF EXISTS "Channel messages - readable by members" ON channel_messages;
DROP POLICY IF EXISTS "Channel messages - read access" ON channel_messages;
DROP POLICY IF EXISTS "Channel messages - authors can write" ON channel_messages;
DROP POLICY IF EXISTS "Channel messages - authors can delete own" ON channel_messages;
DROP POLICY IF EXISTS "Channel message mentions - read access" ON channel_message_mentions;
-- Polityki dla communication_channels
CREATE POLICY "Channels - read access"
    ON communication_channels
    FOR SELECT
    USING (channel_is_accessible(id));

CREATE POLICY "Channels - insert"
    ON communication_channels
    FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL OR auth.role() = 'service_role');

CREATE POLICY "Channels - update"
    ON communication_channels
    FOR UPDATE
    USING (channel_is_owned_by_user(id))
    WITH CHECK (channel_is_owned_by_user(id));

CREATE POLICY "Channels - delete"
    ON communication_channels
    FOR DELETE
    USING (channel_is_owned_by_user(id));

-- Polityki dla channel_departments
CREATE POLICY "Channel departments - read access"
    ON channel_departments
    FOR SELECT
    USING (channel_is_accessible(channel_id));

CREATE POLICY "Channel departments - insert"
    ON channel_departments
    FOR INSERT
    WITH CHECK (channel_is_owned_by_user(channel_id));

CREATE POLICY "Channel departments - delete"
    ON channel_departments
    FOR DELETE
    USING (channel_is_owned_by_user(channel_id));

-- Polityki dla channel_messages
CREATE POLICY "Channel messages - read access"
    ON channel_messages
    FOR SELECT
    USING (channel_is_accessible(channel_id));

CREATE POLICY "Channel messages - authors can write"
    ON channel_messages
    FOR INSERT
    WITH CHECK (
        sender_id = auth.uid()
        AND channel_is_accessible(channel_id)
    );

CREATE POLICY "Channel messages - authors can delete own"
    ON channel_messages
    FOR DELETE
    USING (sender_id = auth.uid() OR channel_is_owned_by_user(channel_id));

CREATE POLICY "Channel message mentions - read access"
    ON channel_message_mentions
    FOR SELECT
    USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1
            FROM channel_messages cm
            WHERE cm.id = channel_message_mentions.message_id
              AND channel_is_accessible(cm.channel_id)
        )
    );

COMMENT ON TABLE communication_channels IS 'Kanały dyskusyjne dla zespołów MOSiR';
COMMENT ON COLUMN communication_channels.visibility IS 'public - dostępne dla wszystkich, restricted - tylko wskazane działy';
COMMENT ON TABLE channel_departments IS 'Mapowanie kanałów na działy, które mają do nich dostęp';
COMMENT ON TABLE channel_messages IS 'Wiadomości publikowane w kanałach komunikacyjnych';
