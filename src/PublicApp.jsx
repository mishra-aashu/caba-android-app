/**
 * PublicApp.jsx
 *
 * Entry point loaded by main.jsx.
 * Handles the split between:
 *   - Public routes (Landing, Login, Terms, etc.) → lightweight
 *   - AuthenticatedApp → heavy, lazy-loaded only when user is logged in
 */

import { Suspense, lazy, useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { isNativeWithPlugins } from './utils/platformCheck';
import { Capacitor } from '@capacitor/core';
import { useAutoRefresh } from './hooks/useAutoRefresh';
import AutoRefreshBanner from './components/common/AutoRefreshBanner';
import { Toaster } from 'react-hot-toast';
import useOnlineStatus from './hooks/useOnlineStatus';
import useIsDesktop from './hooks/useIsDesktop';
import ErrorBoundary from './components/common/ErrorBoundary';
import { DialogProvider } from './contexts/DialogProvider';
import GlobalDialog from './components/common/GlobalDialog';
import usePlatformInit from './hooks/usePlatformInit';
import Intro from './components/Intro';

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
const SharedProfile = lazy(() => import('./components/shared-profile'));

// AuthenticatedApp is the heavy one — only loaded when user is logged in
const AuthenticatedApp = lazy(() => import('./AuthenticatedApp'));



const PublicApp = () => {
  const { isAuthenticated, loading } = useAuth();
  const { needsRefresh, handleRefresh, handleDismiss, isRefreshing } = useAutoRefresh();
  const location = useLocation();
  const isDesktop = useIsDesktop();
  const [splashFinished, setSplashFinished] = useState(false);
  
  useOnlineStatus();
  usePlatformInit();

  // ═══ Hide native splash screen after app renders ═══
  useEffect(() => {
    if (loading) return;
    
    const hideSplash = async () => {
      if (!isNativeWithPlugins()) return;
      try {
        const { SplashScreen } = await import('@capacitor/splash-screen');
        await new Promise(r => setTimeout(r, 400));
        await SplashScreen.hide({ fadeOutDuration: 400 });
      } catch (e) {
        console.warn('[Splash] Hide failed:', e.message);
      }
    };
    hideSplash();
  }, [loading]);

  const isNative = Capacitor.isNativePlatform();

  // 1. DESKTOP CINEMATIC INTRO (Buffered Loading)
  // plays ONLY on desktop for first-time launch.
  // We show it IMMEDIATELY without waiting for auth loading.
  if (isDesktop && !splashFinished) {
    return (
      <div className="launch-container" style={{ background: '#000000', height: '100vh', width: '100vw' }}>
        <Intro onComplete={() => setSplashFinished(true)} />
        {/* Render AuthenticatedApp hidden in background so it can WARM UP during intro */}
        {isAuthenticated && (
          <div style={{ display: 'none' }} aria-hidden="true">
             <Suspense fallback={null}>
               <AuthenticatedApp />
             </Suspense>
          </div>
        )}
      </div>
    );
  }

  // 2. MOBILE NATIVE: Direct redirect to login for unauthenticated users
  if (!isAuthenticated && !loading && isNative && location.pathname === '/') {
    return <Navigate to="/login" replace />;
  }

  // 3. INITIALIZING LOADER (Safety fallback)
  if (loading) {
    return (
      <div className="premium-loader-overlay" style={{ background: '#0b141a' }}>
        <div className="premium-loader-container">
          <div className="premium-spinner"></div>
          <p className="premium-loader-text">Initializing...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Suspense fallback={<div className="loading" />}>
        {isAuthenticated ? (
          <AuthenticatedApp />
        ) : (
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

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
              <GlobalDialog />
            </DialogProvider>
          </ErrorBoundary>
        )}
      </Suspense>

      <AutoRefreshBanner
        needsRefresh={needsRefresh}
        isRefreshing={isRefreshing}
        handleRefresh={handleRefresh}
        handleDismiss={handleDismiss}
      />

      <Toaster 
        position="top-center" 
        toastOptions={{ 
          duration: 3500,
          className: 'premium-toast',
          success: {
            className: 'premium-toast premium-toast-success',
            iconTheme: { primary: '#00a884', secondary: '#fff' }
          },
          error: {
            className: 'premium-toast premium-toast-error',
            iconTheme: { primary: '#e53935', secondary: '#fff' }
          }
        }} 
      />
    </>
  );
};

export default PublicApp;