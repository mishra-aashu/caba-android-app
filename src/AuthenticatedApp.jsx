/**
 * AuthenticatedApp.jsx
 *
 * This component is LAZY-loaded, so all providers and heavy
 * dependencies inside it are excluded from the initial bundle.
 * They only load AFTER the user is confirmed to be authenticated.
 */
import { Suspense, lazy, useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useLocation, useParams } from 'react-router-dom';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { ChatThemeProvider } from './contexts/ChatThemeProvider';
import { EmojiStyleProvider } from './contexts/EmojiStyleProvider';
import { CallProvider } from './contexts/CallProvider';
import { GroupCallProvider } from './contexts/GroupCallProvider';
import { GameLobbyProvider } from './contexts/GameLobbyProvider';
import { DialogProvider } from './contexts/DialogProvider';
import toast from 'react-hot-toast';
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
import useSessionManager from './hooks/useSessionManager';
import SafeSuspense from './components/common/SafeSuspense';
import './styles/loaders.css';

// Lazy-load non-critical components
const Intro = lazy(() => import('./components/Intro'));
const GroupsPage = lazy(() => import('./components/groups').then(m => ({ default: m.GroupsPage })));
const GroupInfoPage = lazy(() => import('./components/groups').then(m => ({ default: m.GroupInfoPage })));
const GroupChat = lazy(() => import('./components/chat/ChatScreen'));
const ContactsPage = lazy(() => import('./components/contacts/ContactsPage'));
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
const Devices = lazy(() => import('./components/settings/Devices'));
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
const GamesPanel = lazy(() => import('./components/games/GamesPanel'));
import PageTransition from './components/common/PageTransition';


// Core shell components (small, needed immediately for layout)
import ChatPlaceholder from './components/common/ChatPlaceholder';
import OfflineIndicator from './components/common/OfflineIndicator';
import SyncIndicator from './components/common/SyncIndicator';
import SafeAreaDebugger from './components/common/SafeAreaDebugger';
import GlobalDialog from './components/common/GlobalDialog';



