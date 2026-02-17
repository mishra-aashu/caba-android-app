-- Create a unified view that combines individual chats and group chats
-- This view can be used in the chat list to show both regular chats and groups

-- Drop existing view if exists
DROP VIEW IF EXISTS unified_chat_list CASCADE;

-- Create unified chat list view
CREATE OR REPLACE VIEW unified_chat_list AS
-- Part 1: Regular 1-on-1 chats
SELECT 
    c.id as chat_id,
    c.id as id,
    CASE 
        WHEN c.user1_id = auth.uid() THEN c.user2_id 
        ELSE c.user1_id 
    END as other_user_id,
    CASE 
        WHEN c.user1_id = auth.uid() THEN u2.name 
        ELSE u1.name 
    END as other_user_name,
    CASE 
        WHEN c.user1_id = auth.uid() THEN u2.avatar 
        ELSE u1.avatar 
    END as other_user_avatar,
    CASE 
        WHEN c.user1_id = auth.uid() THEN u2.phone 
        ELSE u1.phone 
    END as other_user_phone,
    CASE 
        WHEN c.user1_id = auth.uid() THEN u2.is_online 
        ELSE u1.is_online 
    END as other_user_online,
    CASE 
        WHEN c.user1_id = auth.uid() THEN u2.last_seen 
        ELSE u1.last_seen 
    END as other_user_last_seen,
    c.last_message,
    c.last_message_time,
    COALESCE(c.unread_count, 0) as unread_count,
    'chat' as chat_type,
    NULL as group_name,
    NULL as group_avatar
FROM chats c
LEFT JOIN users u1 ON c.user1_id = u1.id
LEFT JOIN users u2 ON c.user2_id = u2.id
WHERE c.user1_id = auth.uid() OR c.user2_id = auth.uid()

UNION ALL

-- Part 2: Group chats
SELECT 
    g.id as chat_id,
    g.id as id,
    NULL as other_user_id,
    g.name as other_user_name,
    g.avatar_url as other_user_avatar,
    NULL as other_user_phone,
    NULL as other_user_online,
    NULL as other_user_last_seen,
    (SELECT content FROM messages WHERE chat_id = g.id ORDER BY created_at DESC LIMIT 1) as last_message,
    (SELECT created_at FROM messages WHERE chat_id = g.id ORDER BY created_at DESC LIMIT 1) as last_message_time,
    (SELECT COUNT(*) FROM messages m 
     WHERE m.chat_id = g.id 
     AND m.sender_id != auth.uid()
     AND m.is_read = false
    ) as unread_count,
    'group' as chat_type,
    g.name as group_name,
    g.avatar_url as group_avatar
FROM groups g
JOIN group_members gm ON gm.group_id = g.id
WHERE gm.user_id = auth.uid();

-- Create a simpler function to get the unified chat list
DROP FUNCTION IF EXISTS get_unified_chat_list(uuid);

CREATE OR REPLACE FUNCTION get_unified_chat_list(user_id uuid)
RETURNS TABLE (
    chat_id uuid,
    chat_type text,
    other_user_id uuid,
    other_user_name text,
    other_user_avatar text,
    other_user_phone text,
    other_user_online boolean,
    other_user_last_seen timestamptz,
    last_message text,
    last_message_time timestamptz,
    unread_count bigint,
    group_name text,
    group_avatar text
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    -- Part 1: Regular 1-on-1 chats
    SELECT 
        c.id::uuid as chat_id,
        'chat'::text as chat_type,
        CASE 
            WHEN c.user1_id = get_unified_chat_list.user_id THEN c.user2_id 
            ELSE c.user1_id 
        END as other_user_id,
        CASE 
            WHEN c.user1_id = get_unified_chat_list.user_id THEN COALESCE(u2.name, u2.phone) 
            ELSE COALESCE(u1.name, u1.phone) 
        END as other_user_name,
        CASE 
            WHEN c.user1_id = get_unified_chat_list.user_id THEN u2.avatar 
            ELSE u1.avatar 
        END as other_user_avatar,
        CASE 
            WHEN c.user1_id = get_unified_chat_list.user_id THEN u2.phone 
            ELSE u1.phone 
        END as other_user_phone,
        CASE 
            WHEN c.user1_id = get_unified_chat_list.user_id THEN u2.is_online 
            ELSE u1.is_online 
        END as other_user_online,
        CASE 
            WHEN c.user1_id = get_unified_chat_list.user_id THEN u2.last_seen 
            ELSE u1.last_seen 
        END as other_user_last_seen,
        c.last_message::text as last_message,
        c.last_message_time as last_message_time,
        COALESCE(c.unread_count, 0)::bigint as unread_count,
        NULL::text as group_name,
        NULL::text as group_avatar
    FROM chats c
    LEFT JOIN users u1 ON c.user1_id = u1.id
    LEFT JOIN users u2 ON c.user2_id = u2.id
    WHERE c.user1_id = get_unified_chat_list.user_id OR c.user2_id = get_unified_chat_list.user_id
    
    UNION ALL
    
    -- Part 2: Group chats (simplified - no subqueries for unread count)
    SELECT 
        g.id::uuid as chat_id,
        'group'::text as chat_type,
        NULL::uuid as other_user_id,
        g.name::text as other_user_name,
        g.avatar_url as other_user_avatar,
        NULL::text as other_user_phone,
        NULL::boolean as other_user_online,
        NULL::timestamptz as other_user_last_seen,
        NULL::text as last_message,
        NULL::timestamptz as last_message_time,
        0::bigint as unread_count,
        g.name::text as group_name,
        g.avatar_url as group_avatar
    FROM groups g
    JOIN group_members gm ON gm.group_id = g.id
    WHERE gm.user_id = get_unified_chat_list.user_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_unified_chat_list(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_unified_chat_list(uuid) TO anon;
