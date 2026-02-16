import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import './index.css';
import './styles/app.css';
import App from './App.jsx'
import { ThemeProvider } from './contexts/ThemeContext.jsx'
import { ChatThemeProvider } from './contexts/ChatThemeContext.jsx'
import { EmojiStyleProvider } from './contexts/EmojiStyleContext.jsx'
import { SupabaseProvider } from './contexts/SupabaseContext.jsx'
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx'
import { CallProvider } from './context/CallContext.jsx' // Import CallProvider
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

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
    <HashRouter>
      <QueryClientProvider client={queryClient}>
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
      </QueryClientProvider>
    </HashRouter>
)
