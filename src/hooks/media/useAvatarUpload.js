import { useState, useCallback } from 'react';
import { supabase } from '../../utils/supabase';
import { useMediaUpload } from './useMediaUpload';

/**
 * React hook for profile avatar upload functionality
 * Adapted from profile-avatar-upload.js
 */
export const useAvatarUpload = () => {
  const { uploadFile } = useMediaUpload();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  /**
   * Upload avatar
   */
  const uploadAvatar = useCallback(async (file) => {
    try {
      setIsUploading(true);
      setUploadProgress(0);

      // Get current user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error('Not logged in');

      // Upload to Supabase
      const uploadResult = await uploadFile(
        file,
        'avatar',
        user.id,
        {
          onProgress: (progress) => {
            setUploadProgress(progress);
          }
        }
      );

      // Update user profile in Supabase
      const { error } = await supabase
        .from('users')
        .update({
          avatar: uploadResult.mediaId // Store media ID from new media table
        })
        .eq('id', user.id);

      if (error) throw error;

      setIsUploading(false);
      return uploadResult;

    } catch (error) {
      setIsUploading(false);
      throw error;
    }
  }, [uploadFile]);

  /**
   * Load avatar image from mediaId
   */
  const loadAvatarImage = useCallback(async (mediaId) => {
    try {
      if (!mediaId) return null;

      // Get media record from database to get storage URL
      const { data: mediaRecord, error } = await supabase
        .from('media')
        .select('storage_url')
        .eq('id', mediaId)
        .single();

      if (error || !mediaRecord) {
        console.error('Error fetching media record:', error);
        return null;
      }

      return mediaRecord.storage_url;
    } catch (error) {
      console.error('Error loading avatar:', error);
      return null;
    }
  }, []);

  /**
   * Get current user's avatar
   */
  const getCurrentUserAvatar = useCallback(async () => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) return null;

      const { data: userData, error } = await supabase
        .from('users')
        .select('avatar')
        .eq('id', user.id)
        .single();

      if (error || !userData?.avatar) return null;

      return await loadAvatarImage(userData.avatar);
    } catch (error) {
      console.error('Error getting current user avatar:', error);
      return null;
    }
  }, [loadAvatarImage]);

  return {
    uploadAvatar,
    loadAvatarImage,
    getCurrentUserAvatar,
    isUploading,
    uploadProgress
  };
};