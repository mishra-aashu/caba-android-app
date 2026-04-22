import React, { useState, useCallback, useMemo, Suspense, lazy } from 'react';
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

// Create context for user-details panel
import { UserDetailsContext } from '../contexts/UserDetailsContext';

// Lazy load UserDetails and GroupInfoDrawer for desktop side panel
const UserDetails = lazy(() => import('./UserDetails'));
const GroupInfoDrawer = lazy(() => import('./groups/GroupInfoDrawer'));
const Sidebar = lazy(() => import('./layout/Sidebar'));
const ChatListPanel = lazy(() => import('./ChatListPanel'));
const DesktopLayout = lazy(() => import('./DesktopLayout'));
const ContactsPage = lazy(() => import('./contacts/ContactsPage'));

const MainLayout = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const isDesktop = useIsDesktop();
    
    // ─── GLOBAL SYNC & QUEUE PROCESSING ───
    React.useEffect(() => {
        if (!user?.id) return;

        // 1. Initial catch-up on mount
        syncService.performGlobalSync(user.id);
        processSyncQueue();

        // 2. Network reconnection sync
        const handleOnline = () => {
            syncService.performGlobalSync(user.id);
            processSyncQueue();
        };
        window.addEventListener('online', handleOnline);

        // 3. Browser tab focus recovery (web / Android Chrome)
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                syncService.performGlobalSync(user.id);
                processSyncQueue();
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);

        // 4. Capacitor native app foreground (Android/iOS home button / app switcher)
        let capacitorAppListener = null;
        const setupCapacitorSync = async () => {
            try {
                const { App } = await import('@capacitor/app');
                capacitorAppListener = await App.addListener('appStateChange', ({ isActive }) => {
                    if (isActive) {
                        syncService.performGlobalSync(user.id);
                        processSyncQueue();
                    }
                });
            } catch {
                // Not a Capacitor environment — ignore
            }
        };
        setupCapacitorSync();

        return () => {
            window.removeEventListener('online', handleOnline);
            document.removeEventListener('visibilitychange', handleVisibility);
            if (capacitorAppListener) capacitorAppListener.remove();
        };
    }, [user?.id]);

    // State from store
    const activeChat = useChatStore(state => state.activeChat);
    const setActiveChat = useChatStore(state => state.setActiveChat);
    const clearActiveChat = useChatStore(state => state.clearActiveChat);

    // Derived state from store + location
    const isChatViewActive = useMemo(() =>
        activeChat !== null ||
        location.pathname.startsWith('/user-details/') ||
        location.pathname === '/groups' ||
        location.pathname === '/contacts' ||
        location.pathname.startsWith('/settings/') ||
        location.pathname === '/profile' ||
        location.pathname === '/terms' ||
        location.pathname === '/privacy' ||
        location.pathname === '/blocked' ||
        location.pathname === '/support' ||
        location.pathname === '/emoji-settings' ||
        location.pathname === '/history' ||
        location.pathname === '/games',
        [location.pathname, activeChat]);

    const isSubPage = useMemo(() => activeChat !== null || location.pathname !== '/', [location.pathname, activeChat]);

    // State for side panel (user or group details)
    const [sidePanelType, setSidePanelType] = useState(null); 
    const [sidePanelTargetId, setSidePanelTargetId] = useState(null);
    const [sidePanelData, setSidePanelData] = useState(null);

    const currentChatId = activeChat?.id;

    const handleChatClick = useCallback((chat) => {
        if (!chat) return;
        setActiveChat(chat);
    }, [setActiveChat]);

    // Simplified chatListPanelProps - only passing what's necessary for root control
    const chatListPanelProps = useMemo(() => ({
        handleChatClick,
        isDesktop,
        currentChatId,
        user
    }), [handleChatClick, isDesktop, currentChatId, user]);

    // Callback functions to show side panel - keeps Chat mounted!
    const handleShowUserDetails = useCallback((userId) => {
        if (isDesktop) {
            setSidePanelType('user');
            setSidePanelTargetId(userId);
        } else {
            // Mobile: navigate to full page
            navigate(`/user-details/${userId}`);
        }
    }, [isDesktop, navigate]);

    const handleShowGroupInfo = useCallback((groupId, groupData = null) => {
        if (isDesktop) {
            setSidePanelType('group');
            setSidePanelTargetId(groupId);
            setSidePanelData(groupData);
        } else {
            // Mobile: navigate to full page
            navigate(`/chat/${groupId}/group/info`);
        }
    }, [isDesktop, navigate]);

    const handleCloseSidePanel = useCallback(() => {
        setSidePanelType(null);
        setSidePanelTargetId(null);
        setSidePanelData(null);
    }, []);

    // Check if user-details route is active (for mobile)
    const isUserDetailsRoute = location.pathname.startsWith('/user-details/');
    const userDetailsUserId = isUserDetailsRoute ? location.pathname.split('/user-details/')[1] : null;

    // Desktop side panel content
    const sidePanel = isDesktop && sidePanelType && sidePanelTargetId ? (
        <Suspense fallback={<div className="loading"><div className="loading-spinner"></div></div>}>
            {sidePanelType === 'user' ? (
                <UserDetails userId={sidePanelTargetId} isPanel={true} onClose={handleCloseSidePanel} />
            ) : (
                <GroupInfoDrawer
                    isOpen={true}
                    onClose={handleCloseSidePanel}
                    group={sidePanelData || { id: sidePanelTargetId }}
                />
            )}
        </Suspense>
    ) : null;

    // For mobile, render UserDetails in Outlet when on user-details route
    const mobileUserDetails = !isDesktop && isUserDetailsRoute && userDetailsUserId ? (
        <Suspense fallback={<div className="loading"><div className="loading-spinner"></div></div>}>
            <UserDetails userId={userDetailsUserId} />
        </Suspense>
    ) : null;

    // Route checks - Desktop doesn't show specific pages in the main area (it's in the sidebar)
    const overlayRoutes = useMemo(() => new Set([
        '/contacts', '/profile', '/settings', '/settings/security', 
        '/settings/devices', '/settings/help', '/terms', '/privacy', 
        '/blocked', '/support', '/emoji-settings', '/history', '/games'
    ]), []);

    const isOverlayRoute = useMemo(() => 
        overlayRoutes.has(location.pathname) || 
        location.pathname.startsWith('/settings/'), 
    [location.pathname, overlayRoutes]);

    const userDetailsContextValue = useMemo(() => ({
        showUserDetails: handleShowUserDetails,
        showGroupInfo: handleShowGroupInfo
    }), [handleShowUserDetails, handleShowGroupInfo]);

    if (!isDesktop) {
        return (
            <UserDetailsContext.Provider value={userDetailsContextValue}>
                <div className="mobile-layout">
                    <motion.div 
                        className="list-view"
                        animate={{ 
                            filter: isChatViewActive ? 'brightness(0.9)' : 'brightness(1)',
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
                                    background: 'var(--bg-color)'
                                }}
                            />
                        )}
                    </AnimatePresence>

                    <AnimatePresence mode="wait">
                        {isSubPage && (
                            <PageTransition key={activeChat?.id || location.pathname} className="chat-view">
                                <Suspense fallback={<div className="loading"><div className="loading-spinner"></div></div>}>
                                    {mobileUserDetails || (activeChat ? <ChatScreen /> : <Outlet />)}
                                </Suspense>
                            </PageTransition>
                        )}
                    </AnimatePresence>
                </div>
            </UserDetailsContext.Provider>
        )
    }

    // Always render Outlet - Chat component stays mounted on desktop!
    // On mobile, Outlet renders Chat or UserDetails based on route
    const chatComponent = (
        <UserDetailsContext.Provider value={userDetailsContextValue}>
            <Suspense fallback={<div className="loading"><div className="loading-spinner"></div></div>}>
                {isDesktop && isOverlayRoute ? <ChatPlaceholder /> : (activeChat ? <ChatScreen /> : <Outlet />)}
            </Suspense>
        </UserDetailsContext.Provider>
    );

    const sidebarPanel = (
        <Sidebar
            isDesktop={isDesktop}
            isContactsRoute={location.pathname === '/contacts'}
            isProfileRoute={location.pathname === '/profile'}
            isSettingsRoute={location.pathname === '/settings' || location.pathname.startsWith('/settings/')}
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
    );

    return (
        <DesktopLayout
            chatListPanel={sidebarPanel}
            chatComponent={chatComponent}
            userDetailsPanel={sidePanel}
            particleOverlay={<ParticleOverlay />}
        />
    );
};

export default MainLayout;
