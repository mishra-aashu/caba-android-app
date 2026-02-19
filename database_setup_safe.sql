-- ===============================================
-- SAFE SUPABASE SQL SCRIPT FOR CABA APP
-- ===============================================
-- This script handles existing tables gracefully
-- Run this in your Supabase SQL Editor to complete the functionality

-- ===============================================
-- 1. CREATE MISSING TABLES (SAFE VERSION)
-- ===============================================

-- Message Reads Table (for read receipts)
CREATE TABLE IF NOT EXISTS message_reads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(message_id, user_id)
);

-- Chat Themes Table
CREATE TABLE IF NOT EXISTS chat_themes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    theme_name TEXT NOT NULL,
    theme_config JSONB DEFAULT '{}',
    set_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(chat_id, set_by)
);

-- Wallpapers Table
CREATE TABLE IF NOT EXISTS wallpapers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    url TEXT NOT NULL,
    thumbnail_url TEXT,
    category TEXT DEFAULT 'default',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Chat Wallpapers Table
CREATE TABLE IF NOT EXISTS chat_wallpapers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    wallpaper_id UUID NOT NULL REFERENCES wallpapers(id) ON DELETE CASCADE,
    set_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(chat_id)
);

-- Temporary Chat Settings Table
CREATE TABLE IF NOT EXISTS temporary_chat_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_enabled BOOLEAN DEFAULT false,
    vanish_duration INTEGER DEFAULT 86400, -- 24 hours in seconds
    auto_delete_media BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(chat_id, user_id)
);

-- Vanish Duration Presets Table
CREATE TABLE IF NOT EXISTS vanish_duration_presets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    duration_seconds INTEGER NOT NULL,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User Activity Logs Table (SAFE VERSION)
DO $$
BEGIN
    -- Check if table exists and has the required columns
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_activity_logs') THEN
        -- Check if activity_type column exists
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                      WHERE table_name = 'user_activity_logs' AND column_name = 'activity_type') THEN
            -- Add missing column if table exists but column doesn't
            ALTER TABLE user_activity_logs ADD COLUMN IF NOT EXISTS activity_type TEXT;
            ALTER TABLE user_activity_logs ADD COLUMN IF NOT EXISTS activity_data JSONB DEFAULT '{}';
            ALTER TABLE user_activity_logs ADD COLUMN IF NOT EXISTS ip_address INET;
            ALTER TABLE user_activity_logs ADD COLUMN IF NOT EXISTS user_agent TEXT;
            ALTER TABLE user_activity_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        END IF;
    ELSE
        -- Create table if it doesn't exist
        CREATE TABLE user_activity_logs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            activity_type TEXT NOT NULL, -- 'login', 'logout', 'message_sent', 'call_started', etc.
            activity_data JSONB DEFAULT '{}',
            ip_address INET,
            user_agent TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    END IF;
END $$;

-- Login History Table
CREATE TABLE IF NOT EXISTS login_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    login_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT,
    login_method TEXT DEFAULT 'password', -- 'password', 'oauth', 'phone', etc.
    success BOOLEAN DEFAULT true,
    failure_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Session Tokens Table
CREATE TABLE IF NOT EXISTS session_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true
);

-- Reminder Logs Table
CREATE TABLE IF NOT EXISTS reminder_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reminder_id UUID NOT NULL REFERENCES reminders(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action TEXT NOT NULL, -- 'created', 'sent', 'delivered', 'completed', 'failed'
    log_data JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reminder Roles Table
CREATE TABLE IF NOT EXISTS reminder_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    trusted_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    can_create_reminders BOOLEAN DEFAULT true,
    can_view_reminders BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, trusted_user_id)
);

-- Game Invitations Table
CREATE TABLE IF NOT EXISTS game_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    game_type TEXT NOT NULL, -- 'truth_or_dare', 'tic_tac_toe', etc.
    invitation_data JSONB DEFAULT '{}',
    status TEXT DEFAULT 'pending', -- 'pending', 'accepted', 'declined', 'expired'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===============================================
