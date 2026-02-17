-- Add unique features to groups and messages tables
-- Time Capsule Messages: unlock_at column
-- Anonymous Confessions: is_anonymous column
-- Group Avatar support

-- Add columns to messages table for time capsule and anonymous features
ALTER TABLE messages ADD COLUMN IF NOT EXISTS unlock_at TIMESTAMPTZ;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN DEFAULT FALSE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_group_message BOOLEAN DEFAULT FALSE;

-- Add columns to groups table
ALTER TABLE groups ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS description TEXT;

-- Enable RLS on new columns (messages already has RLS)
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Update existing policies to handle new columns
-- Policy for SELECT - already handled by existing policies

-- Policy for INSERT - handle is_anonymous and unlock_at
-- (handled by existing messages policies)

-- Add index for better query performance on unlock_at
CREATE INDEX IF NOT EXISTS idx_messages_unlock_at ON messages(unlock_at) WHERE unlock_at IS NOT NULL;

-- Add index for group messages
CREATE INDEX IF NOT EXISTS idx_messages_is_group ON messages(is_group_message) WHERE is_group_message = true;

-- Create group_messages view for fetching group messages efficiently
-- Drop if exists and recreate
DROP VIEW IF EXISTS group_messages CASCADE;

CREATE VIEW group_messages AS
SELECT 
    m.*,
    g.name as group_name,
    g.avatar_url as group_avatar,
    gm.role as member_role
FROM messages m
JOIN groups g ON m.chat_id = g.id
LEFT JOIN group_members gm ON gm.group_id = g.id AND gm.user_id = m.sender_id
WHERE m.is_group_message = true;

-- Create group_list_view to get groups mixed with chats
DROP VIEW IF EXISTS group_list_view CASCADE;

CREATE VIEW group_list_view AS
SELECT 
    g.id as group_id,
    g.name as group_name,
    g.avatar_url as group_avatar,
    g.description as group_description,
    g.created_by,
    g.created_at,
    gm.role as member_role,
    (
        SELECT m.content 
        FROM messages m 
        WHERE m.chat_id = g.id 
        ORDER BY m.created_at DESC 
        LIMIT 1
    ) as last_message,
    (
        SELECT m.created_at 
        FROM messages m 
        WHERE m.chat_id = g.id 
        ORDER BY m.created_at DESC 
        LIMIT 1
    ) as last_message_time,
    (
        SELECT COUNT(*) 
        FROM messages m 
        WHERE m.chat_id = g.id 
        AND m.receiver_id = gm.user_id 
        AND m.is_read = false
    ) as unread_count,
    (
        SELECT COUNT(*) 
        FROM group_members gm2 
        WHERE gm2.group_id = g.id
    ) as member_count
FROM groups g
JOIN group_members gm ON gm.group_id = g.id;

-- Add RLS for group_messages view (if needed)
-- Views inherit RLS from their base tables

-- Add function to get group members with user details
DROP FUNCTION IF EXISTS get_group_members(uuid);

CREATE OR REPLACE FUNCTION get_group_members(group_id UUID)
RETURNS TABLE (
    user_id UUID,
    name TEXT,
    avatar TEXT,
    phone TEXT,
    is_online BOOLEAN,
    last_seen TIMESTAMPTZ,
    role TEXT,
    joined_at TIMESTAMPTZ
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id,
        u.name,
        u.avatar,
        u.phone,
        u.is_online,
        u.last_seen,
        gm.role,
        gm.joined_at
    FROM group_members gm
    JOIN users u ON u.id = gm.user_id
    WHERE gm.group_id = get_group_members.group_id
    ORDER BY 
        CASE gm.role 
            WHEN 'admin' THEN 0 
            WHEN 'member' THEN 1 
        END,
        u.name ASC;
END;
$$;

-- Add function to check if user is admin of a group
DROP FUNCTION IF EXISTS is_group_admin(uuid, uuid);

CREATE OR REPLACE FUNCTION is_group_admin(group_id UUID, user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role
    FROM group_members
    WHERE group_id = is_group_admin.group_id AND user_id = is_group_admin.user_id;
    
    RETURN user_role = 'admin';
END;
$$;

-- Add function to send screenshot alert
DROP FUNCTION IF EXISTS notify_screenshot(uuid, uuid, uuid);

CREATE OR REPLACE FUNCTION notify_screenshot(group_id UUID, sender_id UUID, message_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    sender_name TEXT;
BEGIN
    -- Get sender name
    SELECT name INTO sender_name FROM users WHERE id = sender_id;
    
    -- Insert system message about screenshot
    INSERT INTO messages (chat_id, sender_id, content, is_group_message, message_type)
    VALUES (group_id, sender_id, format('📸 %s took a screenshot!', sender_name), true, 'system');
END;
$$;
