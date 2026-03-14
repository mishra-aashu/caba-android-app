import { Suspense, lazy, useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, RefreshCw } from 'lucide-react';
import { useAuth } from './hooks/useAuth';
import { ChatThemeProvider } from './contexts/ChatThemeProvider';
import { GroupCallProvider } from './contexts/GroupCallProvider';
import { Capacitor } from '@capacitor/core';
import { Toaster } from 'react-hot-toast';
import PhoneAuthModal from './components/auth/PhoneAuthModal';
import { supabase } from './config/supabase';
import useAuthStore from './store/authStore';
import ErrorBoundary from './components/common/ErrorBoundary';
import useIsDesktop from './hooks/useIsDesktop';
import { SafeAreaDetector } from './utils/safeAreaDetector';
import { KeyboardHandler } from './utils/keyboardHandler';
import SafeAreaDebugger from './components/common/SafeAreaDebugger';
import { initializePushNotifications } from './utils/PushNotifications';
import useOnlineStatus from './hooks/useOnlineStatus';
import MainLayout from './components/MainLayout';
import useNetworkSync from './hooks/useNetworkSync';
import { useAutoRefresh } from './hooks/useAutoRefresh';
import { requestPersistentStorage } from './db/db';
import { DialogProvider } from './contexts/DialogProvider';
import { useCapacitorPlugins } from './hooks/useCapacitorPlugins';
import GlobalDialog from './components/common/GlobalDialog';
import { FileCache } from './utils/FileCache';

// CSS Imports
import '../src/styles/desktop.css';
import '../src/styles/call-screen.css';
import './styles/offline-indicator.css';
import './styles/emoji-styles.css';
import './styles/safeArea.css';

// Static Imports for Core Components (to resolve build warnings)
import Login from './components/auth/Login';
import LandingPage from './pages/LandingPage';
import DownloadAPK from './pages/DownloadAPK';
import Intro from './components/Intro';
import { GroupsPage, GroupInfoPage } from './components/groups';
import GroupChat from './components/chat/GroupChat';
import ContactsPage from './components/contacts/ContactsPage';
import ArenaPage from './components/chat/ArenaPage';
import CallScreen from './components/CallScreen';
import CallStatusIndicator from './components/CallStatusIndicator';
import IncomingCallModal from './components/IncomingCallModal';
import GroupIncomingCallNotification from './components/group/GroupIncomingCallNotification';
import ChatPlaceholder from './components/common/ChatPlaceholder';
import Profile from './components/profile/Profile';
import UserDetails from './components/UserDetails';
import Settings from './components/settings';
import EmojiSettings from './components/settings/EmojiSettings';
import Reminders from './components/reminders';
import CreateReminder from './components/reminders/CreateReminder';
import Calls from './components/calls';
import History from './components/History';
import Blocked from './components/blocked';
import About from './components/About';
import SupportChat from './components/SupportChat';
import { QRPage } from './components/qr';
import DesktopNavbar from './components/common/DesktopNavbar';
import Modal from './components/common/Modal';
import OfflineIndicator from './components/common/OfflineIndicator';
import SyncIndicator from './components/common/SyncIndicator';
import Terms from './components/legal/Terms';
import Privacy from './components/legal/Privacy';
import SharedProfile from './components/shared-profile';
import APKUpdateModal from './components/APKUpdateModal';
import SecuritySettings from './components/settings/SecuritySettings';
import HelpCenter from './components/settings/HelpCenter';

// Lazy load truly non-critical/heavy components that are NOT statically imported elsewhere
const Chat = lazy(() => import('./components/chat/Chat'));
const SharedMediaGallery = lazy(() => import('./components/chat/SharedMediaGallery'));
const Admin = lazy(() => import('./components/Admin'));
const AdminAbout = lazy(() => import('./components/admin/AdminAbout'));