-- 2. ADD MISSING COLUMNS TO EXISTING TABLES
-- ===============================================

-- Add missing columns to messages table
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'sent',
ADD COLUMN IF NOT EXISTS emoji_style TEXT;

-- Add missing columns to reminders table
ALTER TABLE reminders 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP WITH TIME ZONE;

-- Add missing columns to users table (if not exists)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS emoji_style TEXT;

-- ===============================================
-- 3. CREATE INDEXES FOR PERFORMANCE
-- ===============================================

-- Message reads indexes
CREATE INDEX IF NOT EXISTS idx_message_reads_message_id ON message_reads(message_id);
CREATE INDEX IF NOT EXISTS idx_message_reads_user_id ON message_reads(user_id);
CREATE INDEX IF NOT EXISTS idx_message_reads_read_at ON message_reads(read_at);

-- Chat themes indexes
CREATE INDEX IF NOT EXISTS idx_chat_themes_chat_id ON chat_themes(chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_themes_set_by ON chat_themes(set_by);

-- Chat wallpapers indexes
CREATE INDEX IF NOT EXISTS idx_chat_wallpapers_chat_id ON chat_wallpapers(chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_wallpapers_wallpaper_id ON chat_wallpapers(wallpaper_id);

-- Temporary chat settings indexes
CREATE INDEX IF NOT EXISTS idx_temp_chat_settings_chat_id ON temporary_chat_settings(chat_id);
CREATE INDEX IF NOT EXISTS idx_temp_chat_settings_user_id ON temporary_chat_settings(user_id);

-- User activity logs indexes (only if table exists and column exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_activity_logs') AND
       EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'user_activity_logs' AND column_name = 'activity_type') THEN
        CREATE INDEX IF NOT EXISTS idx_user_activity_logs_user_id ON user_activity_logs(user_id);
        CREATE INDEX IF NOT EXISTS idx_user_activity_logs_activity_type ON user_activity_logs(activity_type);
        CREATE INDEX IF NOT EXISTS idx_user_activity_logs_created_at ON user_activity_logs(created_at);
    END IF;
END $$;

-- Login history indexes
CREATE INDEX IF NOT EXISTS idx_login_history_user_id ON login_history(user_id);
CREATE INDEX IF NOT EXISTS idx_login_history_login_time ON login_history(login_time);

-- Session tokens indexes
CREATE INDEX IF NOT EXISTS idx_session_tokens_user_id ON session_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_session_tokens_token_hash ON session_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_session_tokens_expires_at ON session_tokens(expires_at);

-- Reminder logs indexes
CREATE INDEX IF NOT EXISTS idx_reminder_logs_reminder_id ON reminder_logs(reminder_id);
CREATE INDEX IF NOT EXISTS idx_reminder_logs_user_id ON reminder_logs(user_id);

-- Game invitations indexes
CREATE INDEX IF NOT EXISTS idx_game_invitations_chat_id ON game_invitations(chat_id);
CREATE INDEX IF NOT EXISTS idx_game_invitations_sender_id ON game_invitations(sender_id);
CREATE INDEX IF NOT EXISTS idx_game_invitations_receiver_id ON game_invitations(receiver_id);
CREATE INDEX IF NOT EXISTS idx_game_invitations_status ON game_invitations(status);

-- ===============================================
-- 4. CREATE ROW LEVEL SECURITY (RLS) POLICIES
-- ===============================================

-- Enable RLS on new tables
ALTER TABLE message_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_wallpapers ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallpapers ENABLE ROW LEVEL SECURITY;
ALTER TABLE temporary_chat_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE vanish_duration_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminder_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminder_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_invitations ENABLE ROW LEVEL SECURITY;

-- Only enable RLS on user_activity_logs if it has the correct structure
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_activity_logs') AND
       EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'user_activity_logs' AND column_name = 'activity_type') THEN
        ALTER TABLE user_activity_logs ENABLE ROW LEVEL SECURITY;
        
        -- User Activity Logs Policies
        CREATE POLICY IF NOT EXISTS "Users can view their own activity logs" ON user_activity_logs
            FOR SELECT USING (auth.uid() = user_id);

        CREATE POLICY IF NOT EXISTS "Users can insert their own activity logs" ON user_activity_logs
            FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- Message Reads Policies
CREATE POLICY IF NOT EXISTS "Users can view their own message reads" ON message_reads
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can insert their own message reads" ON message_reads
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can update their own message reads" ON message_reads
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can delete their own message reads" ON message_reads
    FOR DELETE USING (auth.uid() = user_id);

-- Chat Themes Policies
CREATE POLICY IF NOT EXISTS "Users can view chat themes they participate in" ON chat_themes
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM chats WHERE chats.id = chat_themes.chat_id 
               AND (chats.user1_id = auth.uid() OR chats.user2_id = auth.uid()))
    );

