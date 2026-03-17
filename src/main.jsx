import { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';

// ═══════════════════════════════════════════════════════════
// Register Service Worker EARLY (before React renders)
// This is CRITICAL — without this, sw.js never gets registered,
// meaning no offline cache, no update detection, nothing.
// ═══════════════════════════════════════════════════════════
import './pwa';

// ── CSS imports (order matters for cascade) ──
import './styles/tokens.css';
import './styles/game-tokens.css';
import './index.css';
import './styles/theme-tokens.css';
import './styles/theme-integration.css';
import './styles/app.css';
import './styles/desktop.css';
import './styles/call-screen.css';
import './styles/offline-indicator.css';
import './styles/emoji-styles.css';
import './styles/safeArea.css';

// ── Minimal root-level providers (lightweight, always needed) ──
import { ThemeProvider } from './contexts/ThemeProvider.jsx';
import { SupabaseProvider } from './contexts/SupabaseProvider.jsx';
import { AuthProvider } from './contexts/AuthProvider.jsx';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import AppErrorBoundary from './components/common/AppErrorBoundary';

// PublicApp handles the split between lean public routes (Landing, Login)
// and the heavy AuthenticatedApp shell (lazy-loaded only when logged in).
const PublicApp = lazy(() => import('./PublicApp'));

// ── TanStack Query persistence (offline-first) ──
const persister = createSyncStoragePersister({
  storage: window.localStorage,
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,        // 5 minutes
      gcTime: 1000 * 60 * 30,           // 30 minutes
      refetchOnWindowFocus: false,
      refetchOnMount: true,
      retry: 1,
      networkMode: 'offlineFirst',
    },
    mutations: {
      retry: 1,
      networkMode: 'offlineFirst',
    },
  },
});

// ── Mount App ──
createRoot(document.getElementById('root')).render(
  <AppErrorBoundary>
    <HashRouter>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister }}
        onSuccess={() => {
          console.log('Query client restored from LocalStorage');
        }}
      >
        <SupabaseProvider>
          <AuthProvider>
            <ThemeProvider>
              <Suspense fallback={<div className="loading" />}>
                <PublicApp />
              </Suspense>
            </ThemeProvider>
          </AuthProvider>
        </SupabaseProvider>
      </PersistQueryClientProvider>
    </HashRouter>
  </AppErrorBoundary>
);