-- Create game invitations table
CREATE TABLE IF NOT EXISTS game_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES users(id) ON DELETE CASCADE,
  game_type VARCHAR(20) NOT NULL CHECK (game_type IN ('truth', 'dare', 'truth_or_dare')),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
  invitation_message TEXT,
  game_room_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_game_invitations_chat_id ON game_invitations(chat_id);
CREATE INDEX IF NOT EXISTS idx_game_invitations_sender_id ON game_invitations(sender_id);
CREATE INDEX IF NOT EXISTS idx_game_invitations_receiver_id ON game_invitations(receiver_id);
CREATE INDEX IF NOT EXISTS idx_game_invitations_status ON game_invitations(status);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_game_invitations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_game_invitations_updated_at_trigger ON game_invitations;
CREATE TRIGGER update_game_invitations_updated_at_trigger
  BEFORE UPDATE ON game_invitations
  FOR EACH ROW
  EXECUTE FUNCTION update_game_invitations_updated_at();

-