CREATE POLICY IF NOT EXISTS "Users can create chat themes they participate in" ON chat_themes
    FOR INSERT WITH CHECK (
        auth.uid() = set_by AND
        EXISTS (SELECT 1 FROM chats WHERE chats.id = chat_themes.chat_id 
               AND (chats.user1_id = auth.uid() OR chats.user2_id = auth.uid()))
    );

-- Chat Wallpapers Policies
CREATE POLICY IF NOT EXISTS "Users can view chat wallpapers they participate in" ON chat_wallpapers
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM chats WHERE chats.id = chat_wallpapers.chat_id 
               AND (chats.user1_id = auth.uid() OR chats.user2_id = auth.uid()))
    );

CREATE POLICY IF NOT EXISTS "Users can create chat wallpapers they participate in" ON chat_wallpapers
    FOR INSERT WITH CHECK (
        auth.uid() = set_by AND
        EXISTS (SELECT 1 FROM chats WHERE chats.id = chat_wallpapers.chat_id 
               AND (chats.user1_id = auth.uid() OR chats.user2_id = auth.uid()))
    );

-- Wallpapers Policies (public read, admin write)
CREATE POLICY IF NOT EXISTS "Anyone can view wallpapers" ON wallpapers
    FOR SELECT USING (is_active = true);

CREATE POLICY IF NOT EXISTS "Only admins can manage wallpapers" ON wallpapers
    FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_admin = true)
    );

-- Temporary Chat Settings Policies
CREATE POLICY IF NOT EXISTS "Users can view their own temp chat settings" ON temporary_chat_settings
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can view temp settings in their chats" ON temporary_chat_settings
    FOR SELECT USING (
        is_enabled = true AND
        EXISTS (SELECT 1 FROM chats WHERE chats.id = temporary_chat_settings.chat_id 
               AND (chats.user1_id = auth.uid() OR chats.user2_id = auth.uid()))
    );

CREATE POLICY IF NOT EXISTS "Users can manage their own temp chat settings" ON temporary_chat_settings
    FOR ALL USING (auth.uid() = user_id);

-- Vanish Duration Presets Policies (public read)
CREATE POLICY IF NOT EXISTS "Anyone can view vanish presets" ON vanish_duration_presets
    FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "Only admins can manage vanish presets" ON vanish_duration_presets
    FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_admin = true)
    );

-- Login History Policies
CREATE POLICY IF NOT EXISTS "Anyone can create login history" ON login_history
    FOR INSERT WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Users can view their own login history" ON login_history
    FOR SELECT USING (auth.uid() = user_id);

-- Session Tokens Policies
CREATE POLICY IF NOT EXISTS "Anyone can create sessions" ON session_tokens
    FOR INSERT WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Users can view their own sessions" ON session_tokens
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can manage their own sessions" ON session_tokens
    FOR ALL USING (auth.uid() = user_id);

-- Reminder Logs Policies
CREATE POLICY IF NOT EXISTS "Users can view logs for their reminders" ON reminder_logs
    FOR SELECT USING (
        auth.uid() = user_id OR
        EXISTS (SELECT 1 FROM reminders WHERE reminders.id = reminder_logs.reminder_id 
               AND reminders.sender_id = auth.uid())
    );

CREATE POLICY IF NOT EXISTS "Anyone can create reminder logs" ON reminder_logs
    FOR INSERT WITH CHECK (true);

