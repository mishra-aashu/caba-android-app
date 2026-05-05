import { App as CapacitorApp } from '@capacitor/app';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { Capacitor } from '@capacitor/core';
import { Filesystem } from '@capacitor/filesystem';
import { supabase } from '../config/supabase';

export const otaService = {
  /**
   * Initializes the OTA service, notifies the native layer that the app is ready.
   * This MUST be called early to prevent rollbacks.
   */
  init: async () => {
    if (!Capacitor.isNativePlatform()) return;

    try {
      console.log('OTA Service: Notifying App Ready...');
      // notifyAppReady() ensures that if this version loaded successfully, 
      // it won't be rolled back on next start.
      await CapacitorUpdater.notifyAppReady();
    } catch (err) {
      console.error('OTA Service: notifyAppReady failed:', err);
    }
  },

  /**
   * Fetches the latest available OTA update info from Supabase.
   * Does NOT download the update.
   */
  getLatestUpdate: async () => {
    if (!Capacitor.isNativePlatform()) return null;

    try {
      // 1. Get current running OTA version
      let currentBundleVersion = '';
      try {
        const currentOta = await CapacitorUpdater.current();
        currentBundleVersion = currentOta?.version || 'builtin';
      } catch (e) {
        currentBundleVersion = 'builtin';
      }

      // 2. Get native app version (e.g., "1.0.0")
      const info = await CapacitorApp.getInfo();
      const currentNativeVersion = info.version;

      // 3. Query Supabase for newest update matching this native version
      const { data, error } = await supabase
        .from('ota_updates')
        .select('bundle_version, bundle_url, changelog, priority, checksum')
        .eq('target_app_version', currentNativeVersion)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        const latest = data[0];
        
        // Only return if it's actually newer than what we have
        if (latest.bundle_version !== currentBundleVersion) {
          return {
            version: latest.bundle_version,
            url: latest.bundle_url,
            changelog: Array.isArray(latest.changelog) ? latest.changelog : [],
            priority: latest.priority || 'normal',
            checksum: latest.checksum || null
          };
        }
      }
      return null;
    } catch (err) {
      console.error('OTA Service: Check failed:', err);
      return null;
    }
  },

  /**
   * Downloads and applies an update. reloads the app.
   */
  performUpdate: async (updateInfo) => {
    if (!updateInfo || !updateInfo.url) return;

    try {
      console.log(`OTA Service: Starting update to ${updateInfo.version}...`);
      
      const downloadObj = await CapacitorUpdater.download({
        url: updateInfo.url,
        version: updateInfo.version
      });

      // --- NEW: Checksum Verification ---
      if (updateInfo.checksum) {
        console.log('OTA Service: Verifying checksum...');
        try {
          // Read the downloaded ZIP file
          const fileData = await Filesystem.readFile({
            path: downloadObj.path,
          });

          // Convert base64 to ArrayBuffer
          const binaryString = atob(fileData.data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          const buffer = bytes.buffer;

          // Compute SHA-256
          const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          const computedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

          if (computedHash !== updateInfo.checksum) {
            console.error(`OTA Service: Checksum mismatch! Expected ${updateInfo.checksum}, got ${computedHash}`);
            throw new Error('Update file verification failed. Please try again later.');
          }
          console.log('OTA Service: Checksum verified successfully.');
        } catch (hashErr) {
          console.error('OTA Service: Hash verification failed:', hashErr);
          throw hashErr;
        }
      } else {
        console.warn('OTA Service: No checksum provided for this update. Proceeding with caution.');
      }
      // ----------------------------------

      console.log('OTA Service: Download complete. Applying and reloading...');
      
      // 4. Set the new version as the 'next' version to be loaded on restart
      await CapacitorUpdater.next(downloadObj);
      console.log('OTA Service: Update prepared for next restart.');
      
    } catch (err) {
      console.error('OTA Service: Update failed:', err);
      throw err;
    }
  }
};
