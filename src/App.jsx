import { Suspense, lazy, useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth'; // Use the main auth hook
// import { CallProvider } from './contexts/CallContext';
import { ChatThemeProvider } from './contexts/ChatThemeProvider';
import { DataProvider } from './contexts/DataProvider';
import { GroupCallProvider } from './contexts/GroupCallProvider';
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
const LandingPage = lazy(() => import('./pages/LandingPage'));
const DownloadAPK = lazy(() => import('./pages/DownloadAPK'));
import Intro from './components/Intro';
const GroupsPage = lazy(() => import('./components/groups/GroupsPage'));
const GroupChat = lazy(() => import('./components/chat/GroupChat'));
const GroupInfoPage = lazy(() => import('./components/groups/GroupInfoPage'));
const ContactsPage = lazy(() => import('./components/contacts/ContactsPage'));
const ArenaPage = lazy(() => import('./components/chat/ArenaPage'));
const CallScreen = lazy(() => import('./components/CallScreen'));
// import CallScreen from './components/CallScreen';
const CallStatusIndicator = lazy(() => import('./components/CallStatusIndicator'));
const IncomingCallModal = lazy(() => import('./components/IncomingCallModal'));
const GroupIncomingCallNotification = lazy(() => import('./components/group/GroupIncomingCallNotification'));
import DesktopNavbar from './components/common/DesktopNavbar';
import Modal from './components/common/Modal';
import useIsDesktop from './hooks/useIsDesktop';
// AuthDebug is intentionally not imported or rendered
import { initializePushNotifications } from './utils/PushNotifications';
import useOnlineStatus from './hooks/useOnlineStatus';
import OfflineIndicator from './components/common/OfflineIndicator';
import ViewportManager from './components/layout/ViewportManager';
import MainLayout from './components/MainLayout';
const Chat = lazy(() => import('./components/chat/Chat'));
const SharedMediaGallery = lazy(() => import('./components/chat/SharedMediaGallery'));
import PwaUpdater from './components/pwa/PwaUpdater';
import useNetworkSync from './hooks/useNetworkSync';
import { requestPersistentStorage } from './db/db';
import { DialogProvider } from './contexts/DialogProvider';
import { useCapacitorPlugins } from './hooks/useCapacitorPlugins';
import GlobalDialog from './components/common/GlobalDialog';
import './styles/offline-indicator.css';
import './styles/emoji-styles.css';
import SyncIndicator from './components/common/SyncIndicator';


const AppContent = () => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();
  const isDesktop = useIsDesktop();
  const [splashFinished, setSplashFinished] = useState(false);
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
    return null; // Keep it silent during initial auth check
  }

  if (isAuthenticated && !splashFinished) {
    return <Intro onComplete={() => setSplashFinished(true)} />;
  }

  // 📱 Native App Optimization: Direct redirect to login for unauthenticated users
  // This avoids showing the LandingPage on mobile apps.
  const isNative = Capacitor.isNativePlatform();
  if (!isAuthenticated && isNative && location.pathname === '/') {
    return <Navigate to="/login" replace />;
  }

  return (
    <>
      <Routes>
        <Route path="/download-apk" element={<PublicRoute><DownloadAPK /></PublicRoute>} />
        {/* Public routes */}
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />
        <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
        <Route path="/reset-password" element={<PublicRoute><ResetPassword /></PublicRoute>} />
        <Route path="/shared-profile/:userId" element={<SharedProfile />} />
        <Route path="/terms" element={<div className="legal-page-wrapper"><Terms /></div>} />
        <Route path="/privacy" element={<div className="legal-page-wrapper"><Privacy /></div>} />
        <Route path="/about" element={<About />} />

        {/* Arena Route - Independent of MainLayout sidebar */}
        <Route path="/chat/:chatId/:otherUserId/arena" element={<ProtectedRoute><ArenaPage /></ProtectedRoute>} />

        <Route path="/" element={isAuthenticated ? <ProtectedRoute><MainLayout /></ProtectedRoute> : <LandingPage />}>
          <Route index element={<ChatPlaceholder />} />
          {/* Group chat route - uses dedicated GroupChat component */}
          <Route path="chat/:chatId/group" element={<GroupChat key={location.pathname} />} />
          <Route path="chat/:chatId/group/media" element={<SharedMediaGallery />} />
          {/* Direct chat route - uses wildcard :otherUserId */}
          <Route path="chat/:chatId/:otherUserId" element={<Chat key={location.pathname} />} />
          <Route path="chat/:chatId/:otherUserId/media" element={<SharedMediaGallery />} />
          <Route path="user-details/:id" element={<UserDetails />} />
          <Route path="groups" element={<GroupsPage />} />
          <Route path="contacts" element={<ContactsPage isDesktop={isDesktop} />} />
          <Route path="profile" element={<Profile isSidebar={isDesktop} />} />
        </Route>
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
    </>
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
  const isDesktop = useIsDesktop();
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
          {isDesktop && <DesktopNavbar />}
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
        {isDesktop && <DesktopNavbar />}
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
  const { dbUser } = useAuth(); // Get dbUser from auth hook

  // 🔌 Native device integrations: StatusBar color + Keyboard resize mode
  useCapacitorPlugins();

  useEffect(() => {
    // App khulte hi notification system start karo
    initializePushNotifications();
    // Request persistent storage for IndexedDB
    requestPersistentStorage();
  }, []);

  // Initialize offline sync monitor
  useNetworkSync();

  return (
    <Suspense fallback={<div className="loading" />}>
      {/* AuthProvider is provided in main.jsx */}
      {/* AuthProvider is provided in main.jsx */}
      {/* SupabaseProvider is provided in main.jsx */}
      {/* ThemeProvider is provided in main.jsx */}
      <PwaUpdater />
      <ErrorBoundary>
        <DialogProvider>
          <DataProvider>
            <GroupCallProvider currentUser={dbUser}>
              <ChatThemeProvider>
                {/* Universal Layout Logic */}
                <ViewportManager />
                {/* Offline Indicator - Shows network status to users */}
                <OfflineIndicator>
                  <AppContent />
                </OfflineIndicator>
                {/* Global Components */}
                <CallStatusIndicator />
                <IncomingCallModal />
                <GroupIncomingCallNotification />
                <SyncIndicator />
                <Toaster
                  position="bottom"
                  containerStyle={{
                    left: '62%',
                    top: '70%',
                    transform: 'translate(-50%, -50%)'
                  }} />
                <GlobalDialog />
              </ChatThemeProvider>
            </GroupCallProvider>
          </DataProvider>
        </DialogProvider>
      </ErrorBoundary>
    </Suspense>
  );
};

export default App;