-- Reminder Roles Policies
CREATE POLICY IF NOT EXISTS "Users can view their reminder roles" ON reminder_roles
    FOR SELECT USING (auth.uid() = user_id OR auth.uid() = trusted_user_id);

CREATE POLICY IF NOT EXISTS "Users can manage their reminder roles" ON reminder_roles
    FOR ALL USING (auth.uid() = user_id);

-- Game Invitations Policies
CREATE POLICY IF NOT EXISTS "Users can read game invitations for their chats" ON game_invitations
    FOR SELECT USING (
        chat_id IN (SELECT chats.id FROM chats WHERE chats.user1_id = auth.uid() OR chats.user2_id = auth.uid())
    );

CREATE POLICY IF NOT EXISTS "Users can create game invitations for their chats" ON game_invitations
    FOR INSERT WITH CHECK (
        chat_id IN (SELECT chats.id FROM chats WHERE chats.user1_id = auth.uid() OR chats.user2_id = auth.uid()) 
        AND sender_id = auth.uid()
    );

CREATE POLICY IF NOT EXISTS "Users can update game invitations they created" ON game_invitations
    FOR UPDATE USING (sender_id = auth.uid());

CREATE POLICY IF NOT EXISTS "Users can delete game invitations they created" ON game_invitations
    FOR DELETE USING (sender_id = auth.uid());

-- ===============================================
-- 5. INSERT DEFAULT DATA
-- ===============================================

-- Insert default vanish duration presets
INSERT INTO vanish_duration_presets (name, duration_seconds, is_default) VALUES
    ('5 minutes', 300, false),
    ('1 hour', 3600, false),
    ('6 hours', 21600, false),
    ('24 hours', 86400, true),
    ('3 days', 259200, false),
    ('1 week', 604800, false)
ON CONFLICT (name) DO NOTHING;

-- Insert default wallpapers
INSERT INTO wallpapers (name, url, thumbnail_url, category) VALUES
    ('Default Blue', '/assets/wallpapers/default-blue.jpg', '/assets/wallpapers/thumbnails/default-blue.jpg', 'default'),
    ('Dark Theme', '/assets/wallpapers/dark-theme.jpg', '/assets/wallpapers/thumbnails/dark-theme.jpg', 'dark'),
    ('Nature', '/assets/wallpapers/nature.jpg', '/assets/wallpapers/thumbnails/nature.jpg', 'nature'),
    ('Abstract', '/assets/wallpapers/abstract.jpg', '/assets/wallpapers/thumbnails/abstract.jpg', 'abstract')
ON CONFLICT (name) DO NOTHING;

-- ===============================================
-- 6. CREATE HELPER FUNCTIONS
-- ===============================================

-- Function to mark messages as read
CREATE OR REPLACE FUNCTION mark_message_as_read(
    p_message_id UUID,
    p_user_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
    INSERT INTO message_reads (message_id, user_id, read_at)
    VALUES (p_message_id, p_user_id, NOW())
    ON CONFLICT (message_id, user_id) DO NOTHING;
    
    RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get unread message count
CREATE OR REPLACE FUNCTION get_unread_message_count(
    p_user_id UUID
) RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)
        FROM messages m
        LEFT JOIN message_reads mr ON m.id = mr.message_id AND mr.user_id = p_user_id
        WHERE m.receiver_id = p_user_id 
        AND mr.message_id IS NULL
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cleanup expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM session_tokens 
    WHERE expires_at < NOW() OR is_active = false;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===============================================
-- 7. COMPLETION MESSAGE
-- ===============================================

-- Create a notification that the script has completed
DO $$
BEGIN
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'CABA APP DATABASE SETUP COMPLETED';
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'All missing tables have been created';
    RAISE NOTICE 'RLS policies have been applied';
    RAISE NOTICE 'Indexes have been created for performance';
    RAISE NOTICE 'Default data has been inserted';
    RAISE NOTICE 'Helper functions are active';
    RAISE NOTICE '===========================================';
END $$;
