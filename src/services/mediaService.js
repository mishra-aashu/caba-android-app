import { supabase } from '../config/supabase';

const BUCKET_NAME = 'media';

/**
 * Uploads a media file to the 'media' storage bucket.
 * The file path is structured as '{userId}/{timestamp}.{extension}'.
 *
 * @param {File} file The file to upload.
 * @param {string} userId The ID of the user uploading the file.
 * @returns {Promise<string|null>} The storage path of the uploaded file, or null if an error occurred.
 */
export const uploadMedia = async (file, userId) => {
  if (!file || !userId) {
    console.error('File and userId must be provided.');
    return null;
  }

  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}.${fileExt}`;
  const filePath = `${userId}/${fileName}`;

  try {
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      throw error;
    }

    return filePath;
  } catch (error) {
    console.error('Error uploading media:', error.message);
    return null;
  }
};

/**
 * Gets the public URL for a file in a public Supabase storage bucket.
 *
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
