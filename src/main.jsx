import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import './index.css';
import './styles/app.css';
import App from './App.jsx'
import { ThemeProvider } from './contexts/ThemeContext.jsx'
import { ChatThemeProvider } from './contexts/ChatThemeContext.jsx'
import { EmojiStyleProvider } from './contexts/EmojiStyleContext.jsx'
import { SupabaseProvider } from './contexts/SupabaseContext.jsx'
import { AuthProvider } from './contexts/AuthContext.jsx'
import { CallProvider } from './context/CallContext.jsx' // Import CallProvider
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { useAuth } from './contexts/AuthContext.jsx';

const queryClient = new QueryClient();

const AppWrapper = () => {
  const { user } = useAuth();
  return (
    <CallProvider currentUser={user}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </CallProvider>
  );
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HashRouter>
      <SupabaseProvider>
        <AuthProvider>
          <ThemeProvider>
            <ChatThemeProvider>
              <EmojiStyleProvider>
                <AppWrapper />
              </EmojiStyleProvider>
            </ChatThemeProvider>
          </ThemeProvider>
        </AuthProvider>
      </SupabaseProvider>
    </HashRouter>
  </StrictMode>,
)
