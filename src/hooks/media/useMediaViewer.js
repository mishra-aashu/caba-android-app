import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../../utils/supabase';
import { useMediaDownload } from './useMediaDownload';

/**
 * React hook for media viewer functionality
 * Adapted from media-viewer.js
 */
export const useMediaViewer = () => {
  const [currentMedia, setCurrentMedia] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const { downloadMedia } = useMediaDownload();

  /**
   * Open media viewer
   */
  const openMedia = useCallback(async (mediaId, fileInfo = null, options = {}) => {
    try {
      setIsLoading(true);
      setError(null);

      // Get file info if not provided
      if (!fileInfo) {
        const response = await getFileInfo(mediaId);
        if (!response.success) {
          throw new Error(response.error);
        }
        fileInfo = response.data;
      }

      setCurrentMedia({ mediaId, fileInfo, options });

      // Download and display
      const media = await downloadMedia(fileInfo.storage_url);

      // Use the fileInfo from database instead of the one from downloadMedia
      const mediaWithCorrectFileInfo = {
        ...media,
        fileInfo: fileInfo
      };

      setCurrentMedia(prev => ({ ...prev, media: mediaWithCorrectFileInfo }));
      setIsLoading(false);

    } catch (error) {
      console.error('Error opening media:', error);
      setError('Failed to load media');
      setIsLoading(false);
    }
  }, [downloadMedia]);

  /**
   * Close media viewer
   */
  const closeMedia = useCallback(() => {
    setCurrentMedia(null);
    setError(null);
    setIsLoading(false);
  }, []);

  /**
   * Download current media
   */
  const downloadCurrent = useCallback(() => {
    if (!currentMedia?.fileInfo) return;

    const { fileInfo } = currentMedia;
    const link = document.createElement('a');
    link.href = fileInfo.storage_url;
    link.download = fileInfo.file_name;
    link.click();
  }, [currentMedia]);

  /**
   * Get file info from database
   */
  const getFileInfo = useCallback(async (mediaId) => {
    try {
      console.log('MediaViewer: Getting file info for mediaId:', mediaId);

      // Query media table to get file info
      const { data: mediaRecord, error } = await supabase
        .from('media')
        .select('*')
        .eq('id', mediaId)
        .single();

      if (error || !mediaRecord) {
        console.error('MediaViewer: Error fetching media record:', error);
        return {
          success: false,
          error: error?.message || 'Media not found'
        };
      }

      // Create file info object
      const fileInfo = {
        id: mediaRecord.id,
        file_name: mediaRecord.file_name,
        filename: mediaRecord.file_name,
        file_size: mediaRecord.file_size || 0,
        mime_type: mediaRecord.mime_type,
        storage_url: mediaRecord.storage_url,
        storage_path: mediaRecord.storage_path,
        storage_bucket: mediaRecord.storage_bucket,
        file_type: mediaRecord.file_type
      };

      console.log('MediaViewer: File info retrieved:', fileInfo);

      return {
        success: true,
        data: fileInfo
      };

    } catch (error) {
      console.error('MediaViewer: Error in getFileInfo:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }, []);

  /**
   * Format file size
   */
  const formatFileSize = useCallback((bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }, []);

  /**
   * Format time (seconds to MM:SS)
   */
  const formatTime = useCallback((seconds) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (currentMedia?.media?.objectUrl) {
        URL.revokeObjectURL(currentMedia.media.objectUrl);
      }
    };
  }, [currentMedia]);

  return {
    currentMedia,
    isLoading,
    error,
    openMedia,
    closeMedia,
    downloadCurrent,
    formatFileSize,
    formatTime
  };
};