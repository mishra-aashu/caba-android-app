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
import './styles/loaders.css';

// Public components (relatively lightweight)
const LandingPage = lazy(() => import('./pages/LandingPage'));
const Login = lazy(() => import('./components/auth/Login'));
const DownloadAPK = lazy(() => import('./pages/DownloadAPK'));
const Terms = lazy(() => import('./components/legal/Terms'));
const Privacy = lazy(() => import('./components/legal/Privacy'));
const About = lazy(() => import('./components/About'));

// AuthenticatedApp is the heavy one — only loaded when user is logged in
const AuthenticatedApp = lazy(() => import('./AuthenticatedApp'));

const PublicApp = () => {
  const { isAuthenticated, loading } = useAuth();
  const { needsRefresh, handleRefresh, handleDismiss, isRefreshing } = useAutoRefresh();
  const location = useLocation();

  // Show nothing while auth state is being determined
  if (loading) return <div className="loading-screen" />;

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
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/download-apk" element={<DownloadAPK />} />
            <Route path="/terms" element={<div className="legal-page-wrapper"><Terms /></div>} />
            <Route path="/privacy" element={<div className="legal-page-wrapper"><Privacy /></div>} />
            <Route path="/about" element={<About />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        )}
      </Suspense>

      {/* Update banner — always visible regardless of auth state */}
      <AutoRefreshBanner
        needsRefresh={needsRefresh}
        isRefreshing={isRefreshing}
        handleRefresh={handleRefresh}
        handleDismiss={handleDismiss}
      />
    </>
  );
};

export default PublicApp;