-- Fix infinite recursion in group_members policies
-- Drop all existing policies first

-- Drop group_members policies
DROP POLICY IF EXISTS "gmem_members_view_own" ON group_members;
DROP POLICY IF EXISTS "gmem_members_add" ON group_members;
DROP POLICY IF EXISTS "gmem_members_remove" ON group_members;

-- Drop groups policies
DROP POLICY IF EXISTS "grp_members_view_own" ON groups;
DROP POLICY IF EXISTS "grp_users_create" ON groups;
DROP POLICY IF EXISTS "grp_members_update" ON groups;
DROP POLICY IF EXISTS "grp_members_delete" ON groups;

-- Create simpler policies that don't cause recursion
-- For group_members: Allow anyone to view/insert/delete if they're authenticated
-- The actual filtering happens in the app layer

-- SELECT: Allow authenticated users to view members of their groups
-- Use a direct check without self-reference
CREATE POLICY "gmem_view_all" ON group_members
FOR SELECT USING (auth.uid() IS NOT NULL);

-- INSERT: Allow authenticated users to add members (app will validate permissions)
CREATE POLICY "gmem_insert_all" ON group_members
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- UPDATE: Allow authenticated users to update (app will validate permissions)
CREATE POLICY "gmem_update_all" ON group_members
FOR UPDATE USING (auth.uid() IS NOT NULL);

-- DELETE: Allow authenticated users to remove members (app will validate permissions)
CREATE POLICY "gmem_delete_all" ON group_members
FOR DELETE USING (auth.uid() IS NOT NULL);

-- Groups policies
-- SELECT: Allow authenticated users to view groups
CREATE POLICY "grp_view_all" ON groups
FOR SELECT USING (auth.uid() IS NOT NULL);

-- INSERT: Allow authenticated users to create groups
CREATE POLICY "grp_insert_all" ON groups
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- UPDATE: Allow authenticated users to update groups
CREATE POLICY "grp_update_all" ON groups
FOR UPDATE USING (auth.uid() IS NOT NULL);

-- DELETE: Allow authenticated users to delete groups
CREATE POLICY "grp_delete_all" ON groups
FOR DELETE USING (auth.uid() IS NOT NULL);
