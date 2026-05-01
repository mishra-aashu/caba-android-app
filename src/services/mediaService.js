import { supabase } from '../config/supabase';

const BUCKET_NAME = 'media';

const ALLOWED_AUDIO_FORMATS = ['webm', 'mp3', 'wav', 'aac', 'ogg'];
const MAX_AUDIO_SIZE_MB = 10;

/**
 * Gets the file extension from a MIME type.
 * @param {string} mimeType The MIME type (e.g., 'image/jpeg; charset=utf-8').
 * @returns {string} The file extension (e.g., 'jpg').
 */
const getExtensionFromMimeType = (mimeType) => {
    if (!mimeType) return '';
    // Handle cases like 'audio/webm;codecs=opus'
    const typeOnly = mimeType.split(';')[0];
    const subtype = typeOnly.split('/')[1] || '';
    
    const map = {
        'jpeg': 'jpg',
        'svg+xml': 'svg',
        'plain': 'txt',
        'mpeg': 'mp3',
        'webm': 'webm',
        'ogg': 'ogg',
        'quicktime': 'mov',
        'x-m4a': 'm4a'
    };
    
    return map[subtype] || subtype;
};

/**
 * Uploads a media file to the 'media' storage bucket.
 * @param {File|Blob} file The file to upload.
 * @param {string} userId The ID of the user uploading the file.
 * @returns {Promise<string|null>} The storage path of the uploaded file, or null on error.
 */
export const uploadMedia = async (file, userId) => {
    if (!file || !userId) {
        console.error('File and userId must be provided.');
        return null;
    }

    const fileExt = (file.name && file.name.includes('.')) 
        ? file.name.split('.').pop().toLowerCase() 
        : getExtensionFromMimeType(file.type);

    if (!fileExt) {
        console.error('Could not determine file extension.');
        return null;
    }
    
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `${userId}/${fileName}`;

    try {
        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false,
            });

        if (error) throw error;
        return data.path;
    } catch (error) {
        console.error('Error uploading media:', error.message);
        return null;
    }
};

/**
 * Gets the public URL for a file in a public Supabase storage bucket.
 * @param {string} mediaPath The path of the file in the storage bucket.
 * @returns {string|null} The public URL, or null on error.
 */
export const getPublicMediaUrl = (mediaPath) => {
  if (!mediaPath) return null;

  try {
    const { data } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(mediaPath);

    return data?.publicUrl;
  } catch (error) {
    console.error('Error getting public URL:', error.message);
    return null;
  }
};

/**
 * Creates a temporary signed URL to access a private file.
 * @param {string} mediaPath The path of the file in the storage bucket.
 * @returns {Promise<string|null>} The signed URL, or null on error.
 */
export const getSignedMediaUrl = async (mediaPath) => {
    if (!mediaPath) return null;

    try {
        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .createSignedUrl(mediaPath, 60); // URL expires in 60 seconds

        if (error) throw error;

        return data.signedUrl;
    } catch (error) {
        console.error('Error creating signed URL:', error.message);
        return null;
    }
};

/**
 * Uploads an audio file for voice messages to the 'media' storage bucket.
 * @param {File|Blob} file The audio file to upload.
 * @param {string} userId The ID of the user uploading the file.
 * @returns {Promise<string|null>} The storage path of the uploaded file, or null if an error occurred.
 */
export const uploadVoiceMessage = async (file, userId) => {
  if (!file || !userId) {
    console.error('File and userId must be provided.');
    return null;
  }

  // Validation
  if (!file.type.startsWith('audio/')) {
    console.error('Invalid file type. Must be audio.');
    return null;
  }

  const fileExt = (file.name && file.name.includes('.'))
    ? file.name.split('.').pop()?.toLowerCase()
    : getExtensionFromMimeType(file.type);

  if (!fileExt || !ALLOWED_AUDIO_FORMATS.includes(fileExt)) {
    console.error('Unsupported audio format:', fileExt);
    return null;
  }

  const maxSize = MAX_AUDIO_SIZE_MB * 1024 * 1024;
  if (file.size > maxSize) {
    console.error(`File size exceeds limit of ${MAX_AUDIO_SIZE_MB}MB.`);
    return null;
  }

  const timestamp = Date.now();
  const fileName = `voice_${timestamp}.${fileExt}`;
  const filePath = `${userId}/${fileName}`;

  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) throw error;
    
    return data.path;
  } catch (error) {
    console.error('Error uploading voice message:', error.message);
    return null;
  }
};
