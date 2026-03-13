// Centralized DP (Display Picture) options for the entire application
// This ensures all components use the same DP options and makes updates easier

const baseUrl = import.meta.env.BASE_URL || '/';

export const dpOptions = [
  { id: 1, path: `${baseUrl}assets/images/dp-options/00701602b0eac0390b3107b9e2a665e0.jpg` },
  { id: 2, path: `${baseUrl}assets/images/dp-options/1691130988954.jpg` },
  { id: 3, path: `${baseUrl}assets/images/dp-options/aesthetic-cartoon-funny-dp-for-instagram.webp` },
  { id: 4, path: `${baseUrl}assets/images/dp-options/boy-cartoon-dp-with-hoodie.webp` },
  { id: 5, path: `${baseUrl}assets/images/dp-options/download (1).jpg` },
  { id: 6, path: `${baseUrl}assets/images/dp-options/download.jpg` },
  { id: 7, path: `${baseUrl}assets/images/dp-options/funny-profile-picture-wd195eo9rpjy7ax1.jpg` },
  { id: 8, path: `${baseUrl}assets/images/dp-options/funny-whatsapp-dp-for-girls.webp` },
  { id: 9, path: `${baseUrl}assets/images/dp-options/photo_5230962651624575118_y.jpg` },
  { id: 10, path: `${baseUrl}assets/images/dp-options/photo_5230962651624575119_y.jpg` },
  { id: 11, path: `${baseUrl}assets/images/dp-options/photo_5230962651624575120_y.jpg` },
  { id: 12, path: `${baseUrl}assets/images/dp-options/photo_5230962651624575121_y.jpg` },
  { id: 13, path: `${baseUrl}assets/images/dp-options/photo_5230962651624575122_y.jpg` },
  { id: 14, path: `${baseUrl}assets/images/dp-options/photo_5230962651624575123_y.jpg` },
  { id: 15, path: `${baseUrl}assets/images/dp-options/photo_5230962651624575124_y.jpg` },
  { id: 16, path: `${baseUrl}assets/images/dp-options/photo_5230962651624575125_y.jpg` },
  { id: 17, path: `${baseUrl}assets/images/dp-options/photo_5230962651624575126_y.jpg` },
  { id: 18, path: `${baseUrl}assets/images/dp-options/photo_5230962651624575127_y.jpg` },
  { id: 19, path: `${baseUrl}assets/images/dp-options/photo_5235923888607267708_w.jpg` },
  { id: 20, path: `${baseUrl}assets/images/dp-options/photo_5235923888607267709_w.jpg` },
  { id: 21, path: `${baseUrl}assets/images/dp-options/photo_5235923888607267710_w.jpg` },
  { id: 22, path: `${baseUrl}assets/images/dp-options/photo_5235923888607267711_w.jpg` },
  { id: 23, path: `${baseUrl}assets/images/dp-options/photo_5235923888607267712_w.jpg` },
  { id: 24, path: `${baseUrl}assets/images/dp-options/photo_5235923888607267713_w.jpg` },
  { id: 25, path: `${baseUrl}assets/images/dp-options/photo_5235923888607267714_w.jpg` },
  { id: 26, path: `${baseUrl}assets/images/dp-options/photo_5235923888607267715_w.jpg` },
  { id: 27, path: `${baseUrl}assets/images/dp-options/photo_5235923888607267716_w.jpg` },
  { id: 28, path: `${baseUrl}assets/images/dp-options/photo_5235923888607267717_w.jpg` },
  { id: 29, path: `${baseUrl}assets/images/dp-options/photo_5257989785601641848_w.jpg` },
  { id: 30, path: `${baseUrl}assets/images/dp-options/photo_5257989785601641845_w.jpg` },
  { id: 31, path: `${baseUrl}assets/images/dp-options/photo_5257989785601641846_w.jpg` },
  { id: 32, path: `${baseUrl}assets/images/dp-options/photo_5257989785601641850_w.jpg` },
  { id: 33, path: `${baseUrl}assets/images/dp-options/photo_5257989785601641853_w.jpg` },
  { id: 34, path: `${baseUrl}assets/images/dp-options/photo_5257989785601641852_w.jpg` },
  { id: 35, path: `${baseUrl}assets/images/dp-options/photo_5257989785601641849_w.jpg` },
  { id: 36, path: `${baseUrl}assets/images/dp-options/photo_5257989785601641851_w.jpg` },
  { id: 37, path: `${baseUrl}assets/images/dp-options/photo_5257989785601641844_w.jpg` },
  { id: 38, path: `${baseUrl}assets/images/dp-options/photo_5257989785601641779_w.jpg` },
  { id: 39, path: `${baseUrl}assets/images/dp-options/photo_5257989785601641784_w.jpg` },
  { id: 40, path: `${baseUrl}assets/images/dp-options/photo_5257989785601641785_w.jpg` },
  { id: 41, path: `${baseUrl}assets/images/dp-options/photo_5257989785601641781_w.jpg` },
  { id: 42, path: `${baseUrl}assets/images/dp-options/photo_5257989785601641780_w.jpg` },
  { id: 43, path: `${baseUrl}assets/images/dp-options/photo_5257989785601641777_w.jpg` },
  { id: 44, path: `${baseUrl}assets/images/dp-options/photo_5257989785601641778_w.jpg` },
  { id: 45, path: `${baseUrl}assets/images/dp-options/photo_5257989785601641776_w.jpg` },
  { id: 46, path: `${baseUrl}assets/images/dp-options/photo_5257989785601641783_w.jpg` }
];

// Helper function to get DP by ID
export const getDpById = (id) => {
  return dpOptions.find(dp => dp.id === parseInt(id));
};

// Helper function to get random DP
export const getRandomDp = () => {
  return dpOptions[Math.floor(Math.random() * dpOptions.length)];
};

// Helper function to get DP path by ID (returns path or null)
export const getDpPath = (id) => {
  const dp = getDpById(id);
  return dp ? dp.path : null;
};

export default dpOptions;