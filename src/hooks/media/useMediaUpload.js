import { useState, useCallback } from 'react';
import { supabase } from '../../utils/supabase';

/**
 * React hook for media upload functionality
 * Adapted from media-uploader.js
 */
export const useMediaUpload = () => {
  const [uploads, setUploads] = useState(new Map());
  const [activeUploads, setActiveUploads] = useState(new Map());

  /**
   * Upload file to Supabase Storage
   */
  const uploadFile = useCallback(async (file, fileType, userId, options = {}) => {
    return new Promise(async (resolve, reject) => {
      const uploadId = generateUploadId();
      const startTime = Date.now();

      console.log(`[Media Upload] Started upload for ${file.name} (${formatFileSize(file.size)}) at ${new Date(startTime).toISOString()}`);

      try {
        // Validate file
        const validation = validateFile(file, fileType);
        if (!validation.valid) {
          console.error(`[Media Upload] Validation failed for ${file.name}: ${validation.error}`);
          reject(new Error(validation.error));
          return;
        }

        // Create upload task
        const uploadTask = {
          id: uploadId,
          file: file,
          fileType: fileType,
          userId: userId,
          options: options,
          progress: 0,
          status: 'uploading',
          resolve: resolve,
          reject: reject
        };

        setActiveUploads(prev => new Map(prev).set(uploadId, uploadTask));
        updateUploadProgress(uploadId, 0);

        // Upload to Supabase Storage
        const result = await uploadToSupabaseStorage(uploadTask);

        updateUploadProgress(uploadId, 100);
        uploadTask.status = 'completed';
        const duration = Date.now() - startTime;
        console.log(`[Media Upload] Completed upload for ${file.name} in ${duration}ms`);
        resolve(result);

      } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`[Media Upload] Failed upload for ${file.name} after ${duration}ms:`, error);
        reject(error);
      } finally {
        setActiveUploads(prev => {
          const newMap = new Map(prev);
          newMap.delete(uploadId);
          return newMap;
        });
      }
    });
  }, []);

  /**
   * Compress image file
   */
  const compressImage = useCallback(async (file, maxWidth = 800, maxHeight = 800, quality = 0.8) => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        // Calculate new dimensions
        let { width, height } = img;

        if (width > height) {
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        // Draw and compress
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(resolve, 'image/jpeg', quality);
      };

      img.src = URL.createObjectURL(file);
    });
  }, []);

  /**
   * Validate file before upload
   */
  const validateFile = useCallback((file, fileType) => {
    const supportedTypes = {
      avatar: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
      image: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
      video: ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'],
      audio: ['audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/wav', 'audio/webm'],
      document: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    };

    const maxSizes = {
      avatar: 5 * 1024 * 1024,      // 5MB
      image: 20 * 1024 * 1024,      // 20MB
      video: 100 * 1024 * 1024,     // 100MB
      audio: 10 * 1024 * 1024,      // 10MB
      document: 50 * 1024 * 1024    // 50MB
    };

    // Check file type
    const validTypes = supportedTypes[fileType];
    if (!validTypes || !validTypes.includes(file.type)) {
      return {
        valid: false,
        error: `Unsupported file type. Supported types: ${validTypes.join(', ')}`
      };
    }

    // Check file size
    const maxSize = maxSizes[fileType];
    if (file.size > maxSize) {
      return {
        valid: false,
        error: `File too large. Maximum size: ${formatFileSize(maxSize)}`
      };
    }

    return { valid: true };
  }, []);

  /**
   * Upload to Supabase Storage
   */
  const uploadToSupabaseStorage = useCallback(async (task) => {
    const { file, fileType, userId } = task;

    console.log(`[Media Upload] Starting Supabase upload for ${file.name}`);

    // Compress image if it's an avatar or image
    let fileToUpload = file;
    if ((fileType === 'avatar' || fileType === 'image') && file.type.startsWith('image/')) {
      console.log(`[Media Upload] Compressing image...`);
      try {
        const compressedBlob = await compressImage(file);
        fileToUpload = new File([compressedBlob], file.name, {
          type: 'image/jpeg',
          lastModified: Date.now()
        });
        console.log(`[Media Upload] Compressed from ${formatFileSize(file.size)} to ${formatFileSize(fileToUpload.size)}`);
      } catch (error) {
        console.warn(`[Media Upload] Compression failed, using original file:`, error);
      }
    }

    // Generate unique filename
    const fileExt = fileToUpload.name.split('.').pop() || 'jpg';
    const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
    const storagePath = `${fileType}s/${userId}/${fileName}`;

    console.log(`[Media Upload] Generated storage path: ${storagePath}`);

    updateUploadProgress(task.id, 20);

    // Upload to Supabase Storage
    console.log(`[Media Upload] Uploading to Supabase storage...`);
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('media')
      .upload(storagePath, fileToUpload, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error(`[Media Upload] Storage upload failed: ${uploadError.message}`);
      if (uploadError.message.includes('Bucket not found')) {
        throw new Error(`Storage bucket 'media' not found. Please create a bucket named 'media' in your Supabase Storage dashboard (set to private).`);
      }
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }

    console.log(`[Media Upload] Storage upload successful`);

    updateUploadProgress(task.id, 70);

    // Get public URL
    console.log(`[Media Upload] Getting public URL...`);
    const { data: urlData } = supabase.storage
      .from('media')
      .getPublicUrl(storagePath);

    console.log(`[Media Upload] Public URL obtained: ${urlData.publicUrl}`);

    // Try to save metadata to database (optional)
    let mediaData = null;
    try {
      console.log(`[Media Upload] Saving metadata to database...`);
      const { data: dbData, error: dbError } = await supabase
        .from('media')
        .insert({
          user_id: userId,
          file_name: fileToUpload.name,
          file_type: fileType,
          mime_type: fileToUpload.type,
          file_size: fileToUpload.size,
          storage_path: storagePath,
          storage_url: urlData.publicUrl
        })
        .select()
        .single();

      if (dbError) {
        console.warn(`[Media Upload] Database insert failed (continuing without it): ${dbError.message}`);
      } else {
        mediaData = dbData;
        console.log(`[Media Upload] Database insert successful, media ID: ${mediaData.id}`);
      }
    } catch (dbError) {
      console.warn(`[Media Upload] Database operation failed (continuing): ${dbError.message}`);
    }

    updateUploadProgress(task.id, 90);

    return {
      storageUrl: urlData.publicUrl,
      storagePath: storagePath,
      fileName: fileToUpload.name,
      fileSize: fileToUpload.size,
      fileType: fileType,
      mimeType: fileToUpload.type,
      mediaId: mediaData ? mediaData.id : null
    };
  }, [compressImage]);

  /**
   * Update upload progress
   */
  const updateUploadProgress = useCallback((uploadId, progress) => {
    setUploads(prev => {
      const newUploads = new Map(prev);
      const upload = newUploads.get(uploadId) || {};
      newUploads.set(uploadId, { ...upload, progress, status: progress === 100 ? 'completed' : 'uploading' });
      return newUploads;
    });

    console.log(`[Media Upload] Progress for ${uploadId}: ${progress}%`);

    // Dispatch custom event
    window.dispatchEvent(new CustomEvent('upload-progress', {
      detail: {
        uploadId: uploadId,
        progress: progress,
        status: progress === 100 ? 'completed' : 'uploading'
      }
    }));
  }, []);

  /**
   * Generate unique upload ID
   */
  const generateUploadId = useCallback(() => {
    return `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
   * Cancel upload
   */
  const cancelUpload = useCallback((uploadId) => {
    setActiveUploads(prev => {
      const task = prev.get(uploadId);
      if (task) {
        task.reject(new Error('Upload cancelled'));
        const newMap = new Map(prev);
        newMap.delete(uploadId);
        return newMap;
      }
      return prev;
    });
  }, []);

  /**
   * Get upload status
   */
  const getUploadStatus = useCallback((uploadId) => {
    const task = activeUploads.get(uploadId);
    return task ? {
      progress: task.progress,
      status: task.status,
      fileName: task.file.name
    } : null;
  }, [activeUploads]);

  return {
    uploadFile,
    uploads,
    activeUploads,
    cancelUpload,
    getUploadStatus,
    formatFileSize
  };
};