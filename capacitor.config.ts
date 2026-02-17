import { CapacitorConfig } from '@capacitor/cli';
import 'dotenv/config';

const config: CapacitorConfig = {
  appId: 'com.caba.app', // Ye sahi hona chahiye
  appName: 'caba',
  webDir: 'dist',
  plugins: {
    extConfig: {},
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: process.env.GOOGLE_SERVER_CLIENT_ID, // <--- Yahan WEB Client ID aayega
      forceCodeForRefreshToken: true,
    },
    CapacitorUpdater: {
      publicKey: process.env.CAPGO_PUBLIC_KEY,
    },
  },
};

export default config;