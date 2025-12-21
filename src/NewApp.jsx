import { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/NewAuthContext';
import { CallProvider } from './context/CallContext';
import { ChatThemeProvider } from './contexts/ChatThemeContext';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { Capacitor } from '@capacitor/core';
import { Toaster } from 'react-hot-toast';

// Lazy load components
const Login = lazy(() => import('./components/auth/Login'));
const Signup = lazy(() => import('./components/auth/Signup'));
const ForgotPassword = lazy(() => import('./components/auth/ForgotPassword'));
const ResetPassword = lazy(() => import('./components/auth/ResetPassword'));
const Home = lazy(() => import('./components/Home'));
const Chat = lazy(() => import('./components/chat/Chat'));
const Profile = lazy(() => import('./components/profile'));
const Settings = lazy(() => import('./components/settings'));
const News = lazy(() => import('./components/news'));
const Reminders = lazy(() => import('./components/reminders'));
const CreateReminder = lazy(() => import('./components/reminders/CreateReminder'));
const Calls = lazy(() => import('./components/calls'));
const Blocked = lazy(() => import('./components/blocked'));
const UserDetails = lazy(() => import('./components/UserDetails'));
const SharedProfile = lazy(() => import('./components/shared-profile'));
const About = lazy(() => import('./components/About'));
const SupportChat = lazy(() => import('./components/SupportChat'));
const Admin = lazy(() => import('./components/Admin'));
const QRPage = lazy(() => import('./components/qr'));
const Intro = lazy(() => import('./components/Intro'));
const CallScreen = lazy(() => import('./components/CallScreen'));
const CallStatusIndicator = lazy(() => import('./components/CallStatusIndicator'));
const IncomingCallModal = lazy(() => import('./components/IncomingCallModal'));
const MessagingLoader = lazy(() => import('./components/MessagingLoader'));
const AuthDebug = lazy(() => import('./components/AuthDebug'));

// Initialize Capacitor Updater
if (Capacitor.isNativePlatform()) {
  CapacitorUpdater.notifyAppReady();
}

const AppContent = () => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  // Handle deep linking for OAuth callbacks
  useEffect(() => {
    const { search } = window.location;
    if (search.startsWith('?/')) {
      const path = search.slice(2).replace(/~and~/g, '&');
      window.history.replaceState(null, '', path);
    }
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={
        <PublicRoute>
          <Login />
        </PublicRoute>
      } />
      <Route path="/signup" element={
        <PublicRoute>
          <Signup />
        </PublicRoute>
      } />
      <Route path="/forgot-password" element={
        <PublicRoute>
          <ForgotPassword />
        </PublicRoute>
      } />
      <Route path="/reset-password" element={
        <PublicRoute>
          <ResetPassword />
        </PublicRoute>
      } />
      <Route path="/intro" element={
        <PublicRoute>
          <Intro />
        </PublicRoute>
      } />

      {/* Protected routes */}
      <Route path="/" element={
        <ProtectedRoute>
          <Home />
        </ProtectedRoute>
      } />
      <Route path="/chat/:chatId?" element={
        <ProtectedRoute>
          <Chat />
        </ProtectedRoute>
      } />
      <Route path="/profile" element={
        <ProtectedRoute>
          <Profile />
        </ProtectedRoute>
      } />
      <Route path="/settings" element={
        <ProtectedRoute>
          <Settings />
        </ProtectedRoute>
      } />
      {/* Add other protected routes */}

      {/* 404 route */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const PublicRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (isAuthenticated) {
    // Redirect to the home page or the original intended page
    const from = location.state?.from?.pathname || '/';
    return <Navigate to={from} replace />;
  }

  return children;
};

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    // Redirect to login page with the current location to return to after login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

const App = () => {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    }>
      <AuthProvider>
        <ChatThemeProvider>
          <CallProvider>
            <AppContent />
            <Toaster position="bottom-right" />
          </CallProvider>
        </ChatThemeProvider>
      </AuthProvider>
    </Suspense>
  );
};

export default App;
