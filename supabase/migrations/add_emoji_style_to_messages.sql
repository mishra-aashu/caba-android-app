-- Add emoji_style column to messages table for per-message emoji rendering
-- This ensures other users see emojis according to the sender's preference

ALTER TABLE "public"."messages"
ADD COLUMN IF NOT EXISTS "emoji_style" TEXT DEFAULT 'native'
CHECK (emoji_style IN ('native', 'twitter', 'google'));

-- Add comment for documentation
COMMENT ON COLUMN "public"."messages"."emoji_style" IS 'Emoji style used by sender: native (device default), twitter (Twemoji), google (Noto)';

-- Create index for potential future queries
CREATE INDEX IF NOT EXISTS "idx_messages_emoji_style" ON "public"."messages" ("emoji_style");

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ Emoji style column added to messages table!';
    RAISE NOTICE '🎨 Messages will now display emojis according to sender preference';
    RAISE NOTICE '📱 Default is native for backward compatibility';
END $$;