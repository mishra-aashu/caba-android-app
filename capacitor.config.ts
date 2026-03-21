import { CapacitorConfig } from '@capacitor/cli';
import 'dotenv/config';

const config: CapacitorConfig = {
  appId: 'com.caba.app',
  appName: 'caba',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: false,
    allowNavigation: [
      'caba-android-app.vercel.app',
      '*.supabase.co',
      'accounts.google.com',
      '*.google.com'
    ]
  },
  plugins: {
    extConfig: {},
    GoogleAuth: {
      scopes: ['profile', 'email'],
      clientId: process.env.VITE_GOOGLE_CLIENT_ID || '335571630396-g270djndvqsj8p00kfgoq98995p1l3bm.apps.googleusercontent.com',
      serverClientId: process.env.VITE_GOOGLE_CLIENT_ID || '335571630396-g270djndvqsj8p00kfgoq98995p1l3bm.apps.googleusercontent.com',
      forceCodeForRefreshToken: true,
    },
    Keyboard: {
      resizeOnFullScreen: true,
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#1a1a2e',
      overlaysWebView: false,
    },
    // ═══ NEW: Splash Screen Config ═══
    SplashScreen: {
      launchShowDuration: 0,           // Don't auto-hide on timer
      launchAutoHide: false,           // WE control when to hide (in JS)
      backgroundColor: '#1a1a2e',      // Match app dark theme
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashImmersive: true,           // Full screen splash
      splashFullScreen: true,
    },
  },
};

export default config;