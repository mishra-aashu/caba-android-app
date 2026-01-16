-- =================================================================
-- PART 1: COMPLETE CLEANUP SCRIPT (भाई, चलो पहले सब कुछ साफ़ करें)
-- Purpose: Drop all tables, functions, and policies from the previous media sharing setup for a fresh start.
-- =================================================================

-- Step 1: Drop Tables (CASCADE sab related cheezein हटा देगा)
DROP TABLE IF EXISTS "public"."media" CASCADE;
DROP TABLE IF EXISTS "public"."media_transfers" CASCADE;
DROP TABLE IF EXISTS "public"."webrtc_signals" CASCADE;
DROP TABLE IF EXISTS "public"."calls" CASCADE;

-- Step 2: Drop Storage Policies on the old 'media' bucket
DROP POLICY IF EXISTS "media_bucket_delete" ON "storage"."objects";
DROP POLICY IF EXISTS "media_bucket_select" ON "storage"."objects";
DROP POLICY IF EXISTS "media_bucket_update" ON "storage"."objects";
DROP POLICY IF EXISTS "media_bucket_upload" ON "storage"."objects";

-- Step 3: Drop Functions
DROP FUNCTION IF EXISTS is_user_online(UUID);
DROP FUNCTION IF EXISTS update_user_activity(UUID);
DROP FUNCTION IF EXISTS increment_download_count(UUID);
DROP FUNCTION IF EXISTS cleanup_expired_transfers();
DROP FUNCTION IF EXISTS cleanup_old_signals();
DROP FUNCTION IF EXISTS get_missed_calls_count(UUID);
DROP FUNCTION IF EXISTS mark_inactive_users_offline();
DROP FUNCTION IF EXISTS update_last_activity();

-- Step 4 & 5: Dropping objects from auth.users
-- The following commands are commented out because they require special permissions on the
-- 'auth.users' table that are not available in the standard SQL editor for security reasons.
-- These old columns won't affect the new system, so it's safe to leave them.
/*
-- Step 4: Drop Trigger from users table
DROP TRIGGER IF EXISTS "trigger_update_user_activity" ON "auth"."users";

-- Step 5: Drop columns from auth.users table
ALTER TABLE "auth"."users"
DROP COLUMN IF EXISTS "is_online",
DROP COLUMN IF EXISTS "last_seen",
DROP COLUMN IF EXISTS "last_activity";
*/

-- Step 6: Drop columns from public.messages table
ALTER TABLE "public"."messages"
DROP COLUMN IF EXISTS "transfer_id";

-- =================================================================
-- PART 2: NEW SNAPCHAT-STYLE MEDIA SHARING SYSTEM (अब बनेगा Snapchat जैसा System! 🚀)
-- Purpose: Setup database for view-once image/video sharing in chats.
-- =================================================================

-- ===========================================
-- Step 1: Storage Bucket Policies (The Locker 🗄️)
-- Action: Yeh policies aapke 'chat-media' PRIVATE bucket ke liye hain.
-- ===========================================

-- Reminder: Supabase dashboard mein 'chat-media' naam ka ek PRIVATE bucket bana lein.

-- Policy 1: Authenticated users ko UPLOAD karne do.
CREATE POLICY "allow_authenticated_uploads"
ON "storage"."objects" FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'chat-media');

-- Policy 2: User ko apni file VIEW, UPDATE, DELETE karne do.
-- Dusre users ko access 'Signed URLs' se milega.
CREATE POLICY "allow_user_self_management"
ON "storage"."objects" FOR ALL
TO authenticated
USING (
    bucket_id = 'chat-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
    bucket_id = 'chat-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
);


-- ===========================================
-- Step 2: 'messages' Table Update (The Ledger 📒)
-- Action: Aapki 'messages' table mein media ke liye columns add karein.
-- ===========================================

ALTER TABLE "public"."messages"
ADD COLUMN IF NOT EXISTS "media_path" TEXT,
ADD COLUMN IF NOT EXISTS "media_type" TEXT CHECK (media_type IN ('image', 'video')),
ADD COLUMN IF NOT EXISTS "is_viewed" BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS "duration" INTEGER DEFAULT 10;

-- Index for faster media message lookup
CREATE INDEX IF NOT EXISTS "idx_messages_media_path" ON "public"."messages" ("media_path")
WHERE "media_path" IS NOT NULL;


-- ===========================================
-- SETUP COMPLETE!
-- ===========================================

DO $$
BEGIN
    RAISE NOTICE '✅ Awesome! Aapka naya Snapchat-style media system ready hai!';
    RAISE NOTICE '👉 Next Steps:';
    RAISE NOTICE '1. React app mein file upload aur view logic implement karein.';
    RAISE NOTICE '2. Party karein! 🎉';
END $$;