// ──────────────────────────────────────────────
// AppContent
// ──────────────────────────────────────────────
const AppContent = () => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();
  const isDesktop = useIsDesktop();
  const [splashFinished, setSplashFinished] = useState(false);
  useOnlineStatus();

  // Handle deep linking for OAuth callbacks
  useEffect(() => {
    const { search } = window.location;
    if (search.startsWith('?/')) {
      const path = search.slice(2).replace(/~and~/g, '&');
      window.history.replaceState(null, '', path);
    }
  }, []);

  if (loading) {
    return null;
  }

  if (isAuthenticated && !splashFinished && isDesktop) {
    return <Intro onComplete={() => setSplashFinished(true)} />;
  }

  // Native App: Direct redirect for unauthenticated users
  const isNative = Capacitor.isNativePlatform();
  if (!isAuthenticated && isNative && location.pathname === '/') {
    return <Navigate to="/login" replace />;
  }

  return (
    <>
      <APKUpdateModal />
      <Routes>
        <Route path="/download-apk" element={<PublicRoute><DownloadAPK /></PublicRoute>} />
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />

      <Route path="/shared-profile/:userId" element={<SharedProfile />} />
      <Route path="/terms" element={<div className="legal-page-wrapper"><Terms /></div>} />
      <Route path="/privacy" element={<div className="legal-page-wrapper"><Privacy /></div>} />
      <Route path="/about" element={<About />} />

      {/* Arena — fullscreen, outside MainLayout */}
      <Route path="/chat/:chatId/:otherUserId/arena" element={<ProtectedRoute><ArenaPage /></ProtectedRoute>} />
      <Route path="/chat/:chatId/arena" element={<ProtectedRoute><ArenaPage /></ProtectedRoute>} />

      <Route path="/" element={isAuthenticated ? <ProtectedRoute><MainLayout /></ProtectedRoute> : <LandingPage />}>
        <Route index element={<ChatPlaceholder />} />
        <Route path="chat/:chatId/group" element={<GroupChat key={location.pathname} />} />
        <Route path="chat/:chatId/group/media" element={<SharedMediaGallery />} />
        <Route path="chat/:chatId/:otherUserId" element={<Chat key={location.pathname} />} />
        <Route path="chat/:chatId/:otherUserId/media" element={<SharedMediaGallery />} />
        <Route path="user-details/:id" element={<UserDetails />} />
        <Route path="groups" element={<GroupsPage />} />
        <Route path="chat/:chatId/group/info" element={<GroupInfoPage />} />
        <Route path="contacts" element={<ContactsPage isDesktop={isDesktop} />} />
        <Route path="profile" element={<Profile isSidebar={isDesktop} />} />
        <Route path="settings" element={<Settings />} />
        <Route path="settings/security" element={<SecuritySettings />} />
        <Route path="settings/help" element={<HelpCenter />} />
        <Route path="emoji-settings" element={<EmojiSettings />} />
        <Route path="history" element={<History />} />
        <Route path="blocked" element={<Blocked onBack={() => window.history.back()} />} />
        <Route path="support" element={<SupportChat />} />
      </Route>

      <Route path="/reminders" element={<ProtectedRoute><Reminders /></ProtectedRoute>} />
      <Route path="/create-reminder" element={<ProtectedRoute><CreateReminder /></ProtectedRoute>} />
      <Route path="/calls" element={<ProtectedRoute><Calls /></ProtectedRoute>} />
      <Route path="/qr" element={<ProtectedRoute><QRPage /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
      <Route path="/admin-about" element={<AdminAbout />} />
      <Route path="/call/:callId" element={<ProtectedRoute><CallScreen /></ProtectedRoute>} />
      <Route path="/room/:roomId" element={<RoomRedirect />} />

      {/* 404 */}
      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
};


// ──────────────────────────────────────────────
// PublicRoute
// ──────────────────────────────────────────────
const PublicRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (isAuthenticated) {
    const from = location.state?.from?.pathname || '/';
    return <Navigate to={from} replace />;
  }

  return children;
};


// ──────────────────────────────────────────────
// ProtectedRoute — FIXED
// ──────────────────────────────────────────────
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, dbUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();

  // FIX #1: Initialize state from current auth to prevent flash frame
  const [showPhoneAuth, setShowPhoneAuth] = useState(() => !isAuthenticated);
  const [showPhoneCollect, setShowPhoneCollect] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setShowPhoneAuth(true);
      setShowPhoneCollect(false);
    } else {
      setShowPhoneAuth(false);
      // Skip phone number collection if offline to avoid modal blocking the app
      const isOnline = navigator.onLine;
      setShowPhoneCollect(isOnline && dbUser && (!dbUser.phone || dbUser.phone === ''));
    }
  }, [isAuthenticated, dbUser]);

  const handleAuthSuccess = () => {
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
      useAuthStore.setState({ dbUser: updatedUser });
      setShowPhoneCollect(false);
    } catch (error) {
      console.error('Error updating user:', error);
    }
  };

  // ─────────────────────────────────────────────
  // FIX #2: Do NOT render {children} when unauthenticated
  //         Show empty shell behind the modal instead
  // ─────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <>
        <div className="app-layout">
          {isDesktop && <DesktopNavbar />}
          <main className="app-content">
            {/* FIX: Empty placeholder — protected children do NOT render */}
            <div className="auth-guard-placeholder" style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              opacity: 0.3,
            }}>
              <p>Please sign in to continue</p>
            </div>
          </main>
        </div>
        <PhoneAuthModal
          isOpen={showPhoneAuth}
          onClose={() => setShowPhoneAuth(false)}
          onAuthSuccess={handleAuthSuccess}
          onBackToLogin={() => {
            setShowPhoneAuth(false);
            navigate('/login');
          }}
        />
      </>
    );
  }

  // ─── Authenticated ───
  return (
    <>
      <div className="app-layout">
        {isDesktop && <DesktopNavbar />}
        <main className="app-content">
          {children}
        </main>
      </div>

      {/* Phone number collection for OAuth users */}
      <PhoneAuthModal
        isOpen={showPhoneCollect}
        onClose={() => setShowPhoneCollect(false)}
        mode="collect"
        onCollectSuccess={handleCollectSuccess}
      />
    </>
  );
};


