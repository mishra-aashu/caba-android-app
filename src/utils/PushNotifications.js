import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken } from 'firebase/messaging';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
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

// ✅ NEW: Save token to Firebase Firestore (for Cloud Functions)
async function saveTokenToFirestore(token, userId) {
  try {
    const platform = Capacitor.getPlatform();
    const firebaseApp = initializeApp(firebaseConfig);
    const db = getFirestore(firebaseApp);

    // Determine which token field to update
    const tokenField = platform === 'web' ? 'fcm_token_web' : 'fcm_token_android';

    // Save to Firestore users collection (Cloud Function reads from here)
    await setDoc(doc(db, "users", userId), {
      [tokenField]: token,
      lastTokenUpdate: new Date().toISOString()
    }, { merge: true });

    console.log(`✅ FCM Token saved to Firestore (${tokenField})!`);

  } catch (error) {
    console.error("❌ Error saving FCM token to Firestore:", error.message);
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
      PushNotifications.addListener('registration', async (token) => {
        console.log('🔥🔥 MY ANDROID/iOS TOKEN:', token.value);

        // Save to Supabase
        const userId = await saveTokenToSupabase(token.value);

        // ✅ ALSO save to Firestore for Cloud Function
        if (userId) {
          await saveTokenToFirestore(token.value, userId);
        }
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
        // Correct path for Service Worker to avoid 404 on GitHub Pages
        const swPath = window.location.pathname.startsWith('/caba-android-app')
          ? '/caba-android-app/firebase-messaging-sw.js'
          : '/firebase-messaging-sw.js';

        const currentToken = await getToken(messaging, {
          vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
          serviceWorkerRegistration: await navigator.serviceWorker.register(swPath)
        });

        if (currentToken) {
          console.log('🔥🔥 MY WEB TOKEN:', currentToken);

          // Save to Supabase
          const userId = await saveTokenToSupabase(currentToken);

          // ✅ ALSO save to Firestore for Cloud Function
          if (userId) {
            await saveTokenToFirestore(currentToken, userId);
          }
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
