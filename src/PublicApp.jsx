import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { Capacitor } from '@capacitor/core';
import { useAutoRefresh } from './hooks/useAutoRefresh';
import AutoRefreshBanner from './components/common/AutoRefreshBanner';
import './styles/loaders.css';

// Public components are relative lightweight
const LandingPage = lazy(() => import('./pages/LandingPage'));
const Login = lazy(() => import('./components/auth/Login'));
const DownloadAPK = lazy(() => import('./pages/DownloadAPK'));
const Terms = lazy(() => import('./components/legal/Terms'));
const Privacy = lazy(() => import('./components/legal/Privacy'));
const About = lazy(() => import('./components/About'));

// AuthenticatedApp is the heavy one
const AuthenticatedApp = lazy(() => import('./AuthenticatedApp'));

const PublicApp = () => {
  const { isAuthenticated, loading } = useAuth();
  const { needsRefresh, handleRefresh, handleDismiss, isRefreshing } = useAutoRefresh();
  const location = useLocation();

  if (loading) return <div className="loading-screen" />;

  // Native App: Direct redirect for unauthenticated users
  const isNative = Capacitor.isNativePlatform();
  if (!isAuthenticated && isNative && location.pathname === '/') {
    return <Navigate to="/login" replace />;
  }

  return (
    <>
      <Suspense fallback={<div className="loading" />}>
        {isAuthenticated ? (
          <AuthenticatedApp />
        ) : (
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
