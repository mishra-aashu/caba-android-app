import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import './index.css'
import './styles/global.css'
import './styles/desktop.css'
import './styles/home.css'
import './styles/whatsapp.css'
import './styles/whatsapp-quick-reference.css'
import App from './App.jsx'
import { ThemeProvider } from './contexts/ThemeContext.jsx'
import { ChatThemeProvider } from './contexts/ChatThemeContext.jsx'
import { SupabaseProvider } from './contexts/SupabaseContext.jsx'
import { AuthProvider } from './contexts/AuthContext.jsx'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HashRouter>
      <SupabaseProvider>
        <AuthProvider>
          <ThemeProvider>
            <ChatThemeProvider>
              <QueryClientProvider client={queryClient}>
                <App />
              </QueryClientProvider>
            </ChatThemeProvider>
          </ThemeProvider>
        </AuthProvider>
      </SupabaseProvider>
    </HashRouter>
  </StrictMode>,
)
