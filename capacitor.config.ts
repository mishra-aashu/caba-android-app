import { CapacitorConfig } from '@capacitor/cli';
import 'dotenv/config';

const config: CapacitorConfig = {
  appId: 'com.caba.app',
  appName: 'caba',
  webDir: 'dist',
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
  },
};

export default config;