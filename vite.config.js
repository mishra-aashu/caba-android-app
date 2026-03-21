import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { createHtmlPlugin } from 'vite-plugin-html';
import fs from 'fs';
import path from 'path';
import { generateNativeHash } from './scripts/native-integrity.js';

export default defineConfig(({ mode }) => {
  // Single shared buildTime — used in BOTH version.json AND HTML meta tag
  // This ensures they always match for correct comparison
  const buildTime = Date.now();
  const isGitHubPages = process.env.GITHUB_PAGES === 'true';

  return {
    base: isGitHubPages ? '/caba-android-app/' : '/',

    server: {
      watch: {
        ignored: ['**/android/**', '**/dist/**', '**/node_modules/**'],
      },
    },

    plugins: [
      react(),

       // ══════════════════════════════════════════════════════════
      // PLUGIN 1: Generate version.json
      //
      // Creates { buildTime: 1749811200000 } in both public/ and dist/
      // useAutoRefresh fetches this from Vercel to detect new deploys
      // ══════════════════════════════════════════════════════════
      {
        name: 'generate-version-json',
        buildStart() {
          const versionData = { buildTime };
          const publicDir = path.resolve(__dirname, 'public');
          if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
          fs.writeFileSync(
            path.join(publicDir, 'version.json'),
            JSON.stringify(versionData, null, 2)
          );
          console.log('[VersionGen] public/version.json →', buildTime);
        },
        // Also write to dist/ AFTER build completes
        // Safety measure: Workbox precaching runs between buildStart and closeBundle,
        // this ensures version.json in dist/ has the correct value
        closeBundle() {
          const versionData = { buildTime };
          const distDir = path.resolve(__dirname, 'dist');
          if (fs.existsSync(distDir)) {
            fs.writeFileSync(
              path.join(distDir, 'version.json'),
              JSON.stringify(versionData, null, 2)
            );
            console.log('[VersionGen] dist/version.json → confirmed');
          }
        },
      },

      // ══════════════════════════════════════════════════════════
      // PLUGIN 2: Generate native-integrity.json (existing — untouched)
      // ══════════════════════════════════════════════════════════
      {
        name: 'generate-native-integrity',
        buildStart() {
          try {
            const integrity = generateNativeHash();
            const publicDir = path.resolve(__dirname, 'public');
            if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
            fs.writeFileSync(
              path.join(publicDir, 'native-integrity.json'),
              JSON.stringify({ ...integrity, generatedAt: Date.now() }, null, 2)
            );
            console.log('[NativeIntegrity] Generated — hash:', integrity.hash.slice(0, 12) + '...');
          } catch (e) {
            console.warn('[NativeIntegrity] Could not generate:', e.message);
          }
        },
      },

      // ══════════════════════════════════════════════════════════
      // PLUGIN 3: Inject buildTime into HTML <meta> tags
      //
      // index.html has: <meta name="build-time" content="<%= buildTime %>">
      // This replaces <%= buildTime %> with the actual timestamp
      // ══════════════════════════════════════════════════════════
      createHtmlPlugin({
        inject: {
          data: {
            buildTime,                                    // → meta[name="build-time"]
            buildDate: new Date(buildTime).toISOString(), // → meta[name="build-date"]
          },
        },
      }),

      // ══════════════════════════════════════════════════════════
      // PLUGIN 4: PWA + Service Worker (Workbox)
      //
      // KEY SETTINGS:
      //   injectRegister: null  → We register SW manually in src/pwa.js
      //   registerType: prompt  → Don't auto-reload, show update banner
      //   skipWaiting: false    → Wait for user to click "Update"
      //   clientsClaim: true    → After activation, control all tabs
      //   globIgnores           → version.json MUST NOT be precached
      // ══════════════════════════════════════════════════════════
      VitePWA({
        injectRegister: null,     // Manual registration in src/pwa.js
        registerType: 'prompt',   // Don't auto-reload, let user decide

        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],

        manifest: {
          name: 'CaBa Chat',
          short_name: 'CaBa',
          description: 'A production-grade offline-first chat app',
          theme_color: '#000000',
          background_color: '#ffffff',
          display: 'standalone',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable',
            },
          ],
        },

        workbox: {
          navigateFallback: isGitHubPages
            ? '/caba-android-app/index.html'
            : 'index.html',

          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,ogg,mp3}'],

          // ⚠️ CRITICAL: These files must NEVER be precached by Workbox.
          // version.json must always be fetched fresh from network
          // for update detection to work correctly.
          globIgnores: [
            '**/version.json',
            '**/native-integrity.json',
          ],

          maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10MB

          // SW lifecycle control
          skipWaiting: false,   // Don't auto-activate — wait for user to click "Update"
          clientsClaim: true,   // After activation, take control of all tabs immediately

          runtimeCaching: [
            {
              // HTML entry point — always revalidate in background
              urlPattern: ({ url }) =>
                url.pathname === '/' || url.pathname.endsWith('index.html'),
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'entry-point-cache',
                expiration: {
                  maxEntries: 1,
                },
              },
            },
            {
              // Google Fonts CSS
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              // Google Fonts files (woff2)
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
      }),
    ],

    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
    },

    build: {
        target: ['es2020', 'edge88', 'firefox78', 'chrome87', 'safari14'],
        cssCodeSplit: true,
        chunkSizeWarningLimit: 1000, // Lowered to encourage better chunking
        rollupOptions: {
            output: {
                manualChunks: {
                    'vendor-react': ['react', 'react-dom', 'react-router-dom'],
                    'vendor-supabase': ['@supabase/supabase-js'],
                    'vendor-ui': ['framer-motion', 'lucide-react', 'react-hot-toast'],
                    'vendor-db': ['dexie', 'dexie-react-hooks'],
                    'vendor-query': [
                      '@tanstack/react-query',
                      '@tanstack/react-query-persist-client',
                    ],
                }
            }
        }
    }
  };
});