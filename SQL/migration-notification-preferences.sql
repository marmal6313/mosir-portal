-- ============================================================
-- Migration: notification_preferences
-- Data: 2026-02-12
-- Opis: Tabela preferencji powiadomień użytkowników (email, WhatsApp)
-- ============================================================

-- 1. Tabela notification_preferences
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email_enabled         BOOLEAN NOT NULL DEFAULT false,
  whatsapp_enabled      BOOLEAN NOT NULL DEFAULT false,
  email_address         TEXT,
  whatsapp_number       TEXT,
  notify_task_assigned  BOOLEAN NOT NULL DEFAULT true,
  notify_task_completed BOOLEAN NOT NULL DEFAULT true,
  notify_task_overdue   BOOLEAN NOT NULL DEFAULT true,
  notify_mentions       BOOLEAN NOT NULL DEFAULT true,
  quiet_hours_start     TIME,
  quiet_hours_end       TIME,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.notification_preferences IS 'Preferencje powiadomień użytkowników (kanały i typy)';
COMMENT ON COLUMN public.notification_preferences.email_enabled IS 'Czy wysyłać powiadomienia email (domyślnie: nie)';
COMMENT ON COLUMN public.notification_preferences.whatsapp_enabled IS 'Czy wysyłać powiadomienia WhatsApp (domyślnie: nie)';
COMMENT ON COLUMN public.notification_preferences.email_address IS 'Adres email do powiadomień (null = użyj auth.users.email)';
COMMENT ON COLUMN public.notification_preferences.whatsapp_number IS 'Numer WhatsApp do powiadomień (null = użyj users.whatsapp)';
COMMENT ON COLUMN public.notification_preferences.quiet_hours_start IS 'Początek godzin ciszy (nie wysyłaj w tym przedziale)';
COMMENT ON COLUMN public.notification_preferences.quiet_hours_end IS 'Koniec godzin ciszy';

-- 2. Indeksy
CREATE INDEX IF NOT EXISTS idx_notification_preferences_email
  ON public.notification_preferences(user_id)
  WHERE email_enabled = true;

CREATE INDEX IF NOT EXISTS idx_notification_preferences_whatsapp
  ON public.notification_preferences(user_id)
  WHERE whatsapp_enabled = true;

-- 3. RLS
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- Użytkownik może czytać swoje preferencje
CREATE POLICY "Users can read own notification preferences"
  ON public.notification_preferences
  FOR SELECT
  USING (auth.uid() = user_id);

-- Użytkownik może tworzyć swoje preferencje
CREATE POLICY "Users can insert own notification preferences"
  ON public.notification_preferences
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Użytkownik może aktualizować swoje preferencje
CREATE POLICY "Users can update own notification preferences"
  ON public.notification_preferences
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role (backend) może czytać wszystkie preferencje (do wysyłki)
CREATE POLICY "Service role can read all notification preferences"
  ON public.notification_preferences
  FOR SELECT
  USING (auth.jwt() ->> 'role' = 'service_role');

-- 4. Trigger: automatyczna aktualizacja updated_at
CREATE OR REPLACE FUNCTION public.update_notification_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notification_preferences_updated_at
  ON public.notification_preferences;

CREATE TRIGGER trg_notification_preferences_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_notification_preferences_updated_at();

-- 5. Funkcja: pobierz preferencje lub domyślne
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
    np.quiet_hours_start,
    np.quiet_hours_end
  FROM auth.users au
  LEFT JOIN public.users u ON u.id = au.id
  LEFT JOIN public.notification_preferences np ON np.user_id = au.id
  WHERE au.id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Grant
GRANT SELECT, INSERT, UPDATE ON public.notification_preferences TO authenticated;
GRANT SELECT ON public.notification_preferences TO service_role;
GRANT EXECUTE ON FUNCTION public.get_notification_preferences(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_notification_preferences(UUID) TO service_role;
