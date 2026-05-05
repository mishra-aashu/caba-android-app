/**
 * useAutoRefresh.js
 *
 * Detects new version availability and handles the update flow.
 *
 * NATIVE:
 *   Detection: Supabase ota_updates (via otaService)
 *   Update: Download ZIP → Permanent local application → Restart
 *
 * WEB/VERCEL:
 *   Detection: SW events + version.json polling
 *   Update: Activate waiting SW → Page reloads
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../config/supabase';
import { onSWNeedRefresh, activateSWUpdate } from '../pwa';
import { isNativeWithPlugins } from '../utils/platformCheck';
import { otaService } from '../services/otaService';

const VERSION_CHECK_INTERVAL = 5 * 60 * 1000;
const INITIAL_CHECK_DELAY = 4000;
const FRESHNESS_WINDOW = 5000;

const OTA_SESSION_GUARD = 'ota-just-refreshed';
const REMOTE_ORIGIN = window.location.origin; // Use current origin for web to avoid CORS

export const useAutoRefresh = () => {
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);

  const currentBuildTimeRef = useRef(null);
  const checkTimeoutRef = useRef(null);
  const mountTimeRef = useRef(Date.now());
  const swUpdateReadyRef = useRef(false);

  const isLocalNativeRef = useRef(isNativeWithPlugins());

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
      console.log('[AutoRefresh] Service Worker detected new content');
      
      if (!isLocalNativeRef.current) {
        // Auto-refresh for web
        handleRefresh();
        return;
      }

      setNeedsRefresh(true);
    });

    if (sessionStorage.getItem(OTA_SESSION_GUARD)) {
      sessionStorage.removeItem(OTA_SESSION_GUARD);
    }
  }, []);

  // ─── Unified Update Check ───
  const checkForUpdates = useCallback(async () => {
    if (isRefreshing || isDismissed || !navigator.onLine) return;
    if (Date.now() - mountTimeRef.current < FRESHNESS_WINDOW) return;

    try {
      if (isLocalNativeRef.current) {
        // 1. NATIVE: Check Supabase ota_updates (GitHub OTT System)
        const latest = await otaService.getLatestUpdate();
        if (latest) {
          console.log(`[AutoRefresh] ✨ Native update available: ${latest.version}`);
          setUpdateInfo(latest);
          setNeedsRefresh(true);
        }
      } else {
        // 2. WEB/VERCEL: Poll version.json
        if (!currentBuildTimeRef.current) return;
        
        const response = await fetch(
          `${REMOTE_ORIGIN}/version.json?_t=${Date.now()}`,
          { cache: 'no-store' }
        );

        if (response.ok) {
          const data = await response.json();
          const remoteBuildTime = data.buildTime ? String(data.buildTime) : null;

          if (remoteBuildTime && remoteBuildTime !== String(currentBuildTimeRef.current)) {
            console.log('[AutoRefresh] ✨ Web update available');
            handleRefresh(); // Auto-refresh for web
          }
        }
      }
    } catch (error) {
      console.warn('[AutoRefresh] Check failed:', error.message);
    }

    if (checkTimeoutRef.current) clearTimeout(checkTimeoutRef.current);
    checkTimeoutRef.current = setTimeout(checkForUpdates, VERSION_CHECK_INTERVAL);
  }, [isRefreshing, isDismissed]);

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

  // ─── Handle Update Click ───
  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    sessionStorage.setItem(OTA_SESSION_GUARD, 'true');

    try {
      if (isLocalNativeRef.current) {
        // ══════════════════════════════════════
        // NATIVE LOCAL → Permanent ZIP Update
        // ══════════════════════════════════════
        console.log('[AutoRefresh] Starting permanent native update...');
        
        // Use otaService to download and apply
        // If we don't have updateInfo yet, we fetch it one last time
        let info = updateInfo;
        if (!info) {
          info = await otaService.getLatestUpdate();
        }

        if (info) {
          await otaService.performUpdate(info);
          // performUpdate reloads the app, so we don't need further logic here.
        } else {
          // Fallback if somehow info is missing
          window.location.reload();
        }

      } else {
        // ══════════════════════════════════════
        // WEB/VERCEL → Service Worker Update
        // ══════════════════════════════════════
        console.log('[AutoRefresh] Web update — activating new SW...');
        if (swUpdateReadyRef.current) {
          activateSWUpdate();
        } else {
          window.location.reload();
        }
      }
    } catch (error) {
      console.error('[AutoRefresh] Update failed:', error);
      setIsRefreshing(false);
      // Optional: show error message to user
    }
  }, [isRefreshing, updateInfo]);

  const handleDismiss = useCallback(() => {
    setIsDismissed(true);
    setNeedsRefresh(false);
  }, []);

  return {
    needsRefresh: needsRefresh && !isDismissed,
    handleRefresh,
    handleDismiss,
    checkForUpdates,
    isRefreshing,
    updateInfo, // Now correctly returned
  };
};