import { CapacitorConfig } from '@capacitor/cli';
import 'dotenv/config';

const config: CapacitorConfig = {
  appId: 'com.caba.app',
  appName: 'caba',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    extConfig: {},
    GoogleAuth: {
      scopes: ['profile', 'email'],
      clientId: '335571630396-g270djndvqsj8p00kfgoq98995p1l3bm.apps.googleusercontent.com',
      serverClientId: '335571630396-g270djndvqsj8p00kfgoq98995p1l3bm.apps.googleusercontent.com',
      forceCodeForRefreshToken: true,
    },
    CapacitorUpdater: {
      publicKey: process.env.CAPGO_PUBLIC_KEY,
    },
    // ── Keyboard Plugin ────────────────────────────────────────────────────────
    // resize + scrollAssist are set programmatically in useCapacitorPlugins.js
    Keyboard: {
      resizeOnFullScreen: true,
    },
    // ── StatusBar Plugin ───────────────────────────────────────────────────────
    // Initial color matches dark theme (#1a1a2e). Overridden in useCapacitorPlugins too.
    StatusBar: {
      style: 'dark',
      backgroundColor: '#1a1a2e',
      overlaysWebView: false,
    },
  },
};

export default config;