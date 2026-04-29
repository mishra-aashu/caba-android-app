import { App as CapacitorApp } from '@capacitor/app';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { Capacitor } from '@capacitor/core';
import { supabase } from '../config/supabase';

// Throttle configuration (30 minutes)
const CHECK_THROTTLE_MS = 30 * 60 * 1000;
let lastCheckTime = 0;
let isChecking = false;

export const otaService = {
  /**
   * Initializes the OTA service, notifies the native layer that the app is ready,
   * and sets up foreground resume listeners.
   */
  init: async () => {
    if (!Capacitor.isNativePlatform()) {
      console.log('OTA Service: Skipping on non-native platform.');
      return;
    }

    try {
      console.log('OTA Service: Notifying App Ready (Rollback Safe)...');
      // Critical: Signals that this bundle loaded successfully. 
      // If the app crashes before this, the native layer rolls back automatically.
      await CapacitorUpdater.notifyAppReady();

      // Initial check on boot
      await otaService.checkForUpdates();

      // Listen for app resume (coming from background to foreground)
      CapacitorApp.addListener('appStateChange', async ({ isActive }) => {
        if (isActive) {
          console.log('OTA Service: App resumed, checking if update check is needed...');
          await otaService.checkForUpdates();
        }
      });

    } catch (err) {
      console.error('OTA Service: Initialization failed:', err);
    }
  },

  /**
   * Performs the actual update check against Supabase.
   * Includes throttling to prevent excessive database hits.
   */
  checkForUpdates: async () => {
    const now = Date.now();

    // Prevent concurrent checks or spamming
    if (isChecking) return;
    if (now - lastCheckTime < CHECK_THROTTLE_MS) {
      console.log(`OTA Service: Skipping check (Throttled. Last check was ${Math.round((now - lastCheckTime) / 60000)}m ago).`);
      return;
    }

    isChecking = true;
    lastCheckTime = now;

    try {
      console.log('OTA Service: Checking for updates...');

      // 1. Get current running OTA bundle version
      let currentBundleVersion = '';
      try {
        const currentOta = await CapacitorUpdater.current();
        currentBundleVersion = currentOta?.version || '';
      } catch (e) {
        console.log('OTA Service: No previous OTA version found.');
      }

      // 2. Get native app version (e.g., "3.5.0")
      const info = await CapacitorApp.getInfo();
      const currentNativeVersion = info.version;

      console.log(`OTA Service: Native[${currentNativeVersion}] Bundle[${currentBundleVersion}]`);

      // 3. Query Supabase for the latest OTA matching this native version
      const { data, error } = await supabase
        .from('ota_updates')
        .select('bundle_version, bundle_url')
        .eq('target_app_version', currentNativeVersion)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('OTA Service: Supabase fetch error:', error);
        return;
      }

      if (data && data.length > 0) {
        const latestUpdate = data[0];
        
        // 4. If a newer bundle exists, download and stage it
        if (latestUpdate.bundle_version !== currentBundleVersion) {
          console.log(`OTA Service: New update available [${latestUpdate.bundle_version}]. Downloading...`);
          
          const downloadObj = await CapacitorUpdater.download({
            url: latestUpdate.bundle_url,
            version: latestUpdate.bundle_version
          });
          
          console.log('OTA Service: Download complete. Staging for next restart...');
          await CapacitorUpdater.set(downloadObj);
          console.log('OTA Service: Update staged successfully.');
        } else {
          console.log('OTA Service: App is already up to date.');
        }
      } else {
        console.log('OTA Service: No OTA records found for this native version.');
      }
    } catch (err) {
      console.error('OTA Service: Update check failed:', err);
    } finally {
      isChecking = false;
    }
  }
};
