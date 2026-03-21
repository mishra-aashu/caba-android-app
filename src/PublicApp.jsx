/**
 * PublicApp.jsx
 *
 * Entry point loaded by main.jsx.
 * Handles the split between:
 *   - Public routes (Landing, Login, Terms, etc.) → lightweight
 *   - AuthenticatedApp → heavy, lazy-loaded only when user is logged in
 *
 * AutoRefreshBanner is rendered HERE (outside authenticated shell)
 * so update detection works even on public pages.
 */

import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { isNativeWithPlugins } from './utils/platformCheck';
import { Capacitor } from '@capacitor/core';
import { useAutoRefresh } from './hooks/useAutoRefresh';
import AutoRefreshBanner from './components/common/AutoRefreshBanner';
import { Toaster } from 'react-hot-toast';
import { useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { SafeAreaDetector } from './utils/safeAreaDetector';
import { KeyboardHandler } from './utils/keyboardHandler';
import { initializePushNotifications } from './utils/PushNotifications';
import { requestPersistentStorage } from './db/db';
import { FileCache } from './utils/FileCache';
import useOnlineStatus from './hooks/useOnlineStatus';
import useIsDesktop from './hooks/useIsDesktop';
import ErrorBoundary from './components/common/ErrorBoundary';
import { DialogProvider } from './contexts/DialogProvider';
import GlobalDialog from './components/common/GlobalDialog';

import './styles/loaders.css';
import './styles/safeArea.css';

// Public components (relatively lightweight)
const LandingPage = lazy(() => import('./pages/LandingPage'));
const Login = lazy(() => import('./components/auth/Login'));
const DownloadAPK = lazy(() => import('./pages/DownloadAPK'));
const Terms = lazy(() => import('./components/legal/Terms'));
const Privacy = lazy(() => import('./components/legal/Privacy'));
const About = lazy(() => import('./components/About'));
const AdminAbout = lazy(() => import('./components/admin/AdminAbout'));
const Intro = lazy(() => import('./components/Intro'));

// AuthenticatedApp is the heavy one — only loaded when user is logged in
// AuthenticatedApp is the heavy one — only loaded when user is logged in
const AuthenticatedApp = lazy(() => import('./AuthenticatedApp'));
const SharedProfile = lazy(() => import('./components/shared-profile'));

const RoomRedirect = () => {
  const { roomId } = useParams();
  return <Navigate to={`/chat/${roomId}/arena`} replace />;
};

import usePlatformInit from './hooks/usePlatformInit';

const PublicApp = () => {
  const { isAuthenticated, loading } = useAuth();
  const { needsRefresh, handleRefresh, handleDismiss, isRefreshing } = useAutoRefresh();
  const location = useLocation();
  const isDesktop = useIsDesktop();
  const [splashFinished, setSplashFinished] = useState(false);
  
  useOnlineStatus();
  usePlatformInit(); // ✅ Consolidated platform initialization

  // Handle deep linking for OAuth callbacks

  // ═══ NEW: Hide splash screen after app renders ═══
  useEffect(() => {
    if (loading) return;
    
    const hideSplash = async () => {
      if (!isNativeWithPlugins()) return;
      try {
        const { SplashScreen } = await import('@capacitor/splash-screen');
        // Small delay to ensure first paint is complete
        await new Promise(r => setTimeout(r, 400));
        await SplashScreen.hide({ fadeOutDuration: 400 });
        console.log('[Splash] Hidden after PublicApp render');
      } catch (e) {
        console.warn('[Splash] Hide failed:', e.message);
      }
    };
    hideSplash();
  }, [loading]);

  // 🔥 IMMEDIATE INTRO ON DESKTOP
  // This plays while auth is initializing in the background.
  if (!splashFinished && isDesktop) {
    return (
      <Suspense fallback={<div className="loading" />}>
        <Intro onComplete={() => setSplashFinished(true)} />
      </Suspense>
    );
  }

  // Show a themed loader while auth state is being determined
  // This prevents the "white flash" when React mounts but loading is still true.
  if (loading) {
    return (
      <div className="premium-loader-overlay" style={{ background: '#1a1a2e' }}>
        <div className="premium-loader-container">
          <div className="premium-spinner"></div>
          <p className="premium-loader-text">Initializing...</p>
        </div>
      </div>
    );
  }

  // Native App: Redirect unauthenticated users to login
  // Using Capacitor.isNativePlatform() directly here because it's safe on Vercel origin 
  if (!isAuthenticated && Capacitor.isNativePlatform() && location.pathname === '/') {
    return <Navigate to="/login" replace />;
  }

  return (
    <>
      <Suspense fallback={<div className="loading" />}>
        {isAuthenticated ? (
          // Heavy authenticated shell — lazy-loaded
          <AuthenticatedApp />
        ) : (
          // Lightweight public routes
          <ErrorBoundary>
            <DialogProvider>
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<Login />} />
                <Route path="/download-apk" element={<DownloadAPK />} />
                <Route path="/terms" element={<div className="legal-page-wrapper"><Terms /></div>} />
                <Route path="/privacy" element={<div className="legal-page-wrapper"><Privacy /></div>} />
                <Route path="/about" element={<About />} />
                <Route path="/admin-about" element={<AdminAbout />} />
                <Route path="/shared-profile/:userId" element={<SharedProfile />} />
                <Route path="/room/:roomId" element={<RoomRedirect />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
              <GlobalDialog />
            </DialogProvider>
          </ErrorBoundary>
        )}
      </Suspense>

      {/* Update banner — always visible regardless of auth state */}
      <AutoRefreshBanner
        needsRefresh={needsRefresh}
        isRefreshing={isRefreshing}
        handleRefresh={handleRefresh}
        handleDismiss={handleDismiss}
      />

      <Toaster
        position="bottom-center"
        toastOptions={{
          duration: 3500,
          className: 'premium-toast',
          success: {
            className: 'premium-toast premium-toast-success',
            iconTheme: {
              primary: 'var(--brand-primary)',
              secondary: '#fff',
            },
          },
          error: {
            className: 'premium-toast premium-toast-error',
            iconTheme: {
              primary: 'var(--error-color)',
              secondary: '#fff',
            },
          },
          loading: {
            className: 'premium-toast premium-toast-loading',
          },
          style: {
            background: 'transparent',
            boxShadow: 'none',
            border: 'none',
          },
        }}
        containerStyle={{
          bottom: 'calc(75px + var(--sab, 0px))',
        }}
      />
    </>
  );
};

export default PublicApp;