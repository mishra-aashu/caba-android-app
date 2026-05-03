import { useEffect, useCallback, useRef } from 'react';
import { PrivacyService } from '../../services/privacyService';
import { isNativeWithPlugins } from '../../utils/platformCheck';
import toast from 'react-hot-toast';

/**
 * useVanishPrivacy
 * 
 * Manages privacy side-effects for Vanish Mode.
 * - Android: Blocks screenshots and screen recording.
 * - Web: Blurs the UI when tab is switched/inactive and warns on screenshots.
 */
export const useVanishPrivacy = (isEnabled, options = {}) => {
  const { chatId, userId, userName } = options;
  const isWeb = !isNativeWithPlugins();
  const lastScreenshotTime = useRef(0);

  // Native Protection Toggle
  useEffect(() => {
    if (isEnabled) {
      PrivacyService.enable();
    } else {
      PrivacyService.disable();
    }

    return () => {
      // Ensure we disable when component unmounts
      PrivacyService.disable();
    };
  }, [isEnabled]);

  // Web-Specific Protection: Blur on Focus Loss
  useEffect(() => {
    if (!isEnabled || !isWeb) return;

    const handleBlur = () => {
      document.body.classList.add('vanish-mode-blurred');
    };

    const handleFocus = () => {
      document.body.classList.remove('vanish-mode-blurred');
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        document.body.classList.add('vanish-mode-blurred');
      } else {
        // Delay un-blur slightly to prevent split-second screenshot captures
        setTimeout(() => {
          document.body.classList.remove('vanish-mode-blurred');
        }, 300);
      }
    };

    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('mouseleave', handleBlur); // Blur if mouse leaves window
    window.addEventListener('mouseenter', handleFocus);

    // Heuristic 3: Disable Context Menu (Right-click)
    const handleContextMenu = (e) => {
      e.preventDefault();
      toast('🛡️ Context menu disabled for privacy', { id: 'ctx-warn' });
    };
    window.addEventListener('contextmenu', handleContextMenu);

    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('mouseleave', handleBlur);
      window.removeEventListener('mouseenter', handleFocus);
      window.removeEventListener('contextmenu', handleContextMenu);
      document.body.classList.remove('vanish-mode-blurred');
    };
  }, [isEnabled, isWeb]);

  // Web-Specific: Screenshot Alert & Persistent Blur
  useEffect(() => {
    if (!isEnabled || !isWeb) return;

    const triggerSecurityLock = () => {
      const now = Date.now();
      if (now - lastScreenshotTime.current < 2000) return;
      lastScreenshotTime.current = now;

      // 1. Report to the chat (so the other person knows)
      if (chatId && userId) {
        PrivacyService.reportScreenshot(chatId, userId, userName);
      }

      // 2. Add a persistent lock class
      document.body.classList.add('vanish-mode-locked');
      
      toast.error('🛡️ SECURITY ALERT: Screenshot attempt detected. Chat locked.', {
        duration: 5000,
        position: 'top-center',
        style: {
          background: '#ff4b4b',
          color: '#fff',
          fontWeight: 'bold',
          borderRadius: '12px',
        }
      });
    };

    // Heuristic 1: Key combinations (KeyDown & KeyUp)
    const handleKey = (e) => {
      const isSSKey = 
        e.key === 'PrintScreen' || 
        e.key === 'Snapshot' ||
        ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'S' || e.key === 's' || e.key === '3' || e.key === '4' || e.key === '5'));

      if (isSSKey) {
        triggerSecurityLock();
      }
    };

    window.addEventListener('keydown', handleKey);
    window.addEventListener('keyup', handleKey);
    
    // Disable Copy/Paste
    const preventCopy = (e) => {
      e.preventDefault();
      toast.error('Copying disabled in private mode');
    };
    window.addEventListener('copy', preventCopy);
    window.addEventListener('cut', preventCopy);

    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('keyup', handleKey);
      window.removeEventListener('copy', preventCopy);
      window.removeEventListener('cut', preventCopy);
      document.body.classList.remove('vanish-mode-locked');
    };
  }, [isEnabled, isWeb]);

  return null;
};

export default useVanishPrivacy;
