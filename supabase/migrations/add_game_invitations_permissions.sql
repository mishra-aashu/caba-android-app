-- Enable Row Level Security (RLS) on game_invitations table
ALTER TABLE game_invitations ENABLE ROW LEVEL SECURITY;

-- Create policies for game_invitations table

-- Allow authenticated users to read game invitations for their chats
CREATE POLICY "Users can read game invitations for their chats"
ON game_invitations
FOR SELECT
TO authenticated
USING (
  chat_id IN (
    SELECT id FROM chats 
    WHERE user1_id = auth.uid() OR user2_id = auth.uid()
  )
);

-- Allow authenticated users to insert game invitations for their chats
CREATE POLICY "Users can insert game invitations for their chats"
ON game_invitations
FOR INSERT
TO authenticated
WITH CHECK (
  chat_id IN (
    SELECT id FROM chats 
    WHERE user1_id = auth.uid() OR user2_id = auth.uid()
  )
  AND sender_id = auth.uid()
);

-- Allow authenticated users to update game invitations they created
CREATE POLICY "Users can update game invitations they created"
ON game_invitations
FOR UPDATE
TO authenticated
USING (
  sender_id = auth.uid()
)
WITH CHECK (
  sender_id = auth.uid()
);

-- Allow authenticated users to delete game invitations they created
CREATE POLICY "Users can delete game invitations they created"
ON game_invitations
FOR DELETE
TO authenticated
USING (
  sender_id = auth.uid()
);

-- Grant necessary permissions to authenticated role
GRANT ALL ON game_invitations TO authenticated;

-- Grant usage on the sequence for auto-incrementing IDs
GRANT USAGE ON SEQUENCE game_invitations_id_seq TO authenticated;