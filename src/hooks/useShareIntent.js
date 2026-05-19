import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { isNativeWithPlugins, safePluginCall } from '../utils/platformCheck';

/**
 * useShareIntent
 *
 * Listens for the native Android "incomingShareIntent" event fired by MainActivity.java
 * whenever the user shares a file to Elevengram from ANY other Android app
 * (Gallery, Files, WhatsApp, Downloads, etc.).
 *
 * On receiving the event:
 *  1. Shows a toast to confirm the incoming file
 *  2. Fetches the file as a Blob via @capacitor/filesystem or native fetch
 *  3. Navigates to /offline-share with the File object in state
 */
export const useShareIntent = () => {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isNativeWithPlugins()) return; // Only runs inside the Android wrapper

    let listenerHandle = null;

    const setupListener = async () => {
      try {
        // Dynamically import Capacitor plugins to stay compatible with web fallback
        const { Plugins } = await import('@capacitor/core');
        const CabaNative = Plugins?.CabaNative;

        if (!CabaNative) {
          console.warn('[useShareIntent] CabaNative plugin not available.');
          return;
        }

        listenerHandle = await CabaNative.addListener('incomingShareIntent', async (eventData) => {
          console.log('[useShareIntent] Incoming share intent received:', eventData);

          try {
            // eventData.value is the JSON string from sendEventToJS()
            const payload = typeof eventData.value === 'string'
              ? JSON.parse(eventData.value)
              : eventData.value;

            const { uri, name, mimeType, size } = payload;

            toast.loading(`Opening "${name}" for sharing...`, { id: 'share-intent-loading', duration: 3000 });

            // Fetch the file content from the Android content URI via capacitor
            const blob = await fetchFileBlob(uri, mimeType);

            if (!blob) {
              toast.error('Could not read the shared file.', { id: 'share-intent-loading' });
              return;
            }

            // Create a proper File object from the blob
            const file = new File([blob], name || 'shared_file', {
              type: mimeType || 'application/octet-stream',
              lastModified: Date.now()
            });

            toast.success(`"${name}" ready to share!`, { id: 'share-intent-loading' });

            // Navigate to offline share with the file pre-loaded in state
            navigate('/offline-share', {
              state: { incomingFile: file, autoStart: true }
            });

          } catch (err) {
            console.error('[useShareIntent] Failed to process incoming share:', err);
            toast.error('Could not open the shared file. Try again.', { id: 'share-intent-loading' });
          }
        });

        console.log('[useShareIntent] ✅ Listening for Android share intents...');
      } catch (err) {
        console.error('[useShareIntent] Setup failed:', err);
      }
    };

    setupListener();

    return () => {
      if (listenerHandle) {
        listenerHandle.remove().catch(() => {});
      }
    };
  }, [navigate]);
};

/**
 * Fetches the file at the given Android content URI as a Blob.
 * Uses @capacitor/filesystem to read the file bytes, falling back to native fetch.
 */
async function fetchFileBlob(contentUri, mimeType) {
  try {
    // Method 1: Use Capacitor Filesystem to read the file (most reliable for content:// URIs)
    const { Filesystem } = await import('@capacitor/filesystem');
    const result = await Filesystem.readFile({
      path: contentUri
    });

    if (result?.data) {
      // result.data is a base64 string
      const base64 = result.data;
      const byteChars = atob(base64);
      const byteNums = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteNums[i] = byteChars.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNums);
      return new Blob([byteArray], { type: mimeType || 'application/octet-stream' });
    }
  } catch (fsErr) {
    console.warn('[useShareIntent] Filesystem.readFile failed, trying native fetch:', fsErr);
  }

  try {
    // Method 2: Capacitor bridge can resolve content:// URIs via fetch in WebView
    const response = await fetch(contentUri);
    if (response.ok) {
      return await response.blob();
    }
  } catch (fetchErr) {
    console.warn('[useShareIntent] Native fetch failed:', fetchErr);
  }

  return null;
}
