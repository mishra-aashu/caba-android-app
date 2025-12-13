-- Media Table Setup for CaBa
-- Run this in Supabase SQL Editor after database-simple.sql

-- Create media table for storing file metadata
CREATE TABLE IF NOT EXISTS public.media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL CHECK (file_type IN ('avatar', 'image', 'video', 'audio', 'document')),
    mime_type TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    storage_path TEXT NOT NULL,
    storage_url TEXT NOT NULL,
    storage_bucket TEXT DEFAULT 'media',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.media ENABLE ROW LEVEL SECURITY;

-- Create policies for media table
CREATE POLICY "Users can view their own media" ON public.media
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own media" ON public.media
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own media" ON public.media
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own media" ON public.media
    FOR DELETE USING (auth.uid() = user_id);

-- Grant permissions
GRANT ALL ON public.media TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_media_user_id ON public.media(user_id);
CREATE INDEX IF NOT EXISTS idx_media_file_type ON public.media(file_type);
CREATE INDEX IF NOT EXISTS idx_media_created_at ON public.media(created_at DESC);

-- Storage Bucket Policies (Run these in Supabase Storage SQL Editor)
-- Note: These policies should be created in the Storage section, not in the main SQL editor

-- Allow authenticated users to upload files to media bucket
CREATE POLICY "Allow authenticated uploads to media" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'media'
  AND auth.role() = 'authenticated'
);

-- Allow users to view their own files in media bucket
CREATE POLICY "Allow users to view their files in media" ON storage.objects
FOR SELECT USING (
  bucket_id = 'media'
  AND (string_to_array(name, '/'))[2] = auth.uid()::text
);

-- Allow users to delete their own files in media bucket
CREATE POLICY "Allow users to delete their files in media" ON storage.objects
FOR DELETE USING (
  bucket_id = 'media'
  AND (string_to_array(name, '/'))[2] = auth.uid()::text
);