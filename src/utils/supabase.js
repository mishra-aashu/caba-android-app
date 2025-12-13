import { createClient } from '@supabase/supabase-js';
// Re-export the supabase client from config for consistency
export { supabase } from '../config/supabase.js';

/**
 * Validate and get proper avatar URL
 * @param {string|number} avatar - Avatar value from database
 * @returns {string|null} - Proper avatar URL or null
 */
export const getValidAvatarUrl = (avatar) => {
  if (!avatar) return null;

  // Convert to string for consistency
  const avatarStr = String(avatar).trim();

  // Skip invalid avatars
  if (avatarStr === '1' || avatarStr === '/1' ||
      avatarStr === 'null' || avatarStr === 'undefined' ||
      avatarStr === '') {
    return null;
  }

  // Check if it's a DP ID (number)
  const dpId = parseInt(avatarStr);
  if (!isNaN(dpId) && dpId >= 1 && dpId <= 28) {
    // Return the DP path
    const dpOptions = [
      {"id": 1, "path": "assets/images/dp-options/00701602b0eac0390b3107b9e2a665e0.jpg"},
      {"id": 2, "path": "assets/images/dp-options/1691130988954.jpg"},
      {"id": 3, "path": "assets/images/dp-options/aesthetic-cartoon-funny-dp-for-instagram.webp"},
      {"id": 4, "path": "assets/images/dp-options/boy-cartoon-dp-with-hoodie.webp"},
      {"id": 5, "path": "assets/images/dp-options/download (1).jpg"},
      {"id": 6, "path": "assets/images/dp-options/download.jpg"},
      {"id": 7, "path": "assets/images/dp-options/funny-profile-picture-wd195eo9rpjy7ax1.jpg"},
      {"id": 8, "path": "assets/images/dp-options/funny-whatsapp-dp-for-girls.webp"},
      {"id": 9, "path": "assets/images/dp-options/photo_5230962651624575118_y.jpg"},
      {"id": 10, "path": "assets/images/dp-options/photo_5230962651624575119_y.jpg"},
      {"id": 11, "path": "assets/images/dp-options/photo_5230962651624575120_y.jpg"},
      {"id": 12, "path": "assets/images/dp-options/photo_5230962651624575121_y.jpg"},
      {"id": 13, "path": "assets/images/dp-options/photo_5230962651624575122_y.jpg"},
      {"id": 14, "path": "assets/images/dp-options/photo_5230962651624575123_y.jpg"},
      {"id": 15, "path": "assets/images/dp-options/photo_5230962651624575124_y.jpg"},
      {"id": 16, "path": "assets/images/dp-options/photo_5230962651624575125_y.jpg"},
      {"id": 17, "path": "assets/images/dp-options/photo_5230962651624575126_y.jpg"},
      {"id": 18, "path": "assets/images/dp-options/photo_5230962651624575127_y.jpg"},
      {"id": 19, "path": "assets/images/dp-options/photo_5235923888607267708_w.jpg"},
      {"id": 20, "path": "assets/images/dp-options/photo_5235923888607267709_w.jpg"},
      {"id": 21, "path": "assets/images/dp-options/photo_5235923888607267710_w.jpg"},
      {"id": 22, "path": "assets/images/dp-options/photo_5235923888607267711_w.jpg"},
      {"id": 23, "path": "assets/images/dp-options/photo_5235923888607267712_w.jpg"},
      {"id": 24, "path": "assets/images/dp-options/photo_5235923888607267713_w.jpg"},
      {"id": 25, "path": "assets/images/dp-options/photo_5235923888607267714_w.jpg"},
      {"id": 26, "path": "assets/images/dp-options/photo_5235923888607267715_w.jpg"},
      {"id": 27, "path": "assets/images/dp-options/photo_5235923888607267716_w.jpg"},
      {"id": 28, "path": "assets/images/dp-options/photo_5235923888607267717_w.jpg"}
    ];
    const option = dpOptions.find(o => o.id === dpId);
    return option ? option.path : null;
  }

  // Check if it's already a valid URL/path
  if (avatarStr.startsWith('http') || avatarStr.startsWith('/assets/') || avatarStr.startsWith('assets/')) {
    return avatarStr;
  }

  // For other values, assume it's a media ID and return null (will be handled by media loader)
  return avatarStr;
};