-- ============================================================================
-- MISSING DATABASE OBJECTS SQL
-- ============================================================================
-- This file contains all tables, views, RPCs, and constraints that are
-- referenced in the frontend but missing from database_context.md
-- Run this SQL in your Supabase SQL editor to create all missing objects
-- ============================================================================

-- ============================================================================
-- 1. MISSING TABLES
-- ============================================================================

-- Table: news_articles
CREATE TABLE IF NOT EXISTS public.news_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    author_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    image_url TEXT,
    is_published BOOLEAN DEFAULT false,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: media
CREATE TABLE IF NOT EXISTS public.media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size BIGINT,
    mime_type TEXT,
    media_type TEXT CHECK (media_type IN ('image', 'video', 'audio', 'document')),
    chat_id UUID REFERENCES public.chats(id) ON DELETE SET NULL,
    message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
    is_temporary BOOLEAN DEFAULT false,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: statuses
CREATE TABLE IF NOT EXISTS public.statuses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    content TEXT,
    media_url TEXT,
    media_type TEXT CHECK (media_type IN ('image', 'video')),
    expires_at TIMESTAMPTZ NOT NULL,
    views_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: media_transfers
CREATE TABLE IF NOT EXISTS public.media_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    receiver_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    media_id UUID REFERENCES public.media(id) ON DELETE CASCADE,
    transfer_type TEXT CHECK (transfer_type IN ('p2p', 'server')) DEFAULT 'server',
    status TEXT CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')) DEFAULT 'pending',
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    room_id TEXT,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: calls
CREATE TABLE IF NOT EXISTS public.calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    caller_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    receiver_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    call_type TEXT CHECK (call_type IN ('voice', 'video')) NOT NULL,
    status TEXT CHECK (status IN ('initiated', 'ringing', 'answered', 'ended', 'missed', 'rejected', 'failed')) DEFAULT 'initiated',
    started_at TIMESTAMPTZ DEFAULT NOW(),
    answered_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    duration INTEGER DEFAULT 0,
    room_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: webrtc_signals
CREATE TABLE IF NOT EXISTS public.webrtc_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    to_user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    signal_type TEXT CHECK (signal_type IN ('offer', 'answer', 'ice_candidate', 'call_end')) NOT NULL,
    signal_data JSONB NOT NULL,
    room_id TEXT NOT NULL,
    is_processed BOOLEAN DEFAULT false,
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '5 minutes'),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 2. MISSING CONSTRAINTS
-- ============================================================================

-- Unique constraint on message_reads for upsert operations
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'message_reads_message_id_user_id_key'
    ) THEN
        ALTER TABLE public.message_reads 
        ADD CONSTRAINT message_reads_message_id_user_id_key 
        UNIQUE (message_id, user_id);
    END IF;
END $$;

-- ============================================================================
-- 3. MISSING VIEWS
-- ============================================================================

-- Drop existing views if they exist (to avoid column name conflicts)
DROP VIEW IF EXISTS public.chat_list_view CASCADE;
DROP VIEW IF EXISTS public.unified_chat_list CASCADE;

-- View: chat_list_view (for 1:1 chats only)
CREATE VIEW public.chat_list_view AS
SELECT 
    c.id AS chat_id,
    c.user1_id,
    c.user2_id,
    u1.name AS user1_name,
    u1.avatar AS user1_avatar,
    u1.is_online AS user1_online,
    u1.last_seen AS user1_last_seen,
    u2.name AS user2_name,
    u2.avatar AS user2_avatar,
    u2.is_online AS user2_online,
    u2.last_seen AS user2_last_seen,
    c.last_message,
    c.last_message_time,
    COALESCE(
        (SELECT COUNT(*)::INTEGER 
         FROM public.messages m 
         WHERE m.chat_id = c.id 
         AND m.is_read = false 
         AND m.receiver_id = auth.uid()),
        0
    ) AS unread_count,
    c.created_at,
    c.updated_at
FROM public.chats c
LEFT JOIN public.users u1 ON c.user1_id = u1.id
LEFT JOIN public.users u2 ON c.user2_id = u2.id
WHERE (c.user1_id = auth.uid() OR c.user2_id = auth.uid());

