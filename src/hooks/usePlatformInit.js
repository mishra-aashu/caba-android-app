import { useEffect } from 'react';
import { SafeAreaDetector } from '../utils/safeAreaDetector';
import { KeyboardHandler } from '../utils/keyboardHandler';
import { initializePushNotifications } from '../utils/PushNotifications';
import { requestPersistentStorage } from '../db/db';
import { FileCache } from '../utils/FileCache';

export const usePlatformInit = () => {
  useEffect(() => {
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

    // 5. Heavy Plugin/Storage Initialization
    initializePushNotifications();
    requestPersistentStorage();
    FileCache.init();

    return () => window.removeEventListener('resize', updateAppHeight);
  }, []);
};

export default usePlatformInit;
