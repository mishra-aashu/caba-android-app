-- Create game_invitations table
CREATE TABLE game_invitations (
  id SERIAL PRIMARY KEY,
  chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_type VARCHAR(50) DEFAULT 'truth_or_dare',
  invitation_message TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_game_invitations_chat_id ON game_invitations(chat_id);
CREATE INDEX idx_game_invitations_sender_id ON game_invitations(sender_id);
CREATE INDEX idx_game_invitations_receiver_id ON game_invitations(receiver_id);
CREATE INDEX idx_game_invitations_status ON game_invitations(status);
CREATE INDEX idx_game_invitations_created_at ON game_invitations(created_at);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_game_invitations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
