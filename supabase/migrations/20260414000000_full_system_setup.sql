-- ==========================================
-- ELEVENGRAM FULL SYSTEM SETUP MIGRATION
-- ==========================================
-- This script sets up the core infrastructure for Privacy, 
-- Session Management, Rate Limiting, and Realtime.

-- 1. Users Table Enhancements
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS profile_photo_visibility TEXT DEFAULT 'everyone',
ADD COLUMN IF NOT EXISTS phone_visibility TEXT DEFAULT 'everyone',
ADD COLUMN IF NOT EXISTS last_seen_visibility TEXT DEFAULT 'everyone',
ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS language_preference TEXT DEFAULT 'en';

COMMENT ON COLUMN public.users.profile_photo_visibility IS 'Visibility of profile photo: everyone, contacts, nobody';
COMMENT ON COLUMN public.users.phone_visibility IS 'Visibility of phone number: everyone, contacts, nobody';
COMMENT ON COLUMN public.users.two_factor_enabled IS 'Whether two-step verification is enabled';
COMMENT ON COLUMN public.users.language_preference IS 'User language preference (en, hi)';

-- 2. User Sessions (Device Management)
CREATE TABLE IF NOT EXISTS public.user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    caba_session_id TEXT NOT NULL,
    device_name TEXT,
    device_type TEXT,
    device_icon TEXT,
    browser TEXT,
    os TEXT,
    app_version TEXT,
    ota_version TEXT,
    ip_address TEXT,
    city TEXT,
    country TEXT,
    country_flag TEXT,
    is_online BOOLEAN DEFAULT true,
    is_current BOOLEAN DEFAULT false,
    last_active TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    login_method TEXT,
    ota_updated_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, caba_session_id)
);

-- 3. Login History (Security Audit)
CREATE TABLE IF NOT EXISTS public.login_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    device_name TEXT,
    device_type TEXT,
    ip_address TEXT,
    city TEXT,
    country TEXT,
    country_flag TEXT,
    login_method TEXT,
    action TEXT NOT NULL, -- 'login', 'revoked', 'revoked_all_others'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Rate Limiting Infrastructure
CREATE TABLE IF NOT EXISTS public.rate_limits (
    identifier TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    request_count INTEGER DEFAULT 1,
    window_start TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (identifier, endpoint)
);

-- 5. Rate Limiting Function (RPC)
CREATE OR REPLACE FUNCTION public.check_rate_limit(
    p_identifier TEXT,
    p_endpoint TEXT,
    p_max_requests INTEGER,
    p_window_seconds INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
    v_count INTEGER;
BEGIN
    -- Cleanup outdated records first
    DELETE FROM public.rate_limits 
    WHERE window_start < CURRENT_TIMESTAMP - (p_window_seconds * interval '1 second');

    INSERT INTO public.rate_limits (identifier, endpoint, request_count, window_start)
    VALUES (p_identifier, p_endpoint, 1, CURRENT_TIMESTAMP)
    ON CONFLICT (identifier, endpoint) DO UPDATE
    SET request_count = 
        CASE 
            WHEN public.rate_limits.window_start < CURRENT_TIMESTAMP - (p_window_seconds * interval '1 second') 
            THEN 1 
            ELSE public.rate_limits.request_count + 1 
        END,
        window_start = 
        CASE 
            WHEN public.rate_limits.window_start < CURRENT_TIMESTAMP - (p_window_seconds * interval '1 second') 
            THEN CURRENT_TIMESTAMP 
            ELSE public.rate_limits.window_start 
        END
    RETURNING request_count INTO v_count;

    RETURN v_count <= p_max_requests;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Realtime Configuration
-- Enable Realtime for core tables by adding them to the supabase_realtime publication
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
        ALTER PUBLICATION supabase_realtime ADD TABLE public.chats;
        ALTER PUBLICATION supabase_realtime ADD TABLE public.user_sessions;
        ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Skipping Realtime publication update (already set or permission denied)';
END $$;
