import { useState, useCallback } from 'react';
import { supabase } from '../../utils/supabase';

/**
 * React hook for media download functionality
 * Adapted from media-downloader.js
 */
export const useMediaDownload = () => {
  const [activeDownloads, setActiveDownloads] = useState(new Map());
  const [cache, setCache] = useState(new Map());

  /**
   * Download media file
   */
  const downloadMedia = useCallback(async (mediaUrl, options = {}) => {
    console.log('MediaDownloader: Starting download for mediaUrl:', mediaUrl);

    // Check cache first
    if (cache.has(mediaUrl) && !options.forceDownload) {
      console.log('MediaDownloader: Returning cached media');
      return cache.get(mediaUrl);
    }

    return new Promise(async (resolve, reject) => {
      try {
        console.log('MediaDownloader: Processing URL...');

        if (!mediaUrl || mediaUrl === 'undefined' || mediaUrl === 'null') {
          console.error('MediaDownloader: Invalid media URL');
          reject(new Error('Invalid media URL'));
          return;
        }

        // Create file info from URL
        const fileInfo = createFileInfoFromUrl(mediaUrl);
        console.log('MediaDownloader: Created fileInfo:', fileInfo);

        const downloadTask = {
          mediaId: mediaUrl,
          fileInfo: fileInfo,
          progress: 0,
          status: 'downloading'
        };

        setActiveDownloads(prev => new Map(prev).set(mediaUrl, downloadTask));
        notifyProgress(downloadTask, 0);

        console.log('MediaDownloader: Fetching file from:', fileInfo.storage_url);
        // Download file from Supabase Storage
        const blob = await fetchFile(fileInfo, downloadTask);
        console.log('MediaDownloader: File fetched, size:', blob.size);

        // Create object URL
        const objectUrl = URL.createObjectURL(blob);

        // Cache the result
        const result = {
          mediaId: mediaUrl,
          objectUrl: objectUrl,
          blob: blob,
          fileInfo: fileInfo
        };

        setCache(prev => new Map(prev).set(mediaUrl, result));
        notifyProgress(downloadTask, 100);

        downloadTask.status = 'completed';
        console.log('MediaDownloader: Download completed successfully');
        resolve(result);

      } catch (error) {
        console.error('MediaDownloader: Download failed:', error);
        reject(error);
      } finally {
        setActiveDownloads(prev => {
          const newMap = new Map(prev);
          newMap.delete(mediaUrl);
          return newMap;
        });
      }
    });
  }, [cache]);

  /**
   * Create file info from storage URL
   */
  const createFileInfoFromUrl = useCallback((storageUrl) => {
    // Extract filename from URL
    const urlParts = storageUrl.split('/');
    const filename = urlParts[urlParts.length - 1] || 'unknown';

    // Guess MIME type from URL path
    let mimeType = 'application/octet-stream';
    if (storageUrl.includes('/images/')) {
      mimeType = 'image/jpeg';
    } else if (storageUrl.includes('/videos/')) {
      mimeType = 'video/mp4';
    } else if (storageUrl.includes('/audios/')) {
      mimeType = 'audio/mpeg';
    } else if (storageUrl.includes('/documents/')) {
      mimeType = 'application/pdf';
    }

    // Guess file type
    let fileType = 'unknown';
    if (storageUrl.includes('/images/')) fileType = 'image';
    else if (storageUrl.includes('/videos/')) fileType = 'video';
    else if (storageUrl.includes('/audios/')) fileType = 'audio';
    else if (storageUrl.includes('/documents/')) fileType = 'document';

    return {
      id: storageUrl,
      file_name: filename,
      filename: filename,
      file_size: 0, // Unknown
      mime_type: mimeType,
      storage_url: storageUrl,
      storage_path: '', // Unknown
      storage_bucket: 'media',
      file_type: fileType
    };
  }, []);

  /**
   * Fetch file with progress
   */
  const fetchFile = useCallback(async (fileInfo, downloadTask) => {
    const response = await fetch(fileInfo.storage_url);

    if (!response.ok) {
      throw new Error('Download failed');
    }

    const contentLength = response.headers.get('content-length');
    const total = parseInt(contentLength, 10);

    let loaded = 0;
    const reader = response.body.getReader();
    const chunks = [];

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      chunks.push(value);
      loaded += value.length;

      if (total > 0) {
        const progress = Math.round((loaded / total) * 100);
        notifyProgress(downloadTask, progress);
      }
    }

    // Combine chunks
    const blob = new Blob(chunks, { type: fileInfo.mime_type });
    return blob;
  }, []);

  /**
   * Notify download progress
   */
  const notifyProgress = useCallback((task, progress) => {
    task.progress = progress;

    // Dispatch custom event
    window.dispatchEvent(new CustomEvent('download-progress', {
      detail: {
        mediaId: task.mediaId,
        progress: progress,
        status: task.status,
        fileInfo: task.fileInfo
      }
    }));
  }, []);

  /**
   * Get download status
   */
  const getDownloadStatus = useCallback((mediaId) => {
    const task = activeDownloads.get(mediaId);
    return task ? {
      progress: task.progress,
      status: task.status,
      fileInfo: task.fileInfo
    } : null;
  }, [activeDownloads]);

  /**
   * Clear cache
   */
  const clearCache = useCallback(() => {
    // Revoke all object URLs
    cache.forEach((item) => {
      if (item.objectUrl) {
        URL.revokeObjectURL(item.objectUrl);
      }
    });
    setCache(new Map());
  }, [cache]);

  /**
   * Get file info from database
   */
  const getFileInfo = useCallback(async (mediaId) => {
    try {
      console.log('MediaDownloader: Getting file info for mediaId:', mediaId);

      // Query media table to get file info
      const { data: mediaRecord, error } = await supabase
        .from('media')
        .select('*')
        .eq('id', mediaId)
        .single();

      if (error || !mediaRecord) {
        console.error('MediaDownloader: Error fetching media record:', error);
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

      console.log('MediaDownloader: File info retrieved:', fileInfo);

      return {
        success: true,
        data: fileInfo
      };

    } catch (error) {
      console.error('MediaDownloader: Error in getFileInfo:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }, []);

  /**
   * Remove from cache
   */
  const removeFromCache = useCallback((mediaId) => {
    const item = cache.get(mediaId);
    if (item && item.objectUrl) {
      URL.revokeObjectURL(item.objectUrl);
    }
    setCache(prev => {
      const newCache = new Map(prev);
      newCache.delete(mediaId);
      return newCache;
    });
  }, [cache]);

  return {
    downloadMedia,
    activeDownloads,
    cache,
    getDownloadStatus,
    clearCache,
    getFileInfo,
    removeFromCache
  };
};