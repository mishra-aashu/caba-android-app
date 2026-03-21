/**
 * AuthenticatedApp.jsx
 *
 * This component is LAZY-loaded, so all providers and heavy
 * dependencies inside it are excluded from the initial bundle.
 * They only load AFTER the user is confirmed to be authenticated.
 */
import { Suspense, lazy, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ChatThemeProvider } from './contexts/ChatThemeProvider';
import { EmojiStyleProvider } from './contexts/EmojiStyleProvider';
import { CallProvider } from './contexts/CallProvider';
import { GroupCallProvider } from './contexts/GroupCallProvider';
import { DialogProvider } from './contexts/DialogProvider';
import { Toaster } from 'react-hot-toast';
import { useAuth } from './hooks/useAuth';
import { supabase } from './config/supabase';
import { dbToFrontend } from './utils/dbFieldMapping';
import useAuthStore from './store/authStore';
import useIsDesktop from './hooks/useIsDesktop';
import useOnlineStatus from './hooks/useOnlineStatus';
import useNetworkSync from './hooks/useNetworkSync';
import { useCapacitorPlugins } from './hooks/useCapacitorPlugins';
import ErrorBoundary from './components/common/ErrorBoundary';
import { isNativeWithPlugins } from './utils/platformCheck';
import { Capacitor } from '@capacitor/core';
import { initializePushNotifications } from './utils/PushNotifications';
import { requestPersistentStorage } from './db/db';
import { FileCache } from './utils/FileCache';
import { SafeAreaDetector } from './utils/safeAreaDetector';
import { KeyboardHandler } from './utils/keyboardHandler';
import useSessionManager from './hooks/useSessionManager';
import './styles/loaders.css';

// Lazy-load non-critical components
const Intro = lazy(() => import('./components/Intro'));
const GroupsPage = lazy(() => import('./components/groups').then(m => ({ default: m.GroupsPage })));
const GroupInfoPage = lazy(() => import('./components/groups').then(m => ({ default: m.GroupInfoPage })));
const GroupChat = lazy(() => import('./components/chat/ChatScreen'));
const ContactsPage = lazy(() => import('./components/contacts/ContactsPage'));
const ArenaPage = lazy(() => import('./components/chat/ArenaPage'));
const Profile = lazy(() => import('./components/profile/Profile'));
const UserDetails = lazy(() => import('./components/UserDetails'));
const Settings = lazy(() => import('./components/settings'));
const EmojiSettings = lazy(() => import('./components/settings/EmojiSettings'));
const Reminders = lazy(() => import('./components/reminders'));
const CreateReminder = lazy(() => import('./components/reminders/CreateReminder'));
const Calls = lazy(() => import('./components/calls'));
const History = lazy(() => import('./components/History'));
const Blocked = lazy(() => import('./components/blocked'));
const About = lazy(() => import('./components/About'));
const SupportChat = lazy(() => import('./components/SupportChat'));
const QRPage = lazy(() => import('./components/qr').then(m => ({ default: m.QRPage })));
const SharedProfile = lazy(() => import('./components/shared-profile'));
const SecuritySettings = lazy(() => import('./components/settings/SecuritySettings'));
const HelpCenter = lazy(() => import('./components/settings/HelpCenter'));
const CallScreen = lazy(() => import('./components/CallScreen'));
const CallStatusIndicator = lazy(() => import('./components/CallStatusIndicator'));
const IncomingCallModal = lazy(() => import('./components/IncomingCallModal'));
const GroupIncomingCallNotification = lazy(() => import('./components/group/GroupIncomingCallNotification'));
const APKUpdateModal = lazy(() => import('./components/APKUpdateModal'));
const Chat = lazy(() => import('./components/chat/ChatScreen'));
const SharedMediaGallery = lazy(() => import('./components/chat/SharedMediaGallery'));
const Admin = lazy(() => import('./components/Admin'));
const AdminAbout = lazy(() => import('./components/admin/AdminAbout'));
const MainLayout = lazy(() => import('./components/MainLayout'));
const PhoneAuthModal = lazy(() => import('./components/auth/PhoneAuthModal'));
const DesktopNavbar = lazy(() => import('./components/common/DesktopNavbar'));
const Terms = lazy(() => import('./components/legal/Terms'));
const Privacy = lazy(() => import('./components/legal/Privacy'));
import PageTransition from './components/common/PageTransition';

// Core shell components (small, needed immediately for layout)
import ChatPlaceholder from './components/common/ChatPlaceholder';
import Modal from './components/common/Modal';
import OfflineIndicator from './components/common/OfflineIndicator';
import SyncIndicator from './components/common/SyncIndicator';
import SafeAreaDebugger from './components/common/SafeAreaDebugger';
import GlobalDialog from './components/common/GlobalDialog';

const SafeSuspense = ({ children, fallback = null }) => (
  <Suspense fallback={fallback}>
    <ErrorBoundary fallback={null}>
      {children}
    </ErrorBoundary>
  </Suspense>
);

