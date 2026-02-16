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
      publicKey: '-----BEGIN RSA PUBLIC KEY-----\nMIIBCgKCAQEAvM8LPDwRV5whjCSW2yvMeFeieMa3h0HP/BF3Qw1q2wlNDzR/jX6A\nMxj8cEmzalggVXz6RIcQ4LYA4+xB31IwOu6G/WavuV6ZRvekWQh1Gna7f1Z8Euor\n9R30+sXcXrOGupUdaDvlRqqeadC0mjYPop29HO/Gzxn6cWiXCKSTHVaKlNUyuR2F\ne0IGhDafgv61At9DE3Hyk93nmydTFz9+ceSraWTeZUcgCGJOrdBApKv7+Q5NyGw/\n7X47V8Aj+t7ENz3ufENjnJDe5gASUGNG3C4PD+HK+8YIQEIl5y7Y1AEBP6k8pDfn\nBPAZ1dtH6duL2A3hVvkLTRD7UmJATdDKbQIDAQAB\n-----END RSA PUBLIC KEY-----\n',
    },
  },
};

export default config;