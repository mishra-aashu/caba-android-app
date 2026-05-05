/**
 * useAutoRefresh.jsx
 *
 * Detects new version availability and handles the update flow.
 *
 * NATIVE:
 *   Detection: Supabase ota_updates (via otaService)
 *   Update: SILENT Background Download → Apply on Next Restart (Next Strategy)
 *
 * WEB/VERCEL:
 *   Detection: SW events + version.json polling
 *   Update: Show Banner → User Clicks → Page reloads
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { Network } from '@capacitor/network';
import toast from 'react-hot-toast';
import { onSWNeedRefresh, activateSWUpdate } from '../pwa';
import { isNativeWithPlugins } from '../utils/platformCheck';
import { otaService } from '../services/otaService';
import { isUpdateDismissed, setUpdateDismissed, clearUpdateDismissal } from '../utils/updateUtils';

const VERSION_CHECK_INTERVAL = 5 * 60 * 1000;
const INITIAL_CHECK_DELAY = 4000;
const FRESHNESS_WINDOW = 5000;

const OTA_SESSION_GUARD = 'ota-just-refreshed';
const REMOTE_ORIGIN = window.location.origin;

export const useAutoRefresh = () => {
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState(0);

  const currentBuildTimeRef = useRef(null);
  const checkTimeoutRef = useRef(null);
  const mountTimeRef = useRef(Date.now());
  const swUpdateReadyRef = useRef(false);

  const isLocalNativeRef = useRef(isNativeWithPlugins());
  const isUpdatingSilentRef = useRef(false);

  // ─── Initialize ───
  useEffect(() => {
    const metaTag = document.querySelector('meta[name="build-time"]');
    currentBuildTimeRef.current = metaTag?.content || null;

    onSWNeedRefresh(() => {
      swUpdateReadyRef.current = true;
      if (sessionStorage.getItem(OTA_SESSION_GUARD)) {
        sessionStorage.removeItem(OTA_SESSION_GUARD);
        return;
      }
      
      console.log('[AutoRefresh] Service Worker detected new content. Applying silent update...');
      handleRefresh(true); // Silent activation for Web
    });

    if (sessionStorage.getItem(OTA_SESSION_GUARD)) {
      sessionStorage.removeItem(OTA_SESSION_GUARD);
    }
  }, []);

  // ─── Handle Refresh ───
  const handleRefresh = useCallback(async (isSilent = false) => {
    if (isRefreshing || (isSilent && isUpdatingSilentRef.current)) return;
    
    if (isSilent) {
      isUpdatingSilentRef.current = true;
    } else {
      setIsRefreshing(true);
    }

    setDownloadProgress(0);
    sessionStorage.setItem(OTA_SESSION_GUARD, 'true');

    let progressListener = null;
    let toastId = null;

    // We only show progress and toasts for NON-SILENT updates (Web)
    if (!isSilent) {
      toastId = toast.loading('Activating update...');
    }

    if (isLocalNativeRef.current) {
      // Progress listener for native background download
      progressListener = await CapacitorUpdater.addListener('downloadProgress', (state) => {
        setDownloadProgress(state.percent);
      });
    }

    try {
      if (isLocalNativeRef.current) {
        console.log('[AutoRefresh] Starting silent background OTA update...');
        
        let info = updateInfo;
        if (!info) {
          info = await otaService.getLatestUpdate();
        }

        if (info) {
          await otaService.performUpdate(info);
          clearUpdateDismissal('ota', info.version);
          console.log('[AutoRefresh] Silent update ready for next restart');
        }
      } else {
        // WEB: This is always manual via banner
        console.log('[AutoRefresh] Web update — activating new SW...');
        if (swUpdateReadyRef.current) {
          activateSWUpdate();
          if (toastId) toast.success('Update activated!', { id: toastId });
        } else {
          window.location.reload();
        }
      }
    } catch (error) {
      console.error('[AutoRefresh] Update failed:', error);
      if (toastId) toast.error(error.message || 'Update failed.', { id: toastId });
    } finally {
      if (progressListener) progressListener.remove();
      setDownloadProgress(0);
      setIsRefreshing(false);
      isUpdatingSilentRef.current = false;
    }
  }, [isRefreshing, updateInfo]);

  // ─── Unified Update Check ───
  const checkForUpdates = useCallback(async () => {
    if (isRefreshing || isDismissed || !navigator.onLine) return;
    if (Date.now() - mountTimeRef.current < FRESHNESS_WINDOW) return;

    try {
      if (isLocalNativeRef.current) {
        // NATIVE: SILENT STRATEGY
        const latest = await otaService.getLatestUpdate();
        if (latest && !isUpdatingSilentRef.current) {
          console.log(`[AutoRefresh] ✨ Silent OTA update detected: ${latest.version}. Starting background download...`);
          setUpdateInfo(latest);
          
          // Auto-trigger background download ONLY on WiFi
          const status = await Network.getStatus();
          if (status.connectionType === 'wifi') {
            handleRefresh(true); // true = isSilent
          } else {
            // Mobile data: Don't auto-download, but ask the user
            console.log('[AutoRefresh] ℹ️ Update detected on cellular data. Asking user...');
            toast((t) => (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '14px', fontWeight: 500 }}>
                  Update Available ({latest.version}). Download now? (Uses mobile data)
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    onClick={() => {
                      toast.dismiss(t.id);
                      handleRefresh(true);
                    }}
                    style={{
                      padding: '4px 12px', background: '#3fcf8e', border: 'none',
                      borderRadius: '4px', color: '#fff', fontSize: '12px', fontWeight: 600
                    }}
                  >
                    Download
                  </button>
                  <button 
                    onClick={() => toast.dismiss(t.id)}
                    style={{
                      padding: '4px 12px', background: 'transparent', border: '1px solid #444',
                      borderRadius: '4px', color: '#888', fontSize: '12px'
                    }}
                  >
                    Later
                  </button>
                </div>
              </div>
            ), { 
              duration: 10000,
              position: 'bottom-center',
              style: { background: '#1a1a2e', color: '#fff', border: '1px solid #333' }
            });
          }
        }
      } else {
        // WEB/VERCEL: Poll version.json
        if (!currentBuildTimeRef.current) return;
        
        const response = await fetch(
          `${REMOTE_ORIGIN}/version.json?_t=${Date.now()}`,
          { cache: 'no-store' }
        );

        if (response.ok) {
          const data = await response.json();
          const remoteBuildTime = data.buildTime ? String(data.buildTime) : null;

          if (remoteBuildTime && remoteBuildTime !== String(currentBuildTimeRef.current)) {
            console.log('[AutoRefresh] ✨ Web update available. Applying silent reload...');
            handleRefresh(true); // Silent activation for Web
          }
        }
      }
    } catch (error) {
      console.warn('[AutoRefresh] Check failed:', error.message);
    }

    if (checkTimeoutRef.current) clearTimeout(checkTimeoutRef.current);
    checkTimeoutRef.current = setTimeout(checkForUpdates, VERSION_CHECK_INTERVAL);
  }, [isRefreshing, isDismissed, handleRefresh]);

  // ─── Start polling ───
  useEffect(() => {
    const timer = setTimeout(checkForUpdates, INITIAL_CHECK_DELAY);

    const onVisible = () => {
      if (!document.hidden && navigator.onLine) {
        setTimeout(checkForUpdates, 1000);
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearTimeout(timer);
      if (checkTimeoutRef.current) clearTimeout(checkTimeoutRef.current);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [checkForUpdates]);

  const handleDismiss = useCallback(() => {
    if (updateInfo) {
      setUpdateDismissed('ota', updateInfo.version, 24);
    }
    setIsDismissed(true);
    setNeedsRefresh(false);
  }, [updateInfo]);

  return {
    needsRefresh: needsRefresh && !isDismissed,
    handleRefresh: () => handleRefresh(false), // User manual click is never silent
    handleDismiss,
    checkForUpdates,
    isRefreshing,
    updateInfo,
    downloadProgress
  };
};