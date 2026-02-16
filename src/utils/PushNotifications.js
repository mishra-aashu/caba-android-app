import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken } from 'firebase/messaging';
import { supabase } from '../config/supabase';

// Firebase Config (Apna wala use karein)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

async function saveTokenToSupabase(token) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log("User not logged in, cannot save FCM token.");
      return;
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
    
  } catch (error) {
    console.error("❌ Error saving FCM token to Supabase:", error.message);
  }
}

export const initializePushNotifications = async () => {
  console.log("🚀 Initializing Push Notifications..."); // Ye dikhna chahiye pehle

  try {
    const platform = Capacitor.getPlatform();

    // --- ANDROID/iOS LOGIC ---
    if (platform !== 'web') {
      await PushNotifications.requestPermissions();
      await PushNotifications.register();

      // TOKEN LISTENER
      PushNotifications.addListener('registration', (token) => {
        console.log('🔥🔥 MY ANDROID/iOS TOKEN:', token.value);
        saveTokenToSupabase(token.value);
      });

      PushNotifications.addListener('registrationError', (error) => {
        console.error('❌ Error on registration: ', error);
      });
    } 
    
    // --- WEB LOGIC ---
    else {
      const app = initializeApp(firebaseConfig);
      const messaging = getMessaging(app);
      const permission = await Notification.requestPermission();

      if (permission === 'granted') {
        // VAPID KEY ZAROORI HAI (Firebase Console > Cloud Messaging > Web Config se milti hai)
        const currentToken = await getToken(messaging, { 
          vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY
        });
        
        if (currentToken) {
          console.log('🔥🔥 MY WEB TOKEN:', currentToken);
          saveTokenToSupabase(currentToken);
        } else {
          console.log('❌ No registration token available. Request permission to generate one.');
        }
      } else {
        console.log('❌ Permission denied for notifications.');
      }
    }
  } catch (err) {
    console.log('❌ An error occurred during push notification initialization. ', err);
  }
};
