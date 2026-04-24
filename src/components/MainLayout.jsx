import React, { useState, useCallback, useMemo, Suspense, lazy, memo } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { syncService } from '../services/syncService';
import { processSyncQueue } from '../services/offlineQueue';
import useIsDesktop from '../hooks/useIsDesktop';

import BottomNavigation from './common/BottomNavigation';
import ChatPlaceholder from './common/ChatPlaceholder';
import ParticleOverlay from './chat/ParticleOverlay';
import PageTransition from './common/PageTransition';
import useChatStore from '../store/useChatStore';
import ChatScreen from './chat/ChatScreen';

import { UserDetailsContext } from '../contexts/UserDetailsContext';

// Lazy loads
const UserDetails = lazy(() => import('./UserDetails'));
const GroupInfoDrawer = lazy(() => import('./groups/GroupInfoDrawer'));
const Sidebar = lazy(() => import('./layout/Sidebar'));
const ChatListPanel = lazy(() => import('./ChatListPanel'));
const DesktopLayout = lazy(() => import('./DesktopLayout'));
const ThemeSelector = lazy(() => import('./chat/ThemeSelector'));
const SharedMedia = lazy(() => import('./chat/SharedMedia'));

// ══════════════════════════════════════════════════════════════
// Memoized Components
// ══════════════════════════════════════════════════════════════

const LoadingFallback = memo(() => (
    <div className="loading">
        <div className="loading-spinner"></div>
    </div>
));
LoadingFallback.displayName = 'LoadingFallback';

// ══════════════════════════════════════════════════════════════
// Main Layout Component
// ══════════════════════════════════════════════════════════════

