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
import DesktopLayout from './DesktopLayout';
import ChatListPanel from './ChatListPanel';
import { useSupabase } from '../contexts/SupabaseContext';
import { dpOptions } from '../utils/dpOptions';
import { getInitials } from '../utils/stringUtils';
import toast from 'react-hot-toast';
import { useDialog } from '../contexts/DialogContext';
import BottomNavigation from './common/BottomNavigation';
import ChatPlaceholder from './common/ChatPlaceholder';
import ParticleOverlay from './chat/ParticleOverlay';
import { formatTime } from '../utils/dateFormatter';


// Create context for user-details panel
import { UserDetailsContext } from '../contexts/UserDetailsContext';

// Lazy load UserDetails and GroupInfoDrawer for desktop side panel
const UserDetails = lazy(() => import('./UserDetails'));
const GroupInfoDrawer = lazy(() => import('./groups/GroupInfoDrawer'));
import ContactsPage from './contacts/ContactsPage';
import Sidebar from './layout/Sidebar';

const MainLayout = () => {
    const { user, dbUser, session } = useAuth();
    const { supabase } = useSupabase();
    const { showAlert } = useDialog();
    const navigate = useNavigate();
    const location = useLocation();
    const isDesktop = useIsDesktop();
    const queryClient = useQueryClient();

    const chats = useLiveQuery(() => db.chats_list.toArray(), []) || [];
    const savedContacts = useLiveQuery(() => db.contacts.toArray(), []) || [];

    const { loading, hasMoreChats, loadingMore, loadMoreChats } = useChatListRealtime(user?.id);
    const { refetch: refreshContacts } = useContacts(user?.id);

    const [searchTerm, setSearchTerm] = useState('');
    const [showSearch, setShowSearch] = useState(false);
    const [searchSuggestions, setSearchSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [showNewContactModal, setShowNewContactModal] = useState(false);
    const [showContactForm, setShowContactForm] = useState(false);
    const [showSelectContact, setShowSelectContact] = useState(false);
    const [contactName, setContactName] = useState('');
    const [contactPhone, setContactPhone] = useState('');
    const [contactMenuOpen, setContactMenuOpen] = useState(null);
    // Derived state directly from location to prevent 1-frame layout shifts during navigation
    const isChatViewActive = useMemo(() =>
        location.pathname.startsWith('/chat/') ||
        location.pathname.startsWith('/user-details/') ||
        location.pathname === '/groups' ||
        location.pathname === '/contacts' ||
        location.pathname === '/profile' ||
        location.pathname === '/settings' ||
        location.pathname === '/emoji-settings' ||
        location.pathname === '/history',
        [location.pathname]);

    // State for side panel (user or group details) - keeps Chat mounted!
    const [sidePanelType, setSidePanelType] = useState(null); // 'user' or 'group'
    const [sidePanelTargetId, setSidePanelTargetId] = useState(null);
    const [sidePanelData, setSidePanelData] = useState(null); // Optional extra data (like group name)

    const chatListRef = useRef();

    const currentChatId = location.pathname.startsWith('/chat/') ? location.pathname.split('/')[2] : null;


    // Contacts are now managed by DataContext and cached via TanStack Query
    // No need to force refresh on every layout mount as it causes redundant network requests

    const handleSaveContact = async () => {
        if (!contactName.trim() || !contactPhone.trim()) {
            return toast.error('Name and phone are required.');
        }
        if (!/^\d{10}$/.test(contactPhone)) {
            return toast.error('Please enter a valid 10-digit phone number.');
        }

        try {
            const { data: existingUser, error: userError } = await supabase
                .from('users')
                .select('id')
                .eq('phone', contactPhone)
                .single();

            if (userError || !existingUser) {
                return toast.error('No user found with this phone number.');
            }

            const { data, error } = await supabase
                .from('contacts')
                .insert([{
                    user_id: user.id,
                    contact_name: contactName,
                    contact_user_id: existingUser.id
                }])
                .select();

            if (error) throw error;

            toast.success('Contact saved!');
            queryClient.invalidateQueries({ queryKey: ['contacts', user.id] });
            refreshContacts(); // Refresh global contacts
            setContactName('');
            setContactPhone('');
            setShowContactForm(false);

        } catch (error) {
            console.error('Error saving contact:', error);
            if (error.code === '23505') {
                toast.error('You have already saved this contact.');
            } else {
                toast.error('Could not save contact.');
            }
        }
    };

    const handleStartChatWithContact = async (contact) => {
        if (!contact.contact_user_id) {
            return toast.error("This contact can't be messaged.");
        }

        try {
            const { data: chat, error: chatError } = await supabase
                .from('chats')
                .select('id')
                .or(`and(user1_id.eq.${user.id},user2_id.eq.${contact.contact_user_id}),and(user1_id.eq.${contact.contact_user_id},user2_id.eq.${user.id})`)
                .single();

            if (chatError && chatError.code !== 'PGRST116') { // PGRST116 means no rows found
                throw chatError;
            }

            if (chat) {
                setShowNewContactModal(false);
                navigate(`/chat/${chat.id}/${contact.contact_user_id}`);
            } else {
                const newChat = { user1_id: user.id, user2_id: contact.contact_user_id };
                const { data: newChatData, error: newChatError } = await supabase
                    .from('chats')
                    .insert([newChat])
                    .select()
                    .single();

                if (newChatError) throw newChatError;

                if (newChatData) {
                    setShowNewContactModal(false);
                    navigate(`/chat/${newChatData.id}/${contact.contact_user_id}`);
                } else {
                    throw new Error('Failed to create chat');
                }
            }
        } catch (error) {
            console.error('Error starting chat:', error);
            toast.error('Could not start chat.');
        }
    }

    const debounceTimeout = useRef(null);

    const handleSearchChange = (e) => {
        const query = e.target.value.replace(/\D/g, '');
        setSearchTerm(query);

        if (debounceTimeout.current) {
            clearTimeout(debounceTimeout.current);
        }

        if (query.length !== 10) {
            setSearchSuggestions([]);
            setShowSuggestions(false);
            return;
        }

        debounceTimeout.current = setTimeout(async () => {
            try {
                const { data, error } = await supabase
                    .from('users')
                    .select('id, name, phone, avatar')
                    .eq('phone', query)
                    .neq('id', user.id)
                    .limit(1);

                if (error) throw error;

                setSearchSuggestions(data || []);
                setShowSuggestions(true);
            } catch (error) {
                console.error('Error searching users:', error);
                toast.error('Failed to search for users.');
            }
        }, 500);
    };

    const handleSuggestionClick = async (suggestedUser) => {
        setSearchTerm('');
        setShowSuggestions(false);
        setShowSearch(false);

        try {
            const { data: chat, error: chatError } = await supabase
                .from('chats')
                .select('id')
                .or(`and(user1_id.eq.${user.id},user2_id.eq.${suggestedUser.id}),and(user1_id.eq.${suggestedUser.id},user2_id.eq.${user.id})`)
                .single();

            if (chatError && chatError.code !== 'PGRST116') {
                throw chatError;
            }

            if (chat) {
                navigate(`/chat/${chat.id}/${suggestedUser.id}`);
            } else {
                const newChat = { user1_id: user.id, user2_id: suggestedUser.id };
                const { data: newChatData, error: newChatError } = await supabase
                    .from('chats')
                    .insert([newChat])
                    .select()
                    .single();

                if (newChatError) throw newChatError;

                if (newChatData) {
                    navigate(`/chat/${newChatData.id}/${suggestedUser.id}`);
                } else {
                    throw new Error('Failed to create chat');
                }
            }
        } catch (error) {
            console.error('Error starting chat from suggestion:', error);
            toast.error('Could not start chat.');
        }
    };

    const handleChatClick = (chat) => {
        if (!chat) return;

        // If it's a group, navigate to group chat with state for instant header
        if (chat.isGroup || chat.chatType === 'group' || chat.type === 'group') {
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

    const handleLogout = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
            console.error('Error logging out:', error);
        } else {
            navigate('/login');
        }
    };

    const handleNavigation = (path) => navigate(path);

    const handleChatListScroll = () => {
        if (chatListRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = chatListRef.current;
            if (scrollTop + clientHeight >= scrollHeight - 500 && hasMoreChats && !loadingMore) {
                loadMoreChats();
            }
        }
    };

    // Filter and sort chats for the list
    const filteredChats = useMemo(() => {
        let result = chats;

        // Apply search if active
        if (searchTerm.trim()) {
            result = chats.filter(chat =>
                chat.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                chat.metadata?.otherUserPhone?.includes(searchTerm)
            );
        }

        // Always sort by timestamp (newest first)
        return [...result].sort((a, b) => {
            const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
            const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
            return timeB - timeA;
        });
    }, [chats, searchTerm]);

    const chatListPanelProps = {
        searchTerm,
        setSearchTerm,
        showSearch,
        setShowSearch,
        searchSuggestions,
        setSearchSuggestions,
        showSuggestions,
        setShowSuggestions,
        handleSearchChange,
        handleSuggestionClick,
        handleChatClick,
        filteredChats,
        handleChatListScroll,
        chatListRef,
        loadingMore,
        hasMoreChats,
        dpOptions,
        getInitials,
        formatTime: formatTime,
        setShowNewContactModal: (val) => val ? navigate('/contacts') : navigate('/'),
        currentUser: user,
        handleNavigation,
        handleAboutApp: () => navigate('/about'),
        handleHelp: () => navigate('/support'),
        handleLogout,
        isAdmin: dbUser?.isAdmin || false,
        savedContacts,
        showNewContactModal,
        showContactForm,
        setShowContactForm,
        showSelectContact,
        setShowSelectContact,
        contactName,
        setContactName,
        contactPhone,
        setContactPhone,
        handleSaveContact,
        contactMenuOpen,
        handleContactMenuToggle: () => { },
        handleContactClick: () => { },
        handleEditContact: () => { }, // Placeholder
        handleDeleteContact: () => { },
        handleStartChatWithContact,
        isDesktop,
        currentChatId,
    };

    // Only show full-screen loader on initial data fetch to prevent blinking during route changes
    if (loading && chats.length === 0 && !isChatViewActive) {
        return (
            <div className="loading-container glass" style={{ backfaceVisibility: 'hidden', transform: 'translateZ(0)' }}>
                <div className="loading-spinner"></div>
                <p>Loading Your Experience...</p>
            </div>
        );
    }

    if (!isDesktop) {
        return (
            <div className={`mobile-layout ${isChatViewActive ? 'show-chat' : ''}`}>
                <div className="list-view">
                    <ChatListPanel {...chatListPanelProps} />
                </div>
                <div className="chat-view">
                    <Outlet />
                </div>
                {!isChatViewActive && <BottomNavigation />}
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
    const isSettingsRoute = location.pathname === '/settings';
    const isEmojiSettingsRoute = location.pathname === '/emoji-settings';
    const isHistoryRoute = location.pathname === '/history';

    // Always render Outlet - Chat component stays mounted on desktop!
    // On mobile, Outlet renders Chat or UserDetails based on route
    const chatComponent = mobileUserDetails || (
        <UserDetailsContext.Provider value={{ showUserDetails: handleShowUserDetails, showGroupInfo: handleShowGroupInfo }}>
            {isDesktop && (isContactsRoute || isProfileRoute || isSettingsRoute || isEmojiSettingsRoute || isHistoryRoute) ? <ChatPlaceholder /> : <Outlet />}
        </UserDetailsContext.Provider>
    );

    const sidebarPanel = (
        <Sidebar
            isDesktop={isDesktop}
            isContactsRoute={isContactsRoute}
            isProfileRoute={isProfileRoute}
            isSettingsRoute={isSettingsRoute}
            isEmojiSettingsRoute={isEmojiSettingsRoute}
            isHistoryRoute={isHistoryRoute}
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
