import { Suspense, lazy, useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth'; // Use the main auth hook
// import { CallProvider } from './context/CallContext';
import { ChatThemeProvider } from './contexts/ChatThemeContext';
import { DataProvider } from './contexts/DataContext';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { Capacitor } from '@capacitor/core';
import { Toaster } from 'react-hot-toast';
import PhoneAuthModal from './components/auth/PhoneAuthModal';
import { supabase } from './config/supabase';
import useAuthStore from './store/authStore';
import ErrorBoundary from './components/common/ErrorBoundary';
import '../src/styles/desktop.css';
import '../src/styles/call-screen.css';

// Lazy load components
const Login = lazy(() => import('./components/auth/Login'));
const Signup = lazy(() => import('./components/auth/Signup'));
const ForgotPassword = lazy(() => import('./components/auth/ForgotPassword'));
const ResetPassword = lazy(() => import('./components/auth/ResetPassword'));
const MainLayout = lazy(() => import('./components/MainLayout'));
const Chat = lazy(() => import('./components/chat/Chat'));
const ChatPlaceholder = lazy(() => import('./components/common/ChatPlaceholder'));
const Terms = lazy(() => import('./components/legal/Terms'));
const Privacy = lazy(() => import('./components/legal/Privacy'));
const Profile = lazy(() => import('./components/profile/Profile'));
const Settings = lazy(() => import('./components/settings'));
const EmojiSettings = lazy(() => import('./components/settings/EmojiSettings'));

const Reminders = lazy(() => import('./components/reminders'));
const CreateReminder = lazy(() => import('./components/reminders/CreateReminder'));
const Calls = lazy(() => import('./components/calls'));
const History = lazy(() => import('./components/History'));
const Blocked = lazy(() => import('./components/blocked'));
const UserDetails = lazy(() => import('./components/UserDetails'));
const SharedProfile = lazy(() => import('./components/shared-profile'));
const About = lazy(() => import('./components/About'));
const SupportChat = lazy(() => import('./components/SupportChat'));
const Admin = lazy(() => import('./components/Admin'));
const AdminAbout = lazy(() => import('./components/admin/AdminAbout'));
const QRPage = lazy(() => import('./components/qr'));
const Intro = lazy(() => import('./components/Intro'));
const GroupsPage = lazy(() => import('./components/groups/GroupsPage'));
const CallScreen = lazy(() => import('./components/CallScreen'));
// import CallScreen from './components/CallScreen';
const CallStatusIndicator = lazy(() => import('./components/CallStatusIndicator'));
const IncomingCallModal = lazy(() => import('./components/IncomingCallModal'));
import DesktopNavbar from './components/common/DesktopNavbar';
import Modal from './components/common/Modal';
import useIsDesktop from './hooks/useIsDesktop';
// AuthDebug is intentionally not imported or rendered

import { initializePushNotifications } from './utils/PushNotifications';
import useOnlineStatus from './hooks/useOnlineStatus';
import OfflineIndicator from './components/common/OfflineIndicator';
import './styles/offline-indicator.css';

// Initialize Capacitor Updater
if (Capacitor.isNativePlatform()) {
  CapacitorUpdater.notifyAppReady();
}

const AppContent = () => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();
  const isDesktop = useIsDesktop();
  useOnlineStatus(); // Initialize online status tracking

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
      <div className="loading">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />
      <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
      <Route path="/reset-password" element={<PublicRoute><ResetPassword /></PublicRoute>} />
      <Route path="/intro" element={<PublicRoute><Intro /></PublicRoute>} />
      <Route path="/shared-profile/:userId" element={<SharedProfile />} />
      <Route path="/terms" element={<div className="legal-page-wrapper"><Terms /></div>} />
      <Route path="/privacy" element={<div className="legal-page-wrapper"><Privacy /></div>} />
      <Route path="/about" element={<PublicRoute><About /></PublicRoute>} />

      {/* Protected routes */}
      <Route path="/" element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
        <Route index element={<ChatPlaceholder />} />
        <Route path="chat/:chatId/:otherUserId" element={<Chat />} />
        {/* Group chat route - uses same Chat component but detects group */}
        <Route path="chat/:chatId/group" element={<Chat />} />
        <Route path="user-details/:id" element={<UserDetails />} />
        <Route path="groups" element={<GroupsPage />} />
      </Route>

      <Route path="/profile" element={<ProtectedRoute>{isDesktop ? <Modal isOpen={true} onClose={() => window.location.href = '/'} className='sidebar-modal'><Profile isModal={true} /></Modal> : <Profile />}</ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      <Route path="/emoji-settings" element={<ProtectedRoute><EmojiSettings /></ProtectedRoute>} />

      <Route path="/reminders" element={<ProtectedRoute><Reminders /></ProtectedRoute>} />
      <Route path="/create-reminder" element={<ProtectedRoute><CreateReminder /></ProtectedRoute>} />
      <Route path="/calls" element={<ProtectedRoute><Calls /></ProtectedRoute>} />
      <Route path="/history" element={<ProtectedRoute><History /></ProtectedRoute>} />
      <Route path="/qr" element={<ProtectedRoute><QRPage /></ProtectedRoute>} />
      <Route path="/blocked" element={<ProtectedRoute><Blocked /></ProtectedRoute>} />
      <Route path="/support" element={<ProtectedRoute><SupportChat /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
      <Route path="/admin-about" element={<div className="legal-page-wrapper"><AdminAbout /></div>} />
      <Route path="/call/:callId" element={<ProtectedRoute><CallScreen /></ProtectedRoute>} />

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
  const { isAuthenticated, dbUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [showPhoneAuth, setShowPhoneAuth] = useState(false);
  const [showPhoneCollect, setShowPhoneCollect] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setShowPhoneAuth(true);
      setShowPhoneCollect(false);
    } else {
      setShowPhoneAuth(false);
      setShowPhoneCollect(dbUser && (!dbUser.phone || dbUser.phone === ''));
    }
  }, [isAuthenticated, dbUser]);

  const handleAuthSuccess = (user) => {
    // Auth state will update automatically
    setShowPhoneAuth(false);
  };

  const handleCollectSuccess = async ({ phone, name }) => {
    try {
      const { data: updatedUser, error } = await supabase
        .from('users')
        .update({ phone, name })
        .eq('id', dbUser.id)
        .select()
        .single();
      if (error) throw error;
      // Update dbUser in store
      useAuthStore.setState({ dbUser: updatedUser });
      setShowPhoneCollect(false);
    } catch (error) {
      console.error('Error updating user:', error);
    }
  };

  if (!isAuthenticated) {
    return (
      <>
        <div className="app-layout">
          <DesktopNavbar />
          <main className="app-content">
            {children}
          </main>
        </div>
        <PhoneAuthModal
          isOpen={showPhoneAuth}
          onClose={() => setShowPhoneAuth(false)}
          onAuthSuccess={handleAuthSuccess}
          onBackToLogin={() => { setShowPhoneAuth(false); navigate('/login'); }}
        />
      </>
    );
  }

  return (
    <>
      <div className="app-layout">
        <DesktopNavbar />
        <main className="app-content">
          {children}
        </main>
      </div>
      <PhoneAuthModal
        isOpen={showPhoneCollect}
        onClose={() => setShowPhoneCollect(false)}
        mode="collect"
        onCollectSuccess={handleCollectSuccess}
      />
    </>
  );
};

const App = () => {
  useEffect(() => {
    // App khulte hi notification system start karo
    initializePushNotifications();
  }, []);

  return (
    <Suspense fallback={
      <div className="loading">
        <div className="loading-spinner"></div>
      </div>
    }>
      {/* AuthProvider is provided in main.jsx */}
      {/* SupabaseProvider is provided in main.jsx */}
      {/* ThemeProvider is provided in main.jsx */}
      <ErrorBoundary>
        <DataProvider>
          <ChatThemeProvider>
            {/* 🎯 Offline Indicator - Shows network status to users */}
            <OfflineIndicator>
              <AppContent />
            </OfflineIndicator>
            {/* Global Components */}
            <CallStatusIndicator />
            <IncomingCallModal />
            <Toaster
              position="bottom"
              containerStyle={{
                left: '62%',
                top: '70%',
                transform: 'translate(-50%, -50%)'
              }} />
          </ChatThemeProvider>
        </DataProvider>
      </ErrorBoundary>
    </Suspense>
  );
};

export default App;
