import { App as CapacitorApp } from '@capacitor/app';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { Capacitor } from '@capacitor/core';
import { supabase } from '../config/supabase'; // Assuming your singleton is here

export const otaService = {
  init: async () => {
    // Only run on native platforms
    if (!Capacitor.isNativePlatform()) {
      console.log('OTA Service: Skipping on non-native platform.');
      return;
    }

    try {
      console.log('OTA Service: Notifying App Ready (Rollback Safe)...');
      // Signals the native layer that this JS bundle has booted successfully.
      // If this isn't called (e.g. crash/white screen), the plugin reverts on next launch.
      await CapacitorUpdater.notifyAppReady();

      console.log('OTA Service: Checking for updates...');
      // Get current running OTA version
      let currentBundleVersion = '';
      try {
        const currentOta = await CapacitorUpdater.current();
        currentBundleVersion = currentOta?.version || '';
      } catch (e) {
        // First run, no OTA applied yet
        console.log('OTA Service: No previous OTA version found.');
      }

      // Native app ka current version nikalte hain (e.g., "1.0.0")
      const info = await CapacitorApp.getInfo();
      const currentNativeVersion = info.version;
      
      console.log(`OTA Service: Native Version is ${currentNativeVersion}, Current Bundle is ${currentBundleVersion}`);

      // Supabase se is version ka latest OTA fetch karte hain
      const { data, error } = await supabase
        .from('ota_updates')
        .select('bundle_version, bundle_url')
        .eq('target_app_version', currentNativeVersion)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('OTA Service: Error fetching updates from Supabase:', error);
        return;
      }

      if (data && data.length > 0) {
        const latestUpdate = data[0];
        console.log(`OTA Service: Latest Bundle Version on Server is ${latestUpdate.bundle_version}`);

        // The Magic Check: Loop Prevention
        if (latestUpdate.bundle_version !== currentBundleVersion) {
          console.log('OTA Service: New update found! Downloading...');
          
          // Download the OTA bundle
          const downloadObj = await CapacitorUpdater.download({
            url: latestUpdate.bundle_url,
            version: latestUpdate.bundle_version
          });
          
          console.log('OTA Service: Download complete. Staging for next restart...');
          // Stage the update for the next cold start
          await CapacitorUpdater.set(downloadObj);
          console.log('OTA Service: Update staged successfully.');
        } else {
          console.log('OTA Service: App is already up to date.');
        }
      } else {
        console.log('OTA Service: No updates found for this native version.');
      }
    } catch (err) {
      console.error('OTA Service: OTA Check failed:', err);
    }
  }
};
