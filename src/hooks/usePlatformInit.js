import { useEffect, useState } from 'react';
import { SafeAreaDetector } from '../utils/safeAreaDetector';
import { KeyboardHandler } from '../utils/keyboardHandler';
import { initializePushNotifications } from '../utils/PushNotifications';
import { requestPersistentStorage } from '../db/db';
import { FileCache } from '../utils/FileCache';
import { otaService } from '../services/otaService';

let isInitStarted = false;
let isFinished = false;
let initPromise = null;

export const usePlatformInit = () => {
  const [isInitialized, setIsInitialized] = useState(isFinished);

  useEffect(() => {
    if (isFinished) {
      setIsInitialized(true);
      return;
    }

    if (isInitStarted) {
      initPromise.then(() => setIsInitialized(true));
      return;
    }

    isInitStarted = true;
    
    // Create a promise that other callers can wait on
    let resolveInit;
    initPromise = new Promise(resolve => { resolveInit = resolve; });

    const initApp = async () => {
      // 0. Handle Deep Linking for OAuth
      const { search } = window.location;
      if (search.startsWith('?/')) {
        const path = search.slice(2).replace(/~and~/g, '&');
        window.history.replaceState(null, '', path);
      }

      // 1. Initialize Singleton instances
      SafeAreaDetector.getInstance();
      KeyboardHandler.getInstance();

      // 2. Platform detection and styling
      const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
      const isAndroid = /Android/i.test(navigator.userAgent);
      const platform = isIOS ? 'ios' : (isAndroid ? 'android' : 'web');
      document.body.classList.add(`platform-${platform}`);

      const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone ||
        document.referrer.includes('android-app://');
      document.documentElement.setAttribute('data-standalone', isStandalone ? 'true' : 'false');

      // 3. Dynamic viewport height for WebView stability
      const updateAppHeight = () => {
        document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
      };
      updateAppHeight();
      window.addEventListener('resize', updateAppHeight);

      // 4. iOS specific scroll behavior
      if (isIOS) document.body.style.overscrollBehavior = 'none';

      // 5. Heavy Plugin/Storage Initialization (Wait for these)
      try {
        await Promise.all([
          initializePushNotifications(),
          requestPersistentStorage(),
          FileCache.init(),
          otaService.init().catch(err => console.warn("OTA Service: Initialization failed", err))
        ]);
      } catch (err) {
        console.error("Platform Init Error:", err);
      }

      isFinished = true;
      setIsInitialized(true);
      resolveInit();
    };

    initApp();

    return () => {
      window.removeEventListener('resize', () => {
        document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
      });
    };
  }, []);

  return { isInitialized };
};

export default usePlatformInit;