// ──────────────────────────────────────────────
// SafeSuspense — Wrapper for global lazy components
// Prevents one failing lazy component from blanking the whole app
// ──────────────────────────────────────────────
const SafeSuspense = ({ children, fallback = null }) => (
  <Suspense fallback={fallback}>
    <ErrorBoundary fallback={null}>
      {children}
    </ErrorBoundary>
  </Suspense>
);


// ──────────────────────────────────────────────
// App (root)
// ──────────────────────────────────────────────
const App = () => {
  const { dbUser, loading: authLoading } = useAuth();
  const { needsRefresh, handleRefresh, handleDismiss, isRefreshing } = useAutoRefresh();

  useCapacitorPlugins();

  useEffect(() => {
    // Initialize Safe Area Detection & Keyboard Handling
    SafeAreaDetector.getInstance();
    KeyboardHandler.getInstance();

    // Add platform specific classes to body for CSS hooks
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isAndroid = /Android/i.test(navigator.userAgent);
    const platform = isIOS ? 'ios' : (isAndroid ? 'android' : 'web');

    document.body.classList.add(`platform-${platform}`);

    // Detect if the app is running in standalone mode (PWA)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone ||
      document.referrer.includes('android-app://');

    document.documentElement.setAttribute('data-standalone', isStandalone ? 'true' : 'false');

    // Set --app-height for legacy components
    const updateAppHeight = () => {
      document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
    };
    updateAppHeight();
    window.addEventListener('resize', updateAppHeight);

    // Prevent overscroll bounce on iOS for a more native feel
    if (isIOS) {
      document.body.style.overscrollBehavior = 'none';
    }

    initializePushNotifications();
    requestPersistentStorage();
    FileCache.init();
  }, []);

  useNetworkSync();

  return (
    <Suspense fallback={<div className="loading" />}>
      <ErrorBoundary>
        <DialogProvider>
          {/* FIX #3: Guard against null dbUser during auth loading */}
          <GroupCallProvider currentUser={authLoading ? null : dbUser}>
            {/* Layout utilities */}
            <SafeAreaDebugger />

            <OfflineIndicator>
              <AppContent />
            </OfflineIndicator>

            {/* FIX #4: Wrap each global lazy component in SafeSuspense
                so one failing component doesn't blank the entire app */}
            <SafeSuspense>
              <CallStatusIndicator />
            </SafeSuspense>

            <SafeSuspense>
              <IncomingCallModal />
            </SafeSuspense>

            <SafeSuspense>
              <GroupIncomingCallNotification />
            </SafeSuspense>

            <SyncIndicator />

            {/* FIX #5: Use valid position value for react-hot-toast */}
            <Toaster
              position="bottom-center"
              toastOptions={{
                duration: 3000,
                style: {
                  maxWidth: '90vw',
                },
              }}
            />

            <GlobalDialog />

            {/* Professional Auto-Refresh Notification */}
            <AnimatePresence>
              {needsRefresh && (
                <motion.div
                  className={`auto-refresh-banner ${isRefreshing ? 'updating' : ''}`}
                  initial={{ y: 100, x: '-50%', opacity: 0 }}
                  animate={{ y: 0, x: '-50%', opacity: 1 }}
                  exit={{ y: 100, x: '-50%', opacity: 0 }}
                  transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                >
                  <div className="banner-content" onClick={!isRefreshing ? handleRefresh : undefined}>
                    <div className="icon-container">
                      {isRefreshing ? (
                        <RefreshCw className="refresh-spinner" size={18} />
                      ) : (
                        <Sparkles className="sparkle-icon" size={18} />
                      )}
                    </div>
                    <span className="refresh-text">
                      {isRefreshing ? 'Updating to latest version...' : 'New update available! Tap to refresh'}
                    </span>
                  </div>
                  {!isRefreshing && (
                    <button className="banner-close" onClick={handleDismiss} title="Dismiss">
                      <X size={16} />
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </GroupCallProvider>
        </DialogProvider>
      </ErrorBoundary>
    </Suspense>
  );
};

// Helper to redirect from old /room/:roomId to new Arena
const RoomRedirect = () => {
    const { roomId } = useParams();
    return <Navigate to={`/chat/${roomId}/arena`} replace />;
};

export default App;