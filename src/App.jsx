import { Suspense, lazy, useEffect, useState } from 'react';
// [FIX #2] Added useParams to the import — was missing, causing RoomRedirect to crash
import { Routes, Route, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { X, Sparkles, RefreshCw } from 'lucide-react';
import { useAuth } from './hooks/useAuth';
// [FIX #11] Removed unused ChatThemeProvider import
import { GroupCallProvider } from './contexts/GroupCallProvider';
import { isNativeWithPlugins } from './utils/platformCheck';
import { Capacitor } from '@capacitor/core';

import PhoneAuthModal from './components/auth/PhoneAuthModal';
import { supabase } from './config/supabase';
import { dbToFrontend } from './utils/dbFieldMapping';
import ErrorBoundary from './components/common/ErrorBoundary';
import SafeSuspense from './components/common/SafeSuspense';
import useIsDesktop from './hooks/useIsDesktop';
import { SafeAreaDetector } from './utils/safeAreaDetector';
import { KeyboardHandler } from './utils/keyboardHandler';
import SafeAreaDebugger from './components/common/SafeAreaDebugger';
import { initializePushNotifications } from './utils/PushNotifications';
import useOnlineStatus from './hooks/useOnlineStatus';
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
import './styles/loaders.css';

// Lazy load non-critical components
const Login = lazy(() => import('./components/auth/Login'));
const LandingPage = lazy(() => import('./pages/LandingPage'));
const DownloadAPK = lazy(() => import('./pages/DownloadAPK'));
const Intro = lazy(() => import('./components/Intro'));
const GroupsPage = lazy(() => import('./components/groups').then(m => ({ default: m.GroupsPage })));
const GroupInfoPage = lazy(() => import('./components/groups').then(m => ({ default: m.GroupInfoPage })));
const AddMembersPage = lazy(() => import('./components/groups').then(m => ({ default: m.AddMembersPage })));
const CreateGroupPage = lazy(() => import('./components/groups').then(m => ({ default: m.CreateGroupPage })));
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
const Terms = lazy(() => import('./components/legal/Terms'));
const Privacy = lazy(() => import('./components/legal/Privacy'));
const SharedProfile = lazy(() => import('./components/shared-profile'));
const SecuritySettings = lazy(() => import('./components/settings/SecuritySettings'));
const HelpCenter = lazy(() => import('./components/settings/HelpCenter'));
const GamesPanel = lazy(() => import('./components/games/GamesPanel'));

// Lazy load call-related components and other heavy modals
const CallScreen = lazy(() => import('./components/CallScreen'));
const CallStatusIndicator = lazy(() => import('./components/CallStatusIndicator'));
const IncomingCallModal = lazy(() => import('./components/IncomingCallModal'));
const GroupIncomingCallNotification = lazy(() => import('./components/group/GroupIncomingCallNotification'));
const APKUpdateModal = lazy(() => import('./components/APKUpdateModal'));

// Core components that remain static for initial shell
import ChatPlaceholder from './components/common/ChatPlaceholder';
import DesktopNavbar from './components/common/DesktopNavbar';
import Modal from './components/common/Modal';
import OfflineIndicator from './components/common/OfflineIndicator';
import SyncIndicator from './components/common/SyncIndicator';

// Lazy load truly non-critical/heavy components
const Chat = lazy(() => import('./components/chat/ChatScreen'));
const SharedMediaGallery = lazy(() => import('./components/chat/SharedMediaGallery'));
const Admin = lazy(() => import('./components/Admin'));
const AdminAbout = lazy(() => import('./components/admin/AdminAbout'));
const AutoRefreshBanner = lazy(() => import('./components/common/AutoRefreshBanner'));
const MainLayout = lazy(() => import('./components/MainLayout'));


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

    // Native App: Direct redirect to login for unauthenticated users
    // Using Capacitor.isNativePlatform() directly here because it's safe on Vercel origin 
    // and correctly identifies the platform even after redirect.
    if (!isAuthenticated && Capacitor.isNativePlatform() && location.pathname === '/') {
        return <Navigate to="/login" replace />;
    }

    return (
        <>
            <SafeSuspense>
                <APKUpdateModal />
            </SafeSuspense>
            <SafeSuspense fallback={<div className="loading" />}>
                <Routes>
                    <Route path="/download-apk" element={<PublicRoute><DownloadAPK /></PublicRoute>} />
                    <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />

                    <Route path="/shared-profile/:userId" element={<SharedProfile />} />
                    <Route path="/terms" element={<div className="legal-page-wrapper"><Terms /></div>} />
                    <Route path="/privacy" element={<div className="legal-page-wrapper"><Privacy /></div>} />
                    <Route path="/about" element={<About />} />

                    {/* Gaming Hub is now handled within MainLayout at /games */}

                    <Route path="/" element={isAuthenticated ? <ProtectedRoute><MainLayout /></ProtectedRoute> : <LandingPage />}>
                        <Route index element={<ChatPlaceholder />} />
                        <Route path="chat/:chatId/group/media" element={<SharedMediaGallery />} />
                        <Route path="chat/:chatId/group/info" element={<GroupInfoPage />} />
                        <Route path="chat/:chatId/group/add-members" element={<AddMembersPage />} />
                        <Route path="chat/:chatId/group" element={<GroupChat key={location.pathname} />} />
                        <Route path="contacts" element={<ContactsPage isDesktop={isDesktop} />} />
                        <Route path="profile" element={<Profile isSidebar={isDesktop} />} />
                        <Route path="settings" element={<Settings />} />
                        <Route path="settings/security" element={<SecuritySettings />} />
                        <Route path="settings/help" element={<HelpCenter />} />
                        <Route path="emoji-settings" element={<EmojiSettings />} />
                        <Route path="history" element={<History />} />
                        <Route path="blocked" element={<Blocked onBack={() => window.history.back()} />} />
                        <Route path="support" element={<SupportChat />} />
                        <Route path="games" element={<GamesPanel />} />
                    </Route>

                    <Route path="/reminders" element={<ProtectedRoute><Reminders /></ProtectedRoute>} />
                    <Route path="/create-reminder" element={<ProtectedRoute><CreateReminder /></ProtectedRoute>} />
                    <Route path="/calls" element={<ProtectedRoute><Calls /></ProtectedRoute>} />
                    <Route path="/qr" element={<ProtectedRoute><QRPage /></ProtectedRoute>} />
                    <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
                    <Route path="/admin-about" element={<AdminAbout />} />
                    <Route path="/call/:callId" element={<ProtectedRoute><CallScreen /></ProtectedRoute>} />

                    {/* 404 */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </SafeSuspense>
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
// ProtectedRoute
// ──────────────────────────────────────────────
const ProtectedRoute = ({ children }) => {
    const { isAuthenticated, dbUser, isDbUserLoaded } = useAuth();
    const location = useLocation();
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
            const shouldCollect = !!dbUser && !dbUser._isFallback && isDbUserLoaded && (!dbUser.phone || dbUser.phone === '') && navigator.onLine;
            setShowPhoneCollect(shouldCollect);
        }
    }, [isAuthenticated, dbUser, isDbUserLoaded]);

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
            useAuthStore.setState({ dbUser: dbToFrontend(updatedUser) });
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


// ──────────────────────────────────────────────
// SafeSuspense
// ──────────────────────────────────────────────



// ──────────────────────────────────────────────
// App (root)
// ──────────────────────────────────────────────
const App = () => {
    const { dbUser, loading: authLoading } = useAuth();
    const { needsRefresh, handleRefresh, handleDismiss, isRefreshing, updateInfo } = useAutoRefresh();

    useCapacitorPlugins();

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

        if (isIOS) {
            document.body.style.overscrollBehavior = 'none';
        }

        initializePushNotifications();
        requestPersistentStorage();
        FileCache.init();

        return () => {
            window.removeEventListener('resize', updateAppHeight);
        };
    }, []);

    useNetworkSync();

    return (
        <Suspense fallback={<div className="loading" />}>
            <ErrorBoundary>
                <DialogProvider>
                    <GroupCallProvider currentUser={authLoading ? null : dbUser}>
                        <SafeAreaDebugger />

                        <OfflineIndicator>
                            <AppContent />
                        </OfflineIndicator>

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

                        <GlobalDialog />

                        <SafeSuspense>
                            <AutoRefreshBanner
                                needsRefresh={needsRefresh}
                                isRefreshing={isRefreshing}
                                handleRefresh={handleRefresh}
                                handleDismiss={handleDismiss}
                                updateInfo={updateInfo}
                            />
                        </SafeSuspense>
                    </GroupCallProvider>
                </DialogProvider>
            </ErrorBoundary>
        </Suspense>
    );
};

export default App;