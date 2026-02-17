-- Add Row Level Security (RLS) for groups table
-- This ensures users can only see groups they are members of
-- Uses unique policy names to avoid conflicts with existing policies

-- Enable RLS on groups table
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies on groups table first
DROP POLICY IF EXISTS "Anyone can view groups" ON groups;
DROP POLICY IF EXISTS "Anyone can insert groups" ON groups;
DROP POLICY IF EXISTS "Anyone can update groups" ON groups;
DROP POLICY IF EXISTS "Anyone can delete groups" ON groups;
DROP POLICY IF EXISTS "Users can create groups" ON groups;
DROP POLICY IF EXISTS "Group members can update" ON groups;
DROP POLICY IF EXISTS "Group members can delete" ON groups;
DROP POLICY IF EXISTS "Members can view their groups" ON groups;

-- Policy for SELECT - members can view their groups
-- Also allow admins to view all groups for management purposes
CREATE POLICY "grp_members_view_own" ON groups
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM group_members 
    WHERE group_members.group_id = groups.id 
    AND group_members.user_id = auth.uid()
  )
  OR
  -- Allow admins to view all groups (check via users table)
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.is_admin = true
  )
);

-- Policy for INSERT - allow users to create groups
CREATE POLICY "grp_users_create" ON groups
FOR INSERT WITH CHECK (auth.uid() = created_by);

-- Policy for UPDATE - only group members can update
CREATE POLICY "grp_members_update" ON groups
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM group_members 
    WHERE group_members.group_id = groups.id 
    AND group_members.user_id = auth.uid()
  )
  OR
  -- Allow admins to update all groups
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.is_admin = true
  )
);

-- Policy for DELETE - only group members and admins can delete
CREATE POLICY "grp_members_delete" ON groups
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM group_members 
    WHERE group_members.group_id = groups.id 
    AND group_members.user_id = auth.uid()
  )
  OR
  -- Allow admins to delete all groups
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.is_admin = true
  )
);

-- Add similar policies for group_members table
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies on group_members table
DROP POLICY IF EXISTS "Anyone can view group members" ON group_members;
DROP POLICY IF EXISTS "Anyone can add group members" ON group_members;
DROP POLICY IF EXISTS "Anyone can remove group members" ON group_members;
DROP POLICY IF EXISTS "Group members can view" ON group_members;
DROP POLICY IF EXISTS "Group members can add" ON group_members;
DROP POLICY IF EXISTS "Group members can remove" ON group_members;

-- Members can view other members of their groups
CREATE POLICY "gmem_members_view_own" ON group_members
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM group_members gm
    WHERE gm.group_id = group_members.group_id
    AND gm.user_id = auth.uid()
  )
  OR
  -- Allow admins to view all
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.is_admin = true
  )
);

-- Members can add other members to their groups
CREATE POLICY "gmem_members_add" ON group_members
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM group_members gm
    WHERE gm.group_id = group_members.group_id
    AND gm.user_id = auth.uid()
  )
  OR
  -- Allow admins to add members
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.is_admin = true
  )
);

-- Members can remove other members
CREATE POLICY "gmem_members_remove" ON group_members
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM group_members gm
    WHERE gm.group_id = group_members.group_id
    AND gm.user_id = auth.uid()
  )
  OR
  -- Allow admins to remove members
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.is_admin = true
  )
);

-- Add RLS for session_tokens table
ALTER TABLE session_tokens ENABLE ROW LEVEL SECURITY;

-- Drop existing policies on session_tokens
DROP POLICY IF EXISTS "Users can view own sessions" ON session_tokens;
DROP POLICY IF EXISTS "Users can insert sessions" ON session_tokens;
DROP POLICY IF EXISTS "Users can update own sessions" ON session_tokens;
DROP POLICY IF EXISTS "Users can delete own sessions" ON session_tokens;
DROP POLICY IF EXISTS "Users view own sessions" ON session_tokens;
DROP POLICY IF EXISTS "Users insert own sessions" ON session_tokens;
DROP POLICY IF EXISTS "Users update own sessions" ON session_tokens;
DROP POLICY IF EXISTS "Users delete own sessions" ON session_tokens;

-- Users can only see their own sessions
CREATE POLICY "stkn_view_own" ON session_tokens
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "stkn_insert_own" ON session_tokens
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "stkn_update_own" ON session_tokens
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "stkn_delete_own" ON session_tokens
FOR DELETE USING (auth.uid() = user_id);

-- Add RLS for login_history table
ALTER TABLE login_history ENABLE ROW LEVEL SECURITY;

-- Drop existing policies on login_history
DROP POLICY IF EXISTS "Users can view login history" ON login_history;
DROP POLICY IF EXISTS "Users view own login history" ON login_history;
DROP POLICY IF EXISTS "Users insert own login history" ON login_history;

-- Users can only see their own login history
CREATE POLICY "lhist_view_own" ON login_history
FOR SELECT USING (auth.uid() = user_id);

-- Optional: Allow users to insert their own login history
CREATE POLICY "lhist_insert_own" ON login_history
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Note: Contacts RLS should already be set with:
-- CREATE POLICY "Users can manage OWN contacts" ON contacts
-- FOR ALL USING (auth.uid() = user_id);
-- If not, add it:
DROP POLICY IF EXISTS "Users can manage contacts" ON contacts;
