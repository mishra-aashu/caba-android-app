import { useCallback } from 'react';
import { supabase } from '../../utils/supabase';

/**
 * React hook for Supabase Storage fallback functionality
 * Adapted from storage-fallback.js
 */
export const useStorageFallback = (transferId, userId = null) => {
  /**
   * Upload file to Supabase Storage
   */
  const uploadFile = useCallback(async (file, filename, onProgress) => {
    try {
      const storagePath = `${userId}/${filename}`;

      console.log('☁️ Uploading to storage:', storagePath);

      // Upload file
      const { data, error } = await supabase.storage
        .from('media')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type
        });

      if (error) {
        console.error('Storage upload error:', error);
        throw new Error(`Upload failed: ${error.message}`);
      }

      // Update transfer record with storage path
      await supabase
        .from('media_transfers')
        .update({
          storage_path: storagePath,
          storage_bucket: 'media',
          status: 'completed'
        })
        .eq('id', transferId);

      console.log('✅ File uploaded to storage');

      return {
        success: true,
        storagePath: storagePath
      };

    } catch (error) {
      console.error('❌ Storage upload error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }, [transferId, userId]);

  /**
   * Download file from Supabase Storage
   */
  const downloadFile = useCallback(async (storagePath, onProgress) => {
    try {
      console.log('☁️ Downloading from storage:', storagePath);

      // Create signed URL
      const { data: signedData, error: signError } = await supabase.storage
        .from('media')
        .createSignedUrl(storagePath, 3600); // 1 hour expiry

      if (signError) throw signError;

      // Download file
      const response = await fetch(signedData.signedUrl);

      if (!response.ok) {
        throw new Error('Download failed');
      }

      const blob = await response.blob();

      console.log('✅ File downloaded from storage');

      return {
        success: true,
        blob: blob
      };

    } catch (error) {
      console.error('❌ Storage download error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }, []);

  /**
   * Delete file from storage
   */
  const deleteFile = useCallback(async (storagePath) => {
    try {
      const { error } = await supabase.storage
        .from('media')
        .remove([storagePath]);

      if (error) throw error;

      console.log('🗑️ File deleted from storage:', storagePath);
      return { success: true };

    } catch (error) {
      console.error('Delete from storage error:', error);
      return { success: false, error: error.message };
    }
  }, []);

  return {
    uploadFile,
    downloadFile,
    deleteFile
  };
};