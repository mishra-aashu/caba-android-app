import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { supabase } from '../config/supabase';

async function saveTokenToSupabase(token) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log("User not logged in, cannot save FCM token.");
      return null;
    }

    const platform = Capacitor.getPlatform(); // 'web', 'ios', or 'android'

    // Decide which column to update
    let columnToUpdate;
    if (platform === 'web') {
      columnToUpdate = 'fcm_token_web';
    } else {
      // Default to mobile for 'android' and 'ios'
      columnToUpdate = 'fcm_token_android';
    }

    // Dynamically update the correct column
    const { error } = await supabase
      .from('users')
      .update({ [columnToUpdate]: token }) // Dynamic key update
      .eq('id', user.id);

    if (error) throw error;

    console.log(`✅ FCM Token saved to ${columnToUpdate} in Supabase!`);

    // Return user ID for Firestore sync
    return user.id;

  } catch (error) {
    console.error("❌ Error saving FCM token to Supabase:", error.message);
    return null;
  }
}



export const initializePushNotifications = async () => {
  console.log("🚀 Initializing Push Notifications..."); // Ye dikhna chahiye pehle

  try {
    const platform = Capacitor.getPlatform();

    // --- ANDROID/iOS LOGIC ---
    if (platform !== 'web') {
      try {
        await PushNotifications.requestPermissions();
        await PushNotifications.register();

        // TOKEN LISTENER
        PushNotifications.addListener('registration', async (token) => {
          console.log('🔥🔥 MY ANDROID/iOS TOKEN:', token.value);

          // Save to Supabase
          await saveTokenToSupabase(token.value);
        });

        PushNotifications.addListener('registrationError', (error) => {
          console.error('❌ Error on registration: ', error);
        });
      } catch (e) {
        console.warn('[PushNotifications] Plugin not implemented or failed:', e.message);
      }
    }

    // --- WEB LOGIC ---
    else {
      console.log('Push notifications on Web are not currently supported without Firebase FCM.');
    }
  } catch (err) {
    console.log('❌ An error occurred during push notification initialization. ', err);
  }
};
