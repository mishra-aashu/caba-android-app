import React, { useState, useCallback, useMemo, Suspense, lazy } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import useIsDesktop from '../hooks/useIsDesktop';

import BottomNavigation from './common/BottomNavigation';
import ChatPlaceholder from './common/ChatPlaceholder';
import ParticleOverlay from './chat/ParticleOverlay';
import PageTransition from './common/PageTransition';

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
    
    // Derived state directly from location to prevent 1-frame layout shifts during navigation
    const isChatViewActive = useMemo(() =>
        location.pathname.startsWith('/chat/') ||
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
        location.pathname === '/history',
        [location.pathname]);

    const isSubPage = useMemo(() => location.pathname !== '/', [location.pathname]);

    // State for side panel (user or group details)
    const [sidePanelType, setSidePanelType] = useState(null); 
    const [sidePanelTargetId, setSidePanelTargetId] = useState(null);
    const [sidePanelData, setSidePanelData] = useState(null);

    const currentChatId = useMemo(() => 
        location.pathname.startsWith('/chat/') ? location.pathname.split('/')[2] : null,
    [location.pathname]);

    const handleChatClick = useCallback((chat) => {
        if (!chat) return;

        // More robust group detection
        const isGroup = chat.isGroup || 
                       chat.chatType === 'group' || 
                       chat.type === 'group' || 
                       chat.group_id !== undefined;

        if (isGroup) {
            navigate(`/chat/${chat.id}/group`, {
                state: {
                    groupName: chat.name || 'Group Chat',
                    groupAvatar: chat.avatar || null,
                    memberCount: chat.member_count || 0,
                }
            });
        } else {
            // Regular 1-on-1 chat
            const otherUserId = chat.metadata?.otherUserId;
            if (otherUserId) {
                navigate(`/chat/${chat.id}/${otherUserId}`);
            } else {
                console.error('Could not find other user ID for chat:', chat);
            }
        }
    }, [navigate]);

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
                            <PageTransition key={location.pathname} className="chat-view">
                                <Suspense fallback={<div className="loading"><div className="loading-spinner"></div></div>}>
                                    {mobileUserDetails || <Outlet />}
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
                {isDesktop && isOverlayRoute ? <ChatPlaceholder /> : <Outlet />}
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
