import React, { useState, useRef, useCallback, useEffect, useMemo, Suspense, lazy, createContext, useContext } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { useChatListRealtime } from '../hooks/useChatListRealtime';
import { useContacts } from '../hooks/useCommonQueries';
import useIsDesktop from '../hooks/useIsDesktop';
// lazy loaded below
import { useSupabase } from '../contexts/SupabaseContext';
import { dpOptions } from '../utils/dpOptions';
import { getInitials } from '../utils/stringUtils';
import toast from 'react-hot-toast';
import { useDialog } from '../contexts/DialogContext';
import BottomNavigation from './common/BottomNavigation';
import ChatPlaceholder from './common/ChatPlaceholder';
import ParticleOverlay from './chat/ParticleOverlay';
import PageTransition from './common/PageTransition';
import { formatTime } from '../utils/dateFormatter';


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
    const { user, dbUser, session } = useAuth();
    const { supabase } = useSupabase();
    const { showAlert } = useDialog();
    const navigate = useNavigate();
    const location = useLocation();
    const isDesktop = useIsDesktop();
    const queryClient = useQueryClient();

    const [isHandlingSidePanel, setIsHandlingSidePanel] = useState(false);
    
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

    const currentChatId = location.pathname.startsWith('/chat/') ? location.pathname.split('/')[2] : null;

    const handleChatClick = (chat) => {
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
    };

    // Simplified chatListPanelProps - only passing what's necessary for root control
    const chatListPanelProps = {
        handleChatClick,
        isDesktop,
        currentChatId,
        user
    };

    if (!isDesktop) {
        return (
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
                            exit={{ opacity: 0 }}
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
                            <Outlet />
                        </PageTransition>
                    )}
                </AnimatePresence>
            </div>
        )
    }

    // Callback functions to show side panel - keeps Chat mounted!
    const handleShowUserDetails = (userId) => {
        if (isDesktop) {
            setSidePanelType('user');
            setSidePanelTargetId(userId);
        } else {
            // Mobile: navigate to full page
            navigate(`/user-details/${userId}`);
        }
    };

    const handleShowGroupInfo = (groupId, groupData = null) => {
        if (isDesktop) {
            setSidePanelType('group');
            setSidePanelTargetId(groupId);
            setSidePanelData(groupData);
        } else {
            // Mobile: navigate to full page
            navigate(`/chat/${groupId}/group/info`);
        }
    };

    const handleCloseSidePanel = () => {
        setSidePanelType(null);
        setSidePanelTargetId(null);
        setSidePanelData(null);
    };

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

    // Desktop: If on contacts or profile route, don't show specific page in the main area (it's in the sidebar)
    const isContactsRoute = location.pathname === '/contacts';
    const isProfileRoute = location.pathname === '/profile';
    const isSettingsRoute = location.pathname === '/settings' || location.pathname.startsWith('/settings/');
    const isSecuritySettingsRoute = location.pathname === '/settings/security';
    const isHelpCenterRoute = location.pathname === '/settings/help';
    const isTermsRoute = location.pathname === '/terms';
    const isPrivacyRoute = location.pathname === '/privacy';
    const isBlockedRoute = location.pathname === '/blocked';
    const isSupportRoute = location.pathname === '/support';
    const isEmojiSettingsRoute = location.pathname === '/emoji-settings';
    const isHistoryRoute = location.pathname === '/history';
    const isGamesRoute = location.pathname === '/games';

    // Always render Outlet - Chat component stays mounted on desktop!
    // On mobile, Outlet renders Chat or UserDetails based on route
    const chatComponent = mobileUserDetails || (
        <UserDetailsContext.Provider value={{ showUserDetails: handleShowUserDetails, showGroupInfo: handleShowGroupInfo }}>
            {isDesktop && (isContactsRoute || isProfileRoute || isSettingsRoute || isEmojiSettingsRoute || isHistoryRoute || isTermsRoute || isPrivacyRoute || isBlockedRoute || isSupportRoute || isGamesRoute) ? <ChatPlaceholder /> : <Outlet />}
        </UserDetailsContext.Provider>
    );

    const sidebarPanel = (
        <Sidebar
            isDesktop={isDesktop}
            isContactsRoute={isContactsRoute}
            isProfileRoute={isProfileRoute}
            isSettingsRoute={isSettingsRoute}
            isSecuritySettingsRoute={isSecuritySettingsRoute}
            isHelpCenterRoute={isHelpCenterRoute}
            isTermsRoute={isTermsRoute}
            isPrivacyRoute={isPrivacyRoute}
            isBlockedRoute={isBlockedRoute}
            isSupportRoute={isSupportRoute}
            isEmojiSettingsRoute={isEmojiSettingsRoute}
            isHistoryRoute={isHistoryRoute}
            isGamesRoute={isGamesRoute}
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