const ProtectedLayout = ({ children }) => {
  const { isAuthenticated, dbUser, isDbUserLoaded, isServerUnreachable } = useAuth();
  const { isOnline } = useOnlineStatus();
  const isDesktop = useIsDesktop();

  const [showPhoneAuth, setShowPhoneAuth] = useState(() => !isAuthenticated);
  const [showPhoneCollect, setShowPhoneCollect] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setShowPhoneAuth(true);
      setShowPhoneCollect(false);
    } else if (isDbUserLoaded) {
      setShowPhoneAuth(false);
      
      // ✅ PROFESSIONAL LOGIC: 
      // Show collect modal if:
      // 1. Server is reachable (not in emergency fallback mode)
      // 2. Database user is fully loaded (not a fallback)
      // 3. Phone is missing
      // (Even if offline, we show the modal to prevent bypass)
      const shouldCollect = 
        !isServerUnreachable && 
        !!dbUser && 
        !dbUser._isFallback && 
        (!dbUser.phone || dbUser.phone === '');

      setShowPhoneCollect(shouldCollect);
    }
  }, [isAuthenticated, dbUser, isDbUserLoaded, isOnline, isServerUnreachable]);

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
      useAuthStore.getState().updateDbUser(dbToFrontend(updatedUser));
      setShowPhoneCollect(false);
      toast.success('Profile updated successfully!');
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error('Failed to update profile. Please try again.');
    }
  };

  if (isAuthenticated && !isDbUserLoaded && !isServerUnreachable && isOnline) {
    return (
      <div className="full-page-loader" style={{ 
        height: '100vh', 
        width: '100vw', 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center', 
        justifyContent: 'center', 
        background: '#0f172a',
        color: 'white',
        gap: '20px'
      }}>
        <div className="loading-spinner" style={{ width: '40px', height: '40px', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#3aeda2', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <p style={{ fontSize: '0.9rem', color: '#94a3b8', fontWeight: 500 }}>Initializing your profile...</p>
        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  return (
    <>
      {/* 🚀 PERFORMANCE FIX: Don't render app background if modal is active to save resources */}
      {!showPhoneCollect ? (
        <div className="app-layout">
          {isDesktop && (
            <SafeSuspense>
              <DesktopNavbar />
            </SafeSuspense>
          )}
          <main className="app-content">
            <SafeSuspense>
              {children || <Outlet />}
            </SafeSuspense>
          </main>
        </div>
      ) : (
        <div className="auth-lock-background" style={{ 
          position: 'fixed', 
          inset: 0, 
          background: '#0f172a', 
          zIndex: 0 
        }} />
      )}

      <SafeSuspense>
        <PhoneAuthModal
          isOpen={showPhoneCollect}
          onClose={() => {
            // Only allow closing if we don't NEED to collect
            const stillNeedsCollect = !isServerUnreachable && isDbUserLoaded && !!dbUser && (!dbUser.phone || dbUser.phone === '');
            if (!stillNeedsCollect) {
              setShowPhoneCollect(false);
            }
          }}
          mode="collect"
          onCollectSuccess={handleCollectSuccess}
        />
      </SafeSuspense>
    </>
  );
};



// ──────────────────────────────────────────────
// AppContent: All routes, inside the authenticated shell
// ──────────────────────────────────────────────
const AppContent = () => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();
  const isDesktop = useIsDesktop();
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
            <Route path="/admin-about" element={<PageTransition><AdminAbout /></PageTransition>} />
            
            {/* Protected Routes directly under Shared Layout */}
            <Route element={<ProtectedLayout />}>
              
              {/* Main App Layout */}
              <Route path="/" element={<MainLayout />}>
                <Route index element={<ChatPlaceholder />} />
                <Route path="chat/:chatId/group" element={<GroupChat />} />
                <Route path="chat/:chatId/group/media" element={<SharedMediaGallery />} />
                <Route path="chat/:chatId/:otherUserId" element={<Chat />} />
                <Route path="chat/:chatId/:otherUserId/media" element={<SharedMediaGallery />} />
                <Route path="user-details/:id" element={<UserDetails />} />
                <Route path="groups" element={<GroupsPage />} />
                <Route path="chat/:chatId/group/info" element={<GroupInfoPage />} />
                <Route path="contacts" element={<ContactsPage isDesktop={isDesktop} />} />
                <Route path="profile" element={<Profile isSidebar={isDesktop} />} />
                <Route path="settings" element={<Settings />} />
                <Route path="settings/security" element={<SecuritySettings />} />
                <Route path="settings/devices" element={<Devices />} />
                <Route path="settings/help" element={<HelpCenter />} />
                <Route path="emoji-settings" element={<EmojiSettings />} />
                <Route path="history" element={<History />} />
                <Route path="blocked" element={<Blocked onBack={() => window.history.back()} />} />
                <Route path="support" element={<SupportChat />} />
                <Route path="games" element={<GamesPanel />} />

              </Route>

              {/* Standalone Protected Routes */}
              <Route path="/reminders" element={<PageTransition><Reminders /></PageTransition>} />
              <Route path="/create-reminder" element={<PageTransition><CreateReminder /></PageTransition>} />
              <Route path="/calls" element={<PageTransition><Calls /></PageTransition>} />
              <Route path="/qr" element={<PageTransition><QRPage /></PageTransition>} />
              <Route path="/admin" element={<PageTransition><Admin /></PageTransition>} />
              <Route path="/call/:callId" element={<PageTransition><CallScreen /></PageTransition>} />
            </Route>

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
  const dbUser = useAuth(state => state.dbUser);
  const user = useAuth(state => state.user);
  const authLoading = useAuth(state => state.loading);

  useCapacitorPlugins();
  useNetworkSync();

  // ✅ Professional Session Management Hook
  useSessionManager(dbUser?.id);

  return (
    <ChatThemeProvider>
      <EmojiStyleProvider>
        <AppWithCallProvider dbUser={dbUser} user={user} authLoading={authLoading} />
      </EmojiStyleProvider>
    </ChatThemeProvider>
  );
};

const AppWithCallProvider = ({ dbUser, user, authLoading }) => {
  return (
    <DialogProvider>
      <GameLobbyProvider>
        <GroupCallProvider currentUser={authLoading ? null : (dbUser || user)}>
          <CallProvider currentUser={authLoading ? null : (dbUser || user)}>
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
      </GameLobbyProvider>
    </DialogProvider>
  );
};

export default AuthenticatedApp;