const MainLayout = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const isDesktop = useIsDesktop();

    // ──────────────────────────────────────────────────────────
    // Global Sync & Queue Processing (OPTIMIZED)
    // ──────────────────────────────────────────────────────────

    const lastSyncRef = React.useRef(0);
    const syncTimeoutRef = React.useRef(null);

    React.useEffect(() => {
        if (!user?.id) return;

        const SYNC_THROTTLE = 180000; // 3 minutes

        const runSync = (reason = 'unknown', force = false) => {
            const now = Date.now();

            // Throttle check
            if (!force && now - lastSyncRef.current < SYNC_THROTTLE) {
                console.log(`[MainLayout] Sync skipped (${reason}) - too soon`);
                return;
            }

            console.log(`[MainLayout] Scheduling sync (${reason})`);

            // Debounce: clear previous timeout
            if (syncTimeoutRef.current) {
                clearTimeout(syncTimeoutRef.current);
            }

            // Delay sync to avoid blocking navigation
            syncTimeoutRef.current = setTimeout(() => {
                if (!user?.id) return;

                console.log(`[MainLayout] Executing sync (${reason})`);
                syncService.performGlobalSync(user.id);
                processSyncQueue();
                lastSyncRef.current = Date.now();
            }, 500);
        };

        // 1. Initial catch-up on mount ONLY
        runSync('mount', true);

        // 2. Network reconnection sync
        const handleOnline = () => runSync('online', true);
        window.addEventListener('online', handleOnline);

        // 3. Browser tab focus recovery
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                runSync('visibility');
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);

        // 4. Capacitor native app foreground
        let capacitorAppListener = null;
        const setupCapacitorSync = async () => {
            try {
                const { App } = await import('@capacitor/app');
                capacitorAppListener = await App.addListener('appStateChange', ({ isActive }) => {
                    if (isActive) runSync('appState');
                });
            } catch {
                /* Not Capacitor */
            }
        };
        setupCapacitorSync();

        return () => {
            window.removeEventListener('online', handleOnline);
            document.removeEventListener('visibilitychange', handleVisibility);
            if (capacitorAppListener) capacitorAppListener.remove();
            if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
        };
    }, [user?.id]); // ✅ Removed location.pathname dependency

    // ──────────────────────────────────────────────────────────
    // Store State
    // ──────────────────────────────────────────────────────────

    const activeChat = useChatStore(state => state.activeChat);
    const setActiveChat = useChatStore(state => state.setActiveChat);

    // ──────────────────────────────────────────────────────────
    // Side Panel State
    // ──────────────────────────────────────────────────────────

    const [sidePanelType, setSidePanelType] = useState(null);
    const [sidePanelTargetId, setSidePanelTargetId] = useState(null);
    const [sidePanelData, setSidePanelData] = useState(null);

    // ──────────────────────────────────────────────────────────
    // Derived State (OPTIMIZED with useMemo)
    // ──────────────────────────────────────────────────────────

    const currentChatId = activeChat?.id;

    // Check if we're on a "sub-page" (not root)
    const isSubPage = useMemo(() => {
        return activeChat !== null || location.pathname !== '/';
    }, [location.pathname, activeChat]);

    // Check if chat view is active (for mobile layout)
    const isChatViewActive = useMemo(() => {
        if (activeChat) return true;

        const activePaths = new Set([
            '/user-details/',
            '/groups',
            '/contacts',
            '/settings/',
            '/profile',
            '/terms',
            '/privacy',
            '/blocked',
            '/support',
            '/emoji-settings',
            '/history',
            '/theme',
            '/shared-media/',
        ]);

        return Array.from(activePaths).some(path => location.pathname.startsWith(path));
    }, [location.pathname, activeChat]);

    // Check if we're on an overlay route (desktop sidebar content)
    const overlayRoutes = useMemo(
        () =>
            new Set([
                '/contacts',
                '/profile',
                '/settings',
                '/settings/security',
                '/settings/devices',
                '/settings/help',
                '/terms',
                '/privacy',
                '/blocked',
                '/support',
                '/emoji-settings',
                '/history',
                '/games',
            ]),
        []
    );

    const isOverlayRoute = useMemo(
        () =>
            overlayRoutes.has(location.pathname) ||
            location.pathname.startsWith('/settings/') ||
            location.pathname === '/theme',
        [location.pathname, overlayRoutes]
    );

    // Check for user-details route (mobile)
    const isUserDetailsRoute = location.pathname.startsWith('/user-details/');
    const userDetailsUserId = isUserDetailsRoute
        ? location.pathname.split('/user-details/')[1]
        : null;

    // ──────────────────────────────────────────────────────────
    // Callbacks (STABLE)
    // ──────────────────────────────────────────────────────────

    const handleChatClick = useCallback(
        (chat) => {
            if (!chat) return;
            setActiveChat(chat);
        },
        [setActiveChat]
    );

    const handleShowUserDetails = useCallback(
        (userId) => {
            if (isDesktop) {
                setSidePanelType('user');
                setSidePanelTargetId(userId);
            } else {
                navigate(`/user-details/${userId}`);
            }
        },
        [isDesktop, navigate]
    );

    const handleShowGroupInfo = useCallback(
        (groupId, groupData = null) => {
            if (isDesktop) {
                setSidePanelType('group');
                setSidePanelTargetId(groupId);
                setSidePanelData(groupData);
            } else {
                navigate(`/chat/${groupId}/group/info`);
            }
        },
        [isDesktop, navigate]
    );
    
    const handleShowThemeSelector = useCallback(() => {
        if (isDesktop) {
            setSidePanelType('theme');
            setSidePanelTargetId('current'); // Placeholder ID
        } else {
            navigate('/theme');
        }
    }, [isDesktop, navigate]);

    const handleShowSharedMedia = useCallback((id, isGroup = false) => {
        if (isDesktop) {
            setSidePanelType('shared-media');
            setSidePanelTargetId(id);
            setSidePanelData({ isGroup });
        } else {
            navigate(`/shared-media/${id}${isGroup ? '?isGroup=true' : ''}`);
        }
    }, [isDesktop, navigate]);

    const handleCloseSidePanel = useCallback(() => {
        setSidePanelType(null);
        setSidePanelTargetId(null);
        setSidePanelData(null);
    }, []);

    // ──────────────────────────────────────────────────────────
    // Props Objects (STABLE)
    // ──────────────────────────────────────────────────────────

    const chatListPanelProps = useMemo(
        () => ({
            handleChatClick,
            isDesktop,
            currentChatId,
            user,
        }),
        [handleChatClick, isDesktop, currentChatId, user]
    );

    // ✅ STABLE context value (no function recreation)
    const userDetailsContextValue = useMemo(
        () => ({
            showUserDetails: handleShowUserDetails,
            showGroupInfo: handleShowGroupInfo,
            showThemeSelector: handleShowThemeSelector,
            showSharedMedia: handleShowSharedMedia,
        }),
        [handleShowUserDetails, handleShowGroupInfo, handleShowThemeSelector, handleShowSharedMedia]
    );

    // ──────────────────────────────────────────────────────────
    // Desktop Side Panel Content
    // ──────────────────────────────────────────────────────────

    const sidePanel = useMemo(() => {
        if (!isDesktop || !sidePanelType || !sidePanelTargetId) return null;

        return (
            <Suspense fallback={<LoadingFallback />}>
                {sidePanelType === 'user' ? (
                    <UserDetails
                        userId={sidePanelTargetId}
                        isPanel={true}
                        onClose={handleCloseSidePanel}
                    />
                ) : sidePanelType === 'group' ? (
                    <GroupInfoDrawer
                        isOpen={true}
                        onClose={handleCloseSidePanel}
                        group={sidePanelData || { id: sidePanelTargetId }}
                    />
                ) : sidePanelType === 'shared-media' ? (
                    <SharedMedia
                        userId={!sidePanelData?.isGroup ? sidePanelTargetId : null}
                        chatId={sidePanelData?.isGroup ? sidePanelTargetId : null}
                        isPanel={true}
                        onClose={() => setSidePanelType('user')}
                    />
                ) : (
                    <ThemeSelector 
                        isPanel={true} 
                        onClose={handleCloseSidePanel} 
                    />
                )}
            </Suspense>
        );
    }, [isDesktop, sidePanelType, sidePanelTargetId, sidePanelData, handleCloseSidePanel]);

    // ──────────────────────────────────────────────────────────
    // Mobile User Details
    // ──────────────────────────────────────────────────────────

    const mobileSubPages = useMemo(() => {
        if (isDesktop) return null;
        
        if (isUserDetailsRoute && userDetailsUserId) {
            return (
                <Suspense fallback={<LoadingFallback />}>
                    <UserDetails userId={userDetailsUserId} />
                </Suspense>
            );
        }
        
        if (location.pathname === '/theme') {
            return (
                <Suspense fallback={<LoadingFallback />}>
                    <ThemeSelector onClose={() => navigate(-1)} />
                </Suspense>
            );
        }

        if (location.pathname.startsWith('/shared-media/')) {
            const id = location.pathname.split('/shared-media/')[1];
            const isGroup = new URLSearchParams(location.search).get('isGroup') === 'true';
            return (
                <Suspense fallback={<LoadingFallback />}>
                    <SharedMedia 
                        userId={!isGroup ? id : null} 
                        chatId={isGroup ? id : null} 
                        onClose={() => navigate(-1)} 
                    />
                </Suspense>
            );
        }
        
        return null;
    }, [isDesktop, isUserDetailsRoute, userDetailsUserId, location.pathname, navigate]);

    // ──────────────────────────────────────────────────────────
    // DESKTOP LAYOUT COMPONENTS (Defined before early return for hook safety)
    // ──────────────────────────────────────────────────────────

    const chatComponent = useMemo(
        () => (
            <Suspense fallback={<LoadingFallback />}>
                {isDesktop && isOverlayRoute ? (
                    <ChatPlaceholder />
                ) : activeChat ? (
                    <ChatScreen />
                ) : (
                    <Outlet />
                )}
            </Suspense>
        ),
        [isDesktop, isOverlayRoute, activeChat]
    );

    const sidebarPanel = useMemo(
        () => (
            <Sidebar
                isDesktop={isDesktop}
                isContactsRoute={location.pathname === '/contacts'}
                isProfileRoute={location.pathname === '/profile'}
                isSettingsRoute={
                    location.pathname === '/settings' ||
                    location.pathname.startsWith('/settings/')
                }
                isSecuritySettingsRoute={location.pathname === '/settings/security'}
                isHelpCenterRoute={location.pathname === '/settings/help'}
                isTermsRoute={location.pathname === '/terms'}
                isPrivacyRoute={location.pathname === '/privacy'}
                isBlockedRoute={location.pathname === '/blocked'}
                isSupportRoute={location.pathname === '/support'}
                isEmojiSettingsRoute={location.pathname === '/emoji-settings'}
                isHistoryRoute={location.pathname === '/history'}
                isGamesRoute={location.pathname === '/games'}
                chatListPanelProps={chatListPanelProps}
                onCloseSidebar={() => navigate('/')}
            />
        ),
        [isDesktop, location.pathname, chatListPanelProps, navigate]
    );

    // ──────────────────────────────────────────────────────────
    // MOBILE LAYOUT
    // ──────────────────────────────────────────────────────────

    if (!isDesktop) {
        return (
            <UserDetailsContext.Provider value={userDetailsContextValue}>
                <div className="mobile-layout">
                    <motion.div
                        className="list-view"
                        animate={{
                            opacity: isChatViewActive ? 0.8 : 1,
                        }}
                        transition={{ duration: 0.3 }}
                    >
                        <ChatListPanel {...chatListPanelProps} />
                    </motion.div>

                    {!isChatViewActive && <BottomNavigation />}

                    <AnimatePresence>
                        {isSubPage && (
                            <motion.div
                                key="subpage-backdrop"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0, pointerEvents: 'none' }}
                                transition={{ duration: 0.2 }}
                                style={{
                                    position: 'absolute',
                                    inset: 0,
                                    zIndex: 5,
                                    background: 'var(--bg-color)',
                                }}
                            />
                        )}
                    </AnimatePresence>

                    <AnimatePresence mode="wait">
                        {isSubPage && (
                            <PageTransition
                                key={
                                    activeChat?.id ||
                                    (location.pathname === '/' ? 'root' : location.pathname)
                                }
                                className={`chat-view ${
                                    location.pathname === '/games' ? 'with-nav' : ''
                                }`}
                            >
                                <Suspense fallback={<LoadingFallback />}>
                                    {mobileSubPages ||
                                        (activeChat ? <ChatScreen /> : <Outlet />)}
                                </Suspense>
                            </PageTransition>
                        )}
                    </AnimatePresence>
                </div>
            </UserDetailsContext.Provider>
        );
    }

    return (
        <UserDetailsContext.Provider value={userDetailsContextValue}>
            <DesktopLayout
                chatListPanel={sidebarPanel}
                chatComponent={chatComponent}
                userDetailsPanel={sidePanel}
                particleOverlay={<ParticleOverlay />}
            />
        </UserDetailsContext.Provider>
    );
};

export default MainLayout;