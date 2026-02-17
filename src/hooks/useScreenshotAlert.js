/**
 * useScreenshotAlert - Hook to detect screenshots in group chats
 * Uses Page Visibility API to detect when user takes a screenshot
 */

import { useEffect, useCallback, useRef, useState } from 'react';
import { useSupabase } from '../contexts/SupabaseContext';
import { supabase as supabaseClient } from '../config/supabase';
import { reportScreenshot } from '../services/groupService';
import toast from 'react-hot-toast';

/**
 * Hook to detect screenshots in group chats
 * @param {string} groupId - Group ID for reporting
 * @param {boolean} isEnabled - Whether to enable screenshot detection
 * @returns {Object} - Screenshot detection state
 */
export const useScreenshotAlert = (groupId, isEnabled = true) => {
  const { supabase } = useSupabase();
  const lastScreenshotTime = useRef(0);
  const isEnabledRef = useRef(isEnabled);

  // Update ref when isEnabled changes
  useEffect(() => {
    isEnabledRef.current = isEnabled;
  }, [isEnabled]);

  // Handle screenshot detection
  const handleScreenshot = useCallback(async () => {
    // Rate limit: only report once per 5 seconds
    const now = Date.now();
    if (now - lastScreenshotTime.current < 5000) return;
    lastScreenshotTime.current = now;

    // Only report in group chats
    if (!groupId || !isEnabledRef.current) return;

    try {
      // Get current user from localStorage or auth
      const session = supabase?.auth?.getSession();
      const userId = session?.data?.session?.user?.id;
      
      if (!userId) return;

      // Report screenshot to the group
      await reportScreenshot(groupId, userId, null);
      
      // Optional: Show toast notification (will be shown by system message)
      console.log('Screenshot detected and reported');
    } catch (error) {
      console.error('Error reporting screenshot:', error);
    }
  }, [groupId, supabase]);

  // Set up screenshot detection listeners
  useEffect(() => {
    if (!isEnabled || !groupId) return;

    // Check for screenshot on visibility change (most reliable method)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // User just came back to the page - might have taken a screenshot
        // This is a heuristic - not 100% accurate
        handleScreenshot();
      }
    };

    // Listen for webkit screenshot notification (iOS Safari)
    const handleWebkitScreenshot = () => {
      handleScreenshot();
    };

    // Add event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Check for screenshot on interval (fallback)
    const screenshotInterval = setInterval(() => {
      // This is a workaround - there's no direct screenshot API
      // We rely on visibility change + user activity
    }, 5000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(screenshotInterval);
    };
  }, [groupId, isEnabled, handleScreenshot]);

  return {
    reportScreenshot: handleScreenshot,
    isEnabled,
  };
};

/**
 * Hook to display screenshot alert notification
 * Shows a toast when a system message about screenshot is received
 */
export const useScreenshotNotification = (groupId) => {
  const [lastNotification, setLastNotification] = useState(0);

  useEffect(() => {
    if (!groupId) return;

    // Listen for new messages that might be screenshot alerts
    const channel = supabaseClient
      .channel(`screenshot_notifications_${groupId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `chat_id=eq.${groupId}`,
      }, (payload) => {
        const newMessage = payload.new;
        
        // Check if it's a screenshot alert
        if (newMessage.content?.includes('took a screenshot')) {
          // Rate limit notifications
          const now = Date.now();
          if (now - lastNotification > 10000) {
            setLastNotification(now);
            toast.custom((t) => (
              <div className={`screenshot-toast ${t.visible ? 'show' : ''}`}>
                📸 {newMessage.content}
              </div>
            ), {
              duration: 5000,
              position: 'top',
            });
          }
        }
      })
      .subscribe();

    return () => {
      supabaseClient.removeChannel(channel);
    };
  }, [groupId, lastNotification]);

  return null;
};

export default useScreenshotAlert;
