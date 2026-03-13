import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import './styles/tokens.css';
import './styles/game-tokens.css';
import './index.css';
import './styles/theme-tokens.css';
import './styles/theme-integration.css'
import './styles/app.css';
import App from './App.jsx'
import { ThemeProvider } from './contexts/ThemeProvider.jsx'
import { ChatThemeProvider } from './contexts/ChatThemeProvider.jsx'
import { EmojiStyleProvider } from './contexts/EmojiStyleProvider.jsx'
import { SupabaseProvider } from './contexts/SupabaseProvider.jsx'
import { AuthProvider } from './contexts/AuthProvider.jsx'
import { useAuth } from './contexts/AuthContext.js'
import { CallProvider } from './contexts/CallProvider.jsx'
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import AppErrorBoundary from './components/common/AppErrorBoundary';

// Create the LocalStorage persister
const persister = createSyncStoragePersister({
  storage: window.localStorage,
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 Minutes (Global)
      gcTime: 1000 * 60 * 30, // 30 Minutes
      refetchOnWindowFocus: false,
      refetchOnMount: true, // Allow refetch on mount if stale
      retry: 1,
      networkMode: 'offlineFirst',
    },
    mutations: {
      retry: 1,
      networkMode: 'offlineFirst',
    },
  },
});

// Create a component to wrap CallProvider and pass user
const AppWithCallProvider = () => {
  const { user } = useAuth();
  return (
    <CallProvider currentUser={user}>
      <App />
    </CallProvider>
  );
};

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
              <ChatThemeProvider>
                <EmojiStyleProvider>
                  <AppWithCallProvider />
                </EmojiStyleProvider>
              </ChatThemeProvider>
            </ThemeProvider>
          </AuthProvider>
        </SupabaseProvider>
      </PersistQueryClientProvider>
    </HashRouter>
  </AppErrorBoundary>
)
