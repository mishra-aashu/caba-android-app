import imageCompression from 'browser-image-compression';



const STANDARD_QUALITY_OPTIONS = {
  maxSizeMB: 0.5,        // Max file size for standard quality
  maxWidthOrHeight: 1080,
  useWebWorker: false,
  initialQuality: 0.6,
};

const MAX_VIDEO_SIZE_MB = 25; // Set a 25MB limit for video uploads

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
export const handleVideo = (file) => {
  if (!file.type.startsWith('video/')) {
    console.error('File is not a video.');
    return file;
  }

  const fileSizeMB = file.size / 1024 / 1024;

  if (fileSizeMB > MAX_VIDEO_SIZE_MB) {
    alert(`Video is too large (${fileSizeMB.toFixed(2)} MB). Please upload a video smaller than ${MAX_VIDEO_SIZE_MB} MB.`);
    return null;
  }

  // No compression for videos, just return the file if size is okay
  return file;
};
