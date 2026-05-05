import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { createHtmlPlugin } from 'vite-plugin-html';
import fs from 'fs';
import path from 'path';
import { visualizer } from 'rollup-plugin-visualizer';
export default defineConfig(({ mode }) => {
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
      //   skipWaiting: true     → New SW immediately takes over
      //                           pwa.js controllerchange listener handles reload
      //   clientsClaim: true    → After activation, control all tabs immediately
      //   globIgnores           → version.json MUST NOT be precached
      // ══════════════════════════════════════════════════════════
      VitePWA({
        injectRegister: null,     // Manual registration in src/pwa.js
        registerType: 'autoUpdate', // ✅ Turant update karne ke liye

        includeAssets: ['favicon-32x32.png', 'apple-touch-icon.png', 'mask-icon.svg'],

        manifest: {
          name: 'Elevengram Music & Chat',
          short_name: 'Elevengram',
          description: 'A premium music and chat experience',
          theme_color: '#0b141a',
          background_color: '#0b141a',
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
          cleanupOutdatedCaches: true, // ✅ Purana cache turant delete karein
          navigateFallback: isGitHubPages
            ? '/caba-android-app/index.html'
            : 'index.html',

          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,ogg,mp3,json}'],

          // ⚠️ CRITICAL: These files must NEVER be precached by Workbox.
          // version.json must always be fetched fresh from network
          // for update detection to work correctly.
          globIgnores: [
            '**/version.json',
            '**/native-integrity.json',
          ],

          maximumFileSizeToCacheInBytes: 30 * 1024 * 1024, // 30MB

          // SW lifecycle:
          // skipWaiting: true  → New SW immediately activates (no waiting)
          //                       pwa.js controllerchange listener reloads page
          // clientsClaim: true → After activation, control ALL open tabs immediately
          skipWaiting: true,    // ✅ Immediately activate new SW
          clientsClaim: true,   // ✅ Take control of all tabs immediately

          runtimeCaching: [
            {
              // HTML navigation — NetworkFirst so user gets fresh shell when online
              // Falls back to cache when offline (no "webpage not available")
              urlPattern: ({ request }) => request.mode === 'navigate',
              handler: 'NetworkFirst',
              options: {
                cacheName: 'navigation-cache',
                networkTimeoutSeconds: 5,
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
                },
                cacheableResponse: {
                  statuses: [0, 200],
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
            {
              // Audio files caching (Range Request Support)
              // Matches common audio extensions and the JioSaavn CDN pattern
              urlPattern: /.*\.mp3|.*\.m4a|.*\.aac|.*\.ogg|.*\.wav|.*saavncdn\.com.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'audio-cache',
                expiration: {
                  maxEntries: 100, // Sufficient for a large library
                  maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
                },
                cacheableResponse: {
                  statuses: [0, 200], // 0 for opaque (CORS) responses
                },
                rangeRequests: true, // CRITICAL: Handles partial content for audio playback
              },
            },
          ],
        },
      }),
      visualizer({
        filename: 'dist/bundle-stats.html',
        open: false,
        gzipSize: true,
        brotliSize: true,
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
                    'vendor-sentry': ['@sentry/react'],
                    'vendor-motion': ['framer-motion'],
                    'vendor-icons': ['lucide-react'],
                    'vendor-ui-extras': ['react-hot-toast'],
                    'vendor-db': ['dexie', 'dexie-react-hooks'],
                    'vendor-query': [
                      '@tanstack/react-query',
                      '@tanstack/react-query-persist-client',
                    ],
                    'vendor-giphy': ['@giphy/react-components', '@giphy/js-fetch-api', 'styled-components'],
                    'vendor-recharts': ['recharts'],
                    'vendor-crypto': ['crypto-js'],
                }
            }
        }
    }
  };
});