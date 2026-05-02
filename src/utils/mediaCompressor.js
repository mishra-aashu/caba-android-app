const STANDARD_QUALITY_OPTIONS = {
  maxSizeMB: 0.5,        // Max file size for standard quality
  maxWidthOrHeight: 1080,
  useWebWorker: false,
  initialQuality: 0.6,
};

const HIGH_QUALITY_OPTIONS = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1920,
  useWebWorker: true,
  initialQuality: 0.8,
};

const MAX_VIDEO_SIZE_MB = 25; // Set a 25MB limit for video uploads

import { isNativeWithPlugins } from './platformCheck';
import { Capacitor } from '@capacitor/core';

/**
 * Compresses an image file based on a selected quality level.
 * @param {File} file - The image file to compress.
 * @param {'standard'|'high'} quality - The desired quality level.
 * @returns {Promise<File|null>} The compressed file, or null if an error occurs.
 */
export const compressImage = async (file, quality = 'standard') => {
  if (!file.type.startsWith('image/')) {
    console.error('File is not an image.');
    return file;
  }

  const options = quality === 'high' ? HIGH_QUALITY_OPTIONS : STANDARD_QUALITY_OPTIONS;

  try {
    const { default: imageCompression } = await import('browser-image-compression');
    const compressedFile = await imageCompression(file, options);
    return compressedFile;
  } catch (error) {
    console.error('Error during image compression:', error);
    return file; // Return original file if compression fails
  }
};

/**
 * Checks if a video file is within the allowed size limit.
 * @param {File} file - The video file to check.
 * @returns {File|null} The file if it's within the size limit, otherwise null.
 */
export const handleVideo = async (file) => {
  if (!file.type.startsWith('video/')) {
    console.error('File is not a video.');
    return file;
  }

  const fileSizeMB = file.size / 1024 / 1024;

  if (fileSizeMB > MAX_VIDEO_SIZE_MB) {
    alert(`Video is too large (${fileSizeMB.toFixed(2)} MB). Please upload a video smaller than ${MAX_VIDEO_SIZE_MB} MB.`);
    return null;
  }

  // Use Capacitor VideoEditor plugin if running natively
  if (isNativeWithPlugins() && Capacitor.isPluginAvailable('VideoEditor')) {
    try {
      const { VideoEditor } = await import('@whiteguru/capacitor-plugin-video-editor');
      
      // Need to write the file to a temporary location to pass it to the plugin
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const tempFileName = `temp_${Date.now()}.mp4`;
      
      // Read file as base64 to save it
      const base64Data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
          const base64 = reader.result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = error => reject(error);
      });
      
      await Filesystem.writeFile({
        path: tempFileName,
        data: base64Data,
        directory: Directory.Cache
      });
      
      const fileUri = (await Filesystem.getUri({
        directory: Directory.Cache,
        path: tempFileName
      })).uri;

      console.log('[mediaCompressor] Starting video compression for:', fileUri);
      
      const result = await VideoEditor.transcodeVideo({
        fileUri: fileUri,
        outputFileName: `compressed_${Date.now()}`,
        outputFileType: 'mp4',
        saveToLibrary: false,
        deleteInputFile: true,
        maintainAspectRatio: true,
        width: 854,
        height: 480,
        videoBitrate: 1000000, // 1 Mbps
        audioChannels: 1,
        audioSampleRate: 44100,
        audioBitrate: 128000 // 128 kbps
      });
      
      console.log('[mediaCompressor] Compression result:', result);
      
      if (result.fileUri) {
        // Read the compressed file back into a File object
        const compressedData = await Filesystem.readFile({
          path: result.fileUri
        });
        
        // Convert base64 back to Blob/File
        const byteCharacters = atob(compressedData.data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const compressedBlob = new Blob([byteArray], { type: 'video/mp4' });
        const compressedFile = new File([compressedBlob], file.name, { type: 'video/mp4' });
        
        // Clean up compressed file from cache
        await Filesystem.deleteFile({ path: result.fileUri }).catch(() => {});
        
        return compressedFile;
      }
    } catch (error) {
      console.error('[mediaCompressor] Error compressing video:', error);
      // Fallback to original file on error
      return file;
    }
  }

  // Web fallback: no compression, just return the file
  return file;
};
