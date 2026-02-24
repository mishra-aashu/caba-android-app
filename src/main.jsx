import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import './index.css';
import './styles/theme-tokens.css';
import './styles/theme-integration.css';
import './styles/app.css';
import App from './App.jsx'
import { ThemeProvider } from './contexts/ThemeContext.jsx'
import { ChatThemeProvider } from './contexts/ChatThemeContext.jsx'
import { EmojiStyleProvider } from './contexts/EmojiStyleContext.jsx'
import { SupabaseProvider } from './contexts/SupabaseContext.jsx'
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx'
import { CallProvider } from './context/CallContext.jsx' // Import CallProvider
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createIDBPersister } from './utils/persister';
import AppErrorBoundary from './components/common/AppErrorBoundary';

// Create the IndexedDB persister
const persister = createIDBPersister('reactQueryClient');

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 Minutes (Data stays 'fresh', no refetch on tab switch)
      gcTime: 1000 * 60 * 30, // 30 Minutes (Keep unused data in cache)
      refetchOnWindowFocus: false, // Do NOT refetch when switching tabs/windows
      refetchOnMount: false, // If data is in cache and fresh, use it - no fetch again
      retry: 1, // Retry failed requests only once
      // Network error handling - don't show error immediately, allow offline
      networkMode: 'offlineFirst', // Only make requests when online
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
          // Optional: Log when hydration is complete
          console.log('Query client restored from IndexedDB');
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
