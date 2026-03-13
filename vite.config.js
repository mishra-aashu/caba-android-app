import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { createHtmlPlugin } from 'vite-plugin-html';
import fs from 'fs';
import path from 'path';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Check if we are building for GitHub Pages
  const isGitHubPages = process.env.GITHUB_PAGES === 'true';

  return {
    // GitHub Pages: '/caba-android-app/', Android/Capacitor: '' (Root)
    base: isGitHubPages ? '/caba-android-app/' : '/',
    server: {
      watch: {
        ignored: ['**/android/**', '**/dist/**', '**/node_modules/**']
      }
    },

    plugins: [
      react(),
      {
        name: 'generate-version-json',
        buildStart() {
          const version = { buildTime: Date.now() };
          const publicDir = path.resolve(__dirname, 'public');
          if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir);
          fs.writeFileSync(path.join(publicDir, 'version.json'), JSON.stringify(version, null, 2));
          console.log('[VersionGen] Generated public/version.json');
        }
      },
      createHtmlPlugin({
        inject: {
          data: {
            buildTime: Date.now(),
            buildDate: new Date().toISOString()
          }
        }
      }),
      VitePWA({
        injectRegister: null,
        registerType: 'prompt',
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
              type: 'image/png'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ]
        },
        workbox: {
          // Important for GitHub Pages SPA support
          navigateFallback: isGitHubPages ? '/caba-android-app/index.html' : 'index.html',
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
          runtimeCaching: [
            {
              urlPattern: ({ url }) => url.pathname === '/' || url.pathname.endsWith('index.html'),
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'entry-point-cache',
                expiration: {
                  maxEntries: 1,
                }
              }
            },
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            }
          ]
        }
      })
    ],
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
    },
    build: {
      chunkSizeWarningLimit: 3000,
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-supabase': ['@supabase/supabase-js'],
            'vendor-ui': ['framer-motion', 'lucide-react', 'react-icons'],
            'vendor-query': ['@tanstack/react-query', '@tanstack/react-query-persist-client'],
          }
        }
      }
    }
  };
});