-- View: unified_chat_list (chats + groups)
CREATE VIEW public.unified_chat_list AS
-- 1:1 Chats
SELECT 
    c.id::TEXT AS chat_id,
    'chat'::TEXT AS chat_type,
    c.user1_id,
    c.user2_id,
    CASE 
        WHEN c.user1_id = auth.uid() THEN u2.name
        WHEN c.user2_id = auth.uid() THEN u1.name
        ELSE NULL
    END AS other_user_name,
    CASE 
        WHEN c.user1_id = auth.uid() THEN u2.avatar
        WHEN c.user2_id = auth.uid() THEN u1.avatar
        ELSE NULL
    END AS other_user_avatar,
    CASE 
        WHEN c.user1_id = auth.uid() THEN u2.id
        WHEN c.user2_id = auth.uid() THEN u1.id
        ELSE NULL
    END AS other_user_id,
    CASE 
        WHEN c.user1_id = auth.uid() THEN u2.phone
        WHEN c.user2_id = auth.uid() THEN u1.phone
        ELSE NULL
    END AS other_user_phone,
    CASE 
        WHEN c.user1_id = auth.uid() THEN u2.is_online
        WHEN c.user2_id = auth.uid() THEN u1.is_online
        ELSE NULL
    END AS other_user_online,
    CASE 
        WHEN c.user1_id = auth.uid() THEN u2.last_seen
        WHEN c.user2_id = auth.uid() THEN u1.last_seen
        ELSE NULL
    END AS other_user_last_seen,
    NULL::TEXT AS group_name,
    NULL::TEXT AS group_avatar,
    c.last_message,
    c.last_message_time,
    COALESCE(
        (SELECT COUNT(*)::INTEGER 
         FROM public.messages m 
         WHERE m.chat_id = c.id
         AND m.is_read = false 
         AND m.sender_id != auth.uid()),
        0
    ) AS unread_count,
    c.created_at,
    c.updated_at
FROM public.chats c
LEFT JOIN public.users u1 ON c.user1_id = u1.id
LEFT JOIN public.users u2 ON c.user2_id = u2.id
WHERE (c.user1_id = auth.uid() OR c.user2_id = auth.uid())

UNION ALL

-- Groups
SELECT 
    g.id::TEXT AS chat_id,
    'group'::TEXT AS chat_type,
    NULL::UUID AS user1_id,
    NULL::UUID AS user2_id,
    NULL::TEXT AS other_user_name,
    NULL::TEXT AS other_user_avatar,
    NULL::UUID AS other_user_id,
    NULL::TEXT AS other_user_phone,
    NULL::BOOLEAN AS other_user_online,
    NULL::TIMESTAMPTZ AS other_user_last_seen,
    g.name AS group_name,
    g.avatar_url AS group_avatar,
    g.last_message,
    g.last_message_time,
    COALESCE(
        (SELECT COUNT(*)::INTEGER 
         FROM public.messages m 
         WHERE m.chat_id = g.id
         AND m.is_read = false 
         AND m.sender_id != auth.uid()
         AND m.is_group_message = true),
        0
    ) AS unread_count,
    g.created_at,
    g.updated_at
FROM public.groups g
WHERE EXISTS (
    SELECT 1 FROM public.group_members gm 
    WHERE gm.group_id = g.id AND gm.user_id = auth.uid()
)
ORDER BY last_message_time DESC NULLS LAST;

-- ============================================================================
-- 4. MISSING RPC FUNCTIONS
-- ============================================================================

-- RPC: get_unified_chat_list
CREATE OR REPLACE FUNCTION public.get_unified_chat_list(user_id UUID)
RETURNS TABLE (
    chat_id TEXT,
    chat_type TEXT,
    other_user_name TEXT,
    other_user_avatar TEXT,
    other_user_id UUID,
    other_user_phone TEXT,
    other_user_online BOOLEAN,
    other_user_last_seen TIMESTAMPTZ,
    group_name TEXT,
    group_avatar TEXT,
    last_message TEXT,
    last_message_time TIMESTAMPTZ,
    unread_count INTEGER
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- 1:1 Chats
    RETURN QUERY
    SELECT 
        c.id::TEXT AS chat_id,
        'chat'::TEXT AS chat_type,
        CASE 
            WHEN c.user1_id = user_id THEN u2.name
            WHEN c.user2_id = user_id THEN u1.name
            ELSE NULL
        END AS other_user_name,
        CASE 
            WHEN c.user1_id = user_id THEN u2.avatar
            WHEN c.user2_id = user_id THEN u1.avatar
            ELSE NULL
        END AS other_user_avatar,
        CASE 
            WHEN c.user1_id = user_id THEN u2.id
            WHEN c.user2_id = user_id THEN u1.id
            ELSE NULL
        END AS other_user_id,
        CASE 
            WHEN c.user1_id = user_id THEN u2.phone
            WHEN c.user2_id = user_id THEN u1.phone
            ELSE NULL
        END AS other_user_phone,
        CASE 
            WHEN c.user1_id = user_id THEN u2.is_online
            WHEN c.user2_id = user_id THEN u1.is_online
            ELSE NULL
        END AS other_user_online,
        CASE 
            WHEN c.user1_id = user_id THEN u2.last_seen
            WHEN c.user2_id = user_id THEN u1.last_seen
            ELSE NULL
        END AS other_user_last_seen,
        NULL::TEXT AS group_name,
        NULL::TEXT AS group_avatar,
        c.last_message,
        c.last_message_time,
        COALESCE(
            (SELECT COUNT(*)::INTEGER 
             FROM public.messages m 
             WHERE m.chat_id = c.id
             AND m.is_read = false 
             AND m.sender_id != user_id),
            0
        ) AS unread_count
    FROM public.chats c
    LEFT JOIN public.users u1 ON c.user1_id = u1.id
    LEFT JOIN public.users u2 ON c.user2_id = u2.id
    WHERE (c.user1_id = user_id OR c.user2_id = user_id)
    
    UNION ALL
    
    -- Groups
    SELECT 
        g.id::TEXT AS chat_id,
        'group'::TEXT AS chat_type,
        NULL::TEXT AS other_user_name,
        NULL::TEXT AS other_user_avatar,
        NULL::UUID AS other_user_id,
        NULL::TEXT AS other_user_phone,
        NULL::BOOLEAN AS other_user_online,
        NULL::TIMESTAMPTZ AS other_user_last_seen,
        g.name AS group_name,
        g.avatar_url AS group_avatar,
        g.last_message,
        g.last_message_time,
        COALESCE(
            (SELECT COUNT(*)::INTEGER 
             FROM public.messages m 
             WHERE m.chat_id = g.id
             AND m.is_read = false 
             AND m.sender_id != user_id
             AND m.is_group_message = true),
            0
        ) AS unread_count
    FROM public.groups g
    WHERE EXISTS (
        SELECT 1 FROM public.group_members gm 
        WHERE gm.group_id = g.id AND gm.user_id = user_id
    )
    ORDER BY last_message_time DESC NULLS LAST
    LIMIT 50;
END;
$$;

-- RPC: get_group_list_v2
CREATE OR REPLACE FUNCTION public.get_group_list_v2(user_id_param UUID)
RETURNS TABLE (
    id UUID,
    name TEXT,
    avatar_url TEXT,
    description TEXT,
    created_by UUID,
    member_count BIGINT,
    last_message TEXT,
    last_message_time TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        g.id,
        g.name,
        g.avatar_url,
        g.description,
        g.created_by,
        (SELECT COUNT(*) FROM public.group_members gm WHERE gm.group_id = g.id) AS member_count,
        g.last_message,
        g.last_message_time,
        g.created_at,
        g.updated_at
    FROM public.groups g
    WHERE EXISTS (
        SELECT 1 FROM public.group_members gm 
        WHERE gm.group_id = g.id AND gm.user_id = user_id_param
    )
    ORDER BY g.last_message_time DESC NULLS LAST;
END;
$$;

-- RPC: get_support_messages_for_admin
CREATE OR REPLACE FUNCTION public.get_support_messages_for_admin()
RETURNS TABLE (
    id UUID,
    user_id UUID,
    message TEXT,
    message_type TEXT,
    is_read BOOLEAN,
    responded_by UUID,
    response TEXT,
    responded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    user_name TEXT,
    user_email TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sm.id,
        sm.user_id,
        sm.message,
        sm.message_type,
        sm.is_read,
        sm.responded_by,
        sm.response,
        sm.responded_at,
        sm.created_at,
        sm.updated_at,
        u.name AS user_name,
        u.email AS user_email
    FROM public.support_messages sm
    LEFT JOIN public.users u ON sm.user_id = u.id
    WHERE EXISTS (
        SELECT 1 FROM public.users admin 
        WHERE admin.id = auth.uid() AND admin.is_admin = true
    )
    ORDER BY sm.created_at DESC;
END;
$$;

-- RPC: respond_to_support_message
CREATE OR REPLACE FUNCTION public.respond_to_support_message(
    message_id UUID,
    response_text TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result_id UUID;
BEGIN
    -- Check if user is admin
    IF NOT EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() AND is_admin = true
    ) THEN
        RAISE EXCEPTION 'Only admins can respond to support messages';
    END IF;
    
    -- Update support message
    UPDATE public.support_messages
    SET 
        responded_by = auth.uid(),
        response = response_text,
        responded_at = NOW(),
        updated_at = NOW(),
        message_type = 'admin'
    WHERE id = message_id
    RETURNING id INTO result_id;
    
    RETURN result_id;
END;
$$;

-- RPC: mark_support_message_read
CREATE OR REPLACE FUNCTION public.mark_support_message_read(message_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.support_messages
    SET is_read = true, updated_at = NOW()
    WHERE id = message_id
    AND (user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() AND is_admin = true
    ));
    
    RETURN FOUND;
END;
$$;

-- RPC: cleanup_expired_transfers
CREATE OR REPLACE FUNCTION public.cleanup_expired_transfers()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.media_transfers
    WHERE expires_at < NOW() 
    AND status IN ('pending', 'failed');
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

-- RPC: cleanup_old_signals
CREATE OR REPLACE FUNCTION public.cleanup_old_signals()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.webrtc_signals
    WHERE expires_at < NOW() OR is_processed = true;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

-- RPC: mark_inactive_users_offline
CREATE OR REPLACE FUNCTION public.mark_inactive_users_offline()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    UPDATE public.users
    SET is_online = false, updated_at = NOW()
    WHERE is_online = true 
    AND (last_seen IS NULL OR last_seen < NOW() - INTERVAL '15 minutes');
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$;

-- ============================================================================
-- 5. RLS POLICIES FOR NEW TABLES
-- ============================================================================

-- Enable RLS on all new tables
ALTER TABLE public.news_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webrtc_signals ENABLE ROW LEVEL SECURITY;

-- RLS for news_articles
CREATE POLICY "Anyone can view published news" ON public.news_articles
    FOR SELECT USING (is_published = true OR author_id = auth.uid());
CREATE POLICY "Authors can insert news" ON public.news_articles
    FOR INSERT WITH CHECK (author_id = auth.uid());
CREATE POLICY "Authors can update own news" ON public.news_articles
    FOR UPDATE USING (author_id = auth.uid());
CREATE POLICY "Authors can delete own news" ON public.news_articles
    FOR DELETE USING (author_id = auth.uid());

-- RLS for media
CREATE POLICY "Users can view own media" ON public.media
    FOR SELECT USING (user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM public.messages m 
        WHERE m.id = media.message_id 
        AND (m.sender_id = auth.uid() OR m.receiver_id = auth.uid())
    ));
CREATE POLICY "Users can insert own media" ON public.media
    FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own media" ON public.media
    FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own media" ON public.media
    FOR DELETE USING (user_id = auth.uid());

-- RLS for statuses
CREATE POLICY "Users can view statuses" ON public.statuses
    FOR SELECT USING (expires_at > NOW());
CREATE POLICY "Users can insert own statuses" ON public.statuses
    FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own statuses" ON public.statuses
    FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own statuses" ON public.statuses
    FOR DELETE USING (user_id = auth.uid());

-- RLS for media_transfers
CREATE POLICY "Users can view own transfers" ON public.media_transfers
    FOR SELECT USING (sender_id = auth.uid() OR receiver_id = auth.uid());
CREATE POLICY "Users can insert own transfers" ON public.media_transfers
    FOR INSERT WITH CHECK (sender_id = auth.uid());
CREATE POLICY "Users can update own transfers" ON public.media_transfers
    FOR UPDATE USING (sender_id = auth.uid() OR receiver_id = auth.uid());

-- RLS for calls
CREATE POLICY "Users can view own calls" ON public.calls
    FOR SELECT USING (caller_id = auth.uid() OR receiver_id = auth.uid());
CREATE POLICY "Users can insert own calls" ON public.calls
    FOR INSERT WITH CHECK (caller_id = auth.uid());
CREATE POLICY "Users can update own calls" ON public.calls
    FOR UPDATE USING (caller_id = auth.uid() OR receiver_id = auth.uid());

-- RLS for webrtc_signals
CREATE POLICY "Users can view own signals" ON public.webrtc_signals
    FOR SELECT USING (from_user_id = auth.uid() OR to_user_id = auth.uid());
CREATE POLICY "Users can insert own signals" ON public.webrtc_signals
    FOR INSERT WITH CHECK (from_user_id = auth.uid());
CREATE POLICY "Users can update own signals" ON public.webrtc_signals
    FOR UPDATE USING (from_user_id = auth.uid() OR to_user_id = auth.uid());
CREATE POLICY "Users can delete own signals" ON public.webrtc_signals
    FOR DELETE USING (from_user_id = auth.uid() OR to_user_id = auth.uid());

-- ============================================================================
-- 6. INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_media_user_id ON public.media(user_id);
CREATE INDEX IF NOT EXISTS idx_media_chat_id ON public.media(chat_id);
CREATE INDEX IF NOT EXISTS idx_media_message_id ON public.media(message_id);
CREATE INDEX IF NOT EXISTS idx_media_expires_at ON public.media(expires_at) WHERE is_temporary = true;

CREATE INDEX IF NOT EXISTS idx_statuses_user_id ON public.statuses(user_id);
CREATE INDEX IF NOT EXISTS idx_statuses_expires_at ON public.statuses(expires_at);

CREATE INDEX IF NOT EXISTS idx_media_transfers_sender_id ON public.media_transfers(sender_id);
CREATE INDEX IF NOT EXISTS idx_media_transfers_receiver_id ON public.media_transfers(receiver_id);
CREATE INDEX IF NOT EXISTS idx_media_transfers_status ON public.media_transfers(status);
CREATE INDEX IF NOT EXISTS idx_media_transfers_expires_at ON public.media_transfers(expires_at);

CREATE INDEX IF NOT EXISTS idx_calls_caller_id ON public.calls(caller_id);
CREATE INDEX IF NOT EXISTS idx_calls_receiver_id ON public.calls(receiver_id);
CREATE INDEX IF NOT EXISTS idx_calls_status ON public.calls(status);
CREATE INDEX IF NOT EXISTS idx_calls_started_at ON public.calls(started_at);

CREATE INDEX IF NOT EXISTS idx_webrtc_signals_from_user_id ON public.webrtc_signals(from_user_id);
CREATE INDEX IF NOT EXISTS idx_webrtc_signals_to_user_id ON public.webrtc_signals(to_user_id);
CREATE INDEX IF NOT EXISTS idx_webrtc_signals_room_id ON public.webrtc_signals(room_id);
CREATE INDEX IF NOT EXISTS idx_webrtc_signals_expires_at ON public.webrtc_signals(expires_at);
CREATE INDEX IF NOT EXISTS idx_webrtc_signals_is_processed ON public.webrtc_signals(is_processed);

CREATE INDEX IF NOT EXISTS idx_news_articles_author_id ON public.news_articles(author_id);
CREATE INDEX IF NOT EXISTS idx_news_articles_published_at ON public.news_articles(published_at) WHERE is_published = true;

-- ============================================================================
-- END OF MISSING DATABASE OBJECTS SQL
-- ============================================================================
