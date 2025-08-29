-- Tabela powiadomień
CREATE TABLE IF NOT EXISTS notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('success', 'error', 'warning', 'info')),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    read BOOLEAN DEFAULT FALSE,
    action_url TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indeksy dla lepszej wydajności
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_timestamp ON notifications(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);

-- Funkcja do automatycznego aktualizowania updated_at
CREATE OR REPLACE FUNCTION update_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger do automatycznego aktualizowania updated_at
CREATE TRIGGER trigger_update_notifications_updated_at
    BEFORE UPDATE ON notifications
    FOR EACH ROW
    EXECUTE FUNCTION update_notifications_updated_at();

-- Funkcja do tworzenia powiadomień
CREATE OR REPLACE FUNCTION create_notification(
    p_user_id UUID,
    p_title VARCHAR(255),
    p_message TEXT,
    p_type VARCHAR(50) DEFAULT 'info',
    p_action_url TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
    notification_id UUID;
BEGIN
    INSERT INTO notifications (user_id, title, message, type, action_url, metadata)
    VALUES (p_user_id, p_title, p_message, p_type, p_action_url, p_metadata)
    RETURNING id INTO notification_id;
    
    RETURN notification_id;
END;
$$ LANGUAGE plpgsql;

-- Funkcja do oznaczania powiadomień jako przeczytane
CREATE OR REPLACE FUNCTION mark_notification_as_read(p_notification_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE notifications 
    SET read = TRUE, updated_at = NOW()
    WHERE id = p_notification_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Funkcja do oznaczania wszystkich powiadomień użytkownika jako przeczytane
CREATE OR REPLACE FUNCTION mark_all_user_notifications_as_read(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    UPDATE notifications 
    SET read = TRUE, updated_at = NOW()
    WHERE user_id = p_user_id AND read = FALSE;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- Funkcja do usuwania starych powiadomień (starszych niż 30 dni)
CREATE OR REPLACE FUNCTION cleanup_old_notifications(p_days_old INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM notifications 
    WHERE timestamp < NOW() - INTERVAL '1 day' * p_days_old;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- RLS (Row Level Security) - użytkownicy mogą widzieć tylko swoje powiadomienia
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Polityka RLS - użytkownicy mogą czytać tylko swoje powiadomienia
CREATE POLICY "Users can view own notifications" ON notifications
    FOR SELECT USING (auth.uid() = user_id);

-- Polityka RLS - użytkownicy mogą aktualizować tylko swoje powiadomienia
CREATE POLICY "Users can update own notifications" ON notifications
    FOR UPDATE USING (auth.uid() = user_id);

-- Polityka RLS - tylko system może tworzyć powiadomienia (można dodać więcej uprawnień)
CREATE POLICY "System can create notifications" ON notifications
    FOR INSERT WITH CHECK (true);

-- Widok dla łatwiejszego dostępu do powiadomień z informacjami o użytkowniku
CREATE OR REPLACE VIEW notifications_with_user AS
SELECT 
    n.*,
    u.email as user_email,
    u.raw_user_meta_data->>'first_name' as user_first_name,
    u.raw_user_meta_data->>'last_name' as user_last_name
FROM notifications n
JOIN auth.users u ON n.user_id = u.id;

-- Komentarze do tabeli i kolumn
COMMENT ON TABLE notifications IS 'Tabela przechowująca powiadomienia użytkowników systemu';
COMMENT ON COLUMN notifications.id IS 'Unikalny identyfikator powiadomienia';
COMMENT ON COLUMN notifications.user_id IS 'ID użytkownika, do którego skierowane jest powiadomienie';
COMMENT ON COLUMN notifications.title IS 'Tytuł powiadomienia';
COMMENT ON COLUMN notifications.message IS 'Treść powiadomienia';
COMMENT ON COLUMN notifications.type IS 'Typ powiadomienia: success, error, warning, info';
COMMENT ON COLUMN notifications.timestamp IS 'Czas utworzenia powiadomienia';
COMMENT ON COLUMN notifications.read IS 'Czy powiadomienie zostało przeczytane';
COMMENT ON COLUMN notifications.action_url IS 'Opcjonalny URL do akcji związanej z powiadomieniem';
COMMENT ON COLUMN notifications.metadata IS 'Dodatkowe dane w formacie JSON';
COMMENT ON COLUMN notifications.created_at IS 'Czas utworzenia rekordu';
COMMENT ON COLUMN notifications.updated_at IS 'Czas ostatniej aktualizacji rekordu';