const ProtectedLayout = ({ children }) => {
  const { isAuthenticated, dbUser } = useAuth();
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();

  const [showPhoneAuth, setShowPhoneAuth] = useState(() => !isAuthenticated);
  const [showPhoneCollect, setShowPhoneCollect] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setShowPhoneAuth(true);
      setShowPhoneCollect(false);
    } else {
      setShowPhoneAuth(false);
      // Show collect modal if phone is missing/blank AND user is online
      setShowPhoneCollect(!!dbUser && (!dbUser.phone || dbUser.phone === '') && navigator.onLine);
    }
  }, [isAuthenticated, dbUser]);

  const handleAuthSuccess = () => setShowPhoneAuth(false);

  const handleCollectSuccess = async ({ phone, name }) => {
    try {
      const { data: updatedUser, error } = await supabase
        .from('users')
        .update({ phone, name })
        .eq('id', dbUser.id)
        .select()
        .single();
      if (error) throw error;
      useAuthStore.setState({ dbUser: dbToFrontend(updatedUser) });
      setShowPhoneCollect(false);
    } catch (error) {
      console.error('Error updating user:', error);
    }
  };

  return (
    <>
      <div className="app-layout">
        {isDesktop && (
          <SafeSuspense>
            <DesktopNavbar />
          </SafeSuspense>
        )}
        <main className="app-content">
          {children}
        </main>
      </div>
      <SafeSuspense>
        <PhoneAuthModal
          isOpen={showPhoneCollect}
          onClose={() => setShowPhoneCollect(false)}
          mode="collect"
          onCollectSuccess={handleCollectSuccess}
        />
      </SafeSuspense>
    </>
  );
};

const RoomRedirect = () => {
  const { roomId } = useParams();
  return <Navigate to={`/chat/${roomId}/arena`} replace />;
};

// ──────────────────────────────────────────────
// AppContent: All routes, inside the authenticated shell
// ──────────────────────────────────────────────
const AppContent = () => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();
  const isDesktop = useIsDesktop();
  const [splashFinished, setSplashFinished] = useState(false);
  useOnlineStatus();

  if (loading) return null;

  const isNative = isNativeWithPlugins();
  if (!isAuthenticated && isNative && location.pathname === '/') {
    return <Navigate to="/login" replace />;
  }

  return (
    <>
      <SafeSuspense>
        <APKUpdateModal />
      </SafeSuspense>
      <Suspense fallback={<div className="loading" />}>
        <AnimatePresence mode="wait">
          <Routes location={location}>
            <Route path="/shared-profile/:userId" element={<PageTransition><SharedProfile /></PageTransition>} />
            <Route path="/terms" element={<PageTransition><div className="legal-page-wrapper"><Terms /></div></PageTransition>} />
            <Route path="/privacy" element={<PageTransition><div className="legal-page-wrapper"><Privacy /></div></PageTransition>} />
            <Route path="/about" element={<PageTransition><About /></PageTransition>} />
            <Route path="/chat/:chatId/:otherUserId/arena" element={<PageTransition><ProtectedLayout><ArenaPage /></ProtectedLayout></PageTransition>} />
            <Route path="/chat/:chatId/arena" element={<PageTransition><ProtectedLayout><ArenaPage /></ProtectedLayout></PageTransition>} />
            <Route path="/" element={<ProtectedLayout><MainLayout /></ProtectedLayout>}>
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
            <Route path="/reminders" element={<PageTransition><ProtectedLayout><Reminders /></ProtectedLayout></PageTransition>} />
            <Route path="/create-reminder" element={<PageTransition><ProtectedLayout><CreateReminder /></ProtectedLayout></PageTransition>} />
            <Route path="/calls" element={<PageTransition><ProtectedLayout><Calls /></ProtectedLayout></PageTransition>} />
            <Route path="/qr" element={<PageTransition><ProtectedLayout><QRPage /></ProtectedLayout></PageTransition>} />
            <Route path="/admin" element={<PageTransition><ProtectedLayout><Admin /></ProtectedLayout></PageTransition>} />
            <Route path="/admin-about" element={<PageTransition><AdminAbout /></PageTransition>} />
            <Route path="/call/:callId" element={<PageTransition><ProtectedLayout><CallScreen /></ProtectedLayout></PageTransition>} />
            <Route path="/room/:roomId" element={<RoomRedirect />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AnimatePresence>
      </Suspense>
    </>
  );
};

// ──────────────────────────────────────────────
// AuthenticatedApp: heavy providers + all routes
// This whole module is lazy-loaded from main.jsx
// ──────────────────────────────────────────────
const AuthenticatedApp = () => {
  const { dbUser, loading: authLoading } = useAuth();

  useCapacitorPlugins();
  useNetworkSync();

  // ✅ Professional Session Management Hook
  useSessionManager(dbUser?.id);

  return (
    <ChatThemeProvider>
      <EmojiStyleProvider>
        <AppWithCallProvider dbUser={dbUser} authLoading={authLoading} />
      </EmojiStyleProvider>
    </ChatThemeProvider>
  );
};

const AppWithCallProvider = ({ dbUser, authLoading }) => {
  return (
    <DialogProvider>
      <GroupCallProvider currentUser={authLoading ? null : dbUser}>
        <CallProvider currentUser={authLoading ? null : dbUser}>
          <SafeAreaDebugger />
          <OfflineIndicator>
            <AppContent />
          </OfflineIndicator>
          <SafeSuspense><CallStatusIndicator /></SafeSuspense>
          <SafeSuspense><IncomingCallModal /></SafeSuspense>
          <SafeSuspense><GroupIncomingCallNotification /></SafeSuspense>
          <SyncIndicator />
          <GlobalDialog />
        </CallProvider>
      </GroupCallProvider>
    </DialogProvider>
  );
};

export default AuthenticatedApp;
