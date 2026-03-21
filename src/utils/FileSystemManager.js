import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { isNativeWithPlugins } from './platformCheck';

// 1. Permission Maango aur Folder Banao
export const initializeFileSystem = async () => {
  if (!isNativeWithPlugins()) return;
  try {
    try {
      const { type } = await Filesystem.stat({
        path: 'CaBa',
        directory: Directory.Data,
      });
      // If CaBa exists and is a directory, do nothing.
      if (type === 'directory') {
        console.log('CaBa directory already exists. Skipping creation.');
      }
    } catch (e) {
      // If stat fails, it means the directory probably doesn't exist, so create it.
      await Filesystem.mkdir({
        path: 'CaBa',
        directory: Directory.Data,
        recursive: true,
      });
    }

    // Images Folder Banao (CaBa/Images)
    try {
      const { type } = await Filesystem.stat({
        path: 'CaBa/Images',
        directory: Directory.Data,
      });
      if (type === 'directory') {
        console.log('CaBa/Images directory already exists. Skipping creation.');
      }
    } catch (e) {
      await Filesystem.mkdir({
        path: 'CaBa/Images',
        directory: Directory.Data,
        recursive: true,
      });
    }

    // Messages Folder Banao (CaBa/Messages)
    try {
      const { type } = await Filesystem.stat({
        path: 'CaBa/Messages',
        directory: Directory.Data,
      });
      if (type === 'directory') {
        console.log('CaBa/Messages directory already exists. Skipping creation.');
      }
    } catch (e) {
      await Filesystem.mkdir({
        path: 'CaBa/Messages',
        directory: Directory.Data,
        recursive: true,
      });
    }

    console.log('Folders Ready! ✅');
  } catch (e) {
    console.error('Folder Error:', e.name, e.message, e);
  }
};

// --- CHATS KO SAVE KARNA (WRITE) ---
export const saveChatsToDevice = async (allChats) => {
  if (!isNativeWithPlugins()) return;
  try {
    // Ensure parent directory exists before writing
    await Filesystem.mkdir({
      path: 'CaBa',
      directory: Directory.Data,
      recursive: true,
    }).catch(() => {}); // Ignore if already exists
    await Filesystem.writeFile({
      path: 'CaBa/chats.json',
      data: JSON.stringify(allChats),
      directory: Directory.Data,
      encoding: Encoding.UTF8,
    });
    console.log('Chats Saved Locally 💾');
  } catch (e) {
    console.error('Save Error:', e);
  }
};

// --- CHATS KO LOAD KARNA (READ) ---
export const loadChatsFromDevice = async () => {
  if (!isNativeWithPlugins()) return [];
  try {
    const contents = await Filesystem.readFile({
      path: 'CaBa/chats.json',
      directory: Directory.Data,
      encoding: Encoding.UTF8,
    });
    return JSON.parse(contents.data);
  } catch (e) {
    console.log('Koi purani chat nahi mili, New User hai.');
    return []; // Empty array return karo
  }
};

export const saveImageToDevice = async (photoUrl, messageId) => {
  if (!isNativeWithPlugins()) return photoUrl;
  try {
    // 1. Image Download karo
    const response = await fetch(photoUrl);
    const blob = await response.blob();
    
    // 2. Base64 convert (Helper function neeche hai)
    const base64Data = await convertBlobToBase64(blob);

    const fileName = `img_${messageId}.jpg`;

    // 3. Save karo (CaBa/Images folder mein)
    const savedFile = await Filesystem.writeFile({
      path: `CaBa/Images/${fileName}`,
      data: base64Data,
      directory: Directory.Data,
    });

    // 4. Local Path return karo (Taki app is path se image dikha sake)
    return savedFile.uri; 

  } catch (e) {
    console.error('Image Save Error:', e);
    return photoUrl; // Agar fail hua to online URL hi use karo
  }
};

// Helper Function
const convertBlobToBase64 = (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
        resolve(reader.result);
    };
    reader.readAsDataURL(blob);
});

// --- SAVE MESSAGES FOR A CHAT ---
export const saveMessagesToDevice = async (chatId, messages) => {
  if (!chatId || !isNativeWithPlugins()) return;
  try {
    // Ensure parent directory exists before writing
    await Filesystem.mkdir({
      path: 'CaBa/Messages',
      directory: Directory.Data,
      recursive: true,
    }).catch(() => {}); // Ignore if already exists
    const path = `CaBa/Messages/chat_${chatId}.json`;
    await Filesystem.writeFile({
      path,
      data: JSON.stringify(messages),
      directory: Directory.Data,
      encoding: Encoding.UTF8,
    });
  } catch (e) {
    console.error('Save Messages Error:', e);
  }
};

// --- LOAD MESSAGES FOR A CHAT ---
export const loadMessagesFromDevice = async (chatId) => {
  if (!chatId || !isNativeWithPlugins()) return [];
  try {
    const path = `CaBa/Messages/chat_${chatId}.json`;
    const contents = await Filesystem.readFile({
      path,
      directory: Directory.Data,
      encoding: Encoding.UTF8,
    });
    return JSON.parse(contents.data);
  } catch (e) {
    return []; // File doesn't exist, return empty array
  }
};

// --- CLEAR ALL CACHED DATA ---
export const clearAllCachedData = async () => {
  if (!isNativeWithPlugins()) return;
  try {
    // Delete the entire CaBa directory
    await Filesystem.rmdir({
      path: 'CaBa',
      directory: Directory.Data,
      recursive: true,
    });
    console.log('All cached data cleared successfully. 🗑️');
  } catch (e) {
    // It's okay if the directory doesn't exist
    console.log('No cache directory to clear or error clearing:', e);
  }
};
