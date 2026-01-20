-- Add emoji_style column to users table for emoji style selection feature
-- This allows users to choose their preferred emoji style (native, twitter, google)

ALTER TABLE "public"."users"
ADD COLUMN IF NOT EXISTS "emoji_style" TEXT DEFAULT 'native'
CHECK (emoji_style IN ('native', 'twitter', 'google'));

-- Add comment for documentation
COMMENT ON COLUMN "public"."users"."emoji_style" IS 'User preferred emoji style: native (device default), twitter (Twemoji), google (Noto)';

-- Create index for potential future queries
CREATE INDEX IF NOT EXISTS "idx_users_emoji_style" ON "public"."users" ("emoji_style");

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ Emoji style column added to users table!';
    RAISE NOTICE '🎨 Users can now choose between: native, twitter, google emoji styles';
    RAISE NOTICE '📱 Default is native (device emojis) for best performance';
END $$;