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

// AuthenticatedApp is the heavy one — only loaded when user is logged in
// AuthenticatedApp is the heavy one — only loaded when user is logged in
const AuthenticatedApp = lazy(() => import('./AuthenticatedApp'));
const SharedProfile = lazy(() => import('./components/shared-profile'));

const RoomRedirect = () => {
  const { roomId } = useParams();
  return <Navigate to={`/chat/${roomId}/arena`} replace />;
};

const PublicApp = () => {
  const { isAuthenticated, loading } = useAuth();
  const { needsRefresh, handleRefresh, handleDismiss, isRefreshing } = useAutoRefresh();
  const location = useLocation();
  useOnlineStatus();

  // Handle deep linking for OAuth callbacks
  useEffect(() => {
    const { search } = window.location;
    if (search.startsWith('?/')) {
      const path = search.slice(2).replace(/~and~/g, '&');
      window.history.replaceState(null, '', path);
    }
  }, []);

  useEffect(() => {
    SafeAreaDetector.getInstance();
    KeyboardHandler.getInstance();

    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isAndroid = /Android/i.test(navigator.userAgent);
    const platform = isIOS ? 'ios' : (isAndroid ? 'android' : 'web');
    document.body.classList.add(`platform-${platform}`);

    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone ||
      document.referrer.includes('android-app://');
    document.documentElement.setAttribute('data-standalone', isStandalone ? 'true' : 'false');

    const updateAppHeight = () => {
      document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
    };
    updateAppHeight();
    window.addEventListener('resize', updateAppHeight);

    if (isIOS) document.body.style.overscrollBehavior = 'none';

    initializePushNotifications();
    requestPersistentStorage();
    FileCache.init();

    return () => window.removeEventListener('resize', updateAppHeight);
  }, []);

  // Show nothing while auth state is being determined
  if (loading) return null;

  // Native App: Redirect unauthenticated users to login
  const isNative = Capacitor.isNativePlatform();
  if (!isAuthenticated && isNative && location.pathname === '/') {
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