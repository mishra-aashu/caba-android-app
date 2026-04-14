-- Phase 1: DB Schema Hardening for Enhanced Settings
-- Run this in your Supabase SQL Editor

ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS profile_photo_visibility TEXT DEFAULT 'everyone',
ADD COLUMN IF NOT EXISTS phone_visibility TEXT DEFAULT 'everyone',
ADD COLUMN IF NOT EXISTS last_seen_visibility TEXT DEFAULT 'everyone',
ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS language_preference TEXT DEFAULT 'en';

-- Add comment for documentation
COMMENT ON COLUMN public.users.profile_photo_visibility IS 'Visibility of profile photo: everyone, contacts, nobody';
COMMENT ON COLUMN public.users.phone_visibility IS 'Visibility of phone number: everyone, contacts, nobody';
COMMENT ON COLUMN public.users.two_factor_enabled IS 'Whether two-step verification is enabled';
COMMENT ON COLUMN public.users.language_preference IS 'User language preference (en, hi)';
