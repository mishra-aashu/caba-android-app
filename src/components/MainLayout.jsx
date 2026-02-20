import React, { useState, useRef, useCallback, useEffect, Suspense, lazy, createContext, useContext } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useData } from '../contexts/DataContext';
import useIsDesktop from '../hooks/useIsDesktop';
import DesktopLayout from './DesktopLayout';
import ChatListPanel from './ChatListPanel';
import { useSupabase } from '../contexts/SupabaseContext';
import { dpOptions } from '../utils/dpOptions';
import { getInitials } from '../utils/stringUtils';
import toast from 'react-hot-toast';
import BottomNavigation from './common/BottomNavigation';
import ChatPlaceholder from './common/ChatPlaceholder';
import ParticleOverlay from './chat/ParticleOverlay';
import '../styles/theme.css';

// Create context for user-details panel
export const UserDetailsContext = createContext(null);

// Lazy load UserDetails for desktop side panel
const UserDetails = lazy(() => import('./UserDetails'));

const MainLayout = () => {
    const { user, session } = useAuth();
    const { supabase } = useSupabase();
    const navigate = useNavigate();
    const location = useLocation();
    const isDesktop = useIsDesktop();
    const { chats, loading, hasMoreChats, loadingMore, loadMoreChats, setChats } = useData();

    const [searchTerm, setSearchTerm] = useState('');
    const [showSearch, setShowSearch] = useState(false);
    const [searchSuggestions, setSearchSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [showNewContactModal, setShowNewContactModal] = useState(false);
    const [savedContacts, setSavedContacts] = useState([]);
    const [showContactForm, setShowContactForm] = useState(false);
    const [showSelectContact, setShowSelectContact] = useState(false);
    const [contactName, setContactName] = useState('');
    const [contactPhone, setContactPhone] = useState('');
    const [contactMenuOpen, setContactMenuOpen] = useState(null);
    const [isChatViewActive, setIsChatViewActive] = useState(false);

    // State for user-details panel - keeps Chat mounted!
    const [showUserDetailsPanel, setShowUserDetailsPanel] = useState(false);
    const [userDetailsTargetId, setUserDetailsTargetId] = useState(null);

    const chatListRef = useRef();

    const currentChatId = location.pathname.startsWith('/chat/') ? location.pathname.split('/')[2] : null;

    useEffect(() => {
        setIsChatViewActive(
            location.pathname.startsWith('/chat/') ||
            location.pathname.startsWith('/user-details/') ||
            location.pathname === '/groups'
        );
    }, [location]);


    const fetchContacts = useCallback(async () => {
        if (!user) return;
        try {
            const { data, error } = await supabase
                .from('contacts')
                .select(`
                    id,
                    user_id,
                    contact_user_id,
                    contact_name,
                    is_favorite,
                    created_at,
                    otherUser:users!contacts_contact_user_id_fkey(id, name, phone, avatar, is_online)
                `)
                .eq('user_id', user.id);
            if (error) throw error;
            setSavedContacts(data || []);
        } catch (error) {
            console.error('Error fetching contacts:', error);
            toast.error('Could not fetch contacts.');
        }
    }, [supabase, user]);

    useEffect(() => {
        fetchContacts();
    }, [fetchContacts]);

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
            setSavedContacts(prev => [...prev, data[0]]);
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
        if (!chat || !chat.otherUser) return;

        // If it's a group, navigate to group chat with state for instant header
        if (chat.isGroup || chat.chatType === 'group') {
            navigate(`/chat/${chat.id}/group`, {
                state: {
                    groupName: chat.otherUser.name || 'Group Chat',
                    groupAvatar: chat.otherUser.avatar || null,
                    memberCount: chat.otherUser.member_count || 0,
                }
            });
        } else {
            // Regular 1-on-1 chat
            navigate(`/chat/${chat.id}/${chat.otherUser.id}`);
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

    const filteredChats = showSearch
        ? chats
        : chats.filter(chat =>
            chat.otherUser?.name.toLowerCase().includes(searchTerm.toLowerCase())
        );

    const chatListPanelProps = {
        searchTerm,
        setSearchTerm,
        showSearch,
        setShowSearch,
        searchSuggestions,
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
        formatTime: (time) => new Date(time).toLocaleTimeString(),
        setShowNewContactModal,
        currentUser: user,
        handleNavigation,
        handleAboutApp: () => navigate('/about'),
        handleHelp: () => alert('Help'),
        handleLogout,
        isAdmin: false,
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

    if (loading) {
        return (
            <div className="loading">
                <div className="loading-spinner"></div>
                <p>Loading Chats...</p>
            </div>
        );
    }

    if (!isDesktop) {
        return (
            <div className={`mobile-layout ${isChatViewActive ? 'show-chat' : ''} pb-safe`}>
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

    // Callback function to show user-details panel - keeps Chat mounted!
    const handleShowUserDetails = (userId) => {
        if (isDesktop) {
            setUserDetailsTargetId(userId);
            setShowUserDetailsPanel(true);
        } else {
            // Mobile: navigate to full page
            navigate(`/user-details/${userId}`);
        }
    };

    const handleCloseUserDetails = () => {
        setShowUserDetailsPanel(false);
        setUserDetailsTargetId(null);
    };

    // Check if user-details route is active (for mobile)
    const isUserDetailsRoute = location.pathname.startsWith('/user-details/');
    const userDetailsUserId = isUserDetailsRoute ? location.pathname.split('/user-details/')[1] : null;

    // Desktop: use state-based panel (Chat stays mounted)
    // Mobile: use route-based full page
    const userDetailsPanel = isDesktop && showUserDetailsPanel && userDetailsTargetId ? (
        <Suspense fallback={<div className="loading"><div className="loading-spinner"></div></div>}>
            <UserDetails userId={userDetailsTargetId} isPanel={true} onClose={handleCloseUserDetails} />
        </Suspense>
    ) : null;

    // For mobile, render UserDetails in Outlet when on user-details route
    const mobileUserDetails = !isDesktop && isUserDetailsRoute && userDetailsUserId ? (
        <Suspense fallback={<div className="loading"><div className="loading-spinner"></div></div>}>
            <UserDetails userId={userDetailsUserId} />
        </Suspense>
    ) : null;

    // Always render Outlet - Chat component stays mounted on desktop!
    // On mobile, Outlet renders Chat or UserDetails based on route
    const chatComponent = mobileUserDetails || (
        <UserDetailsContext.Provider value={handleShowUserDetails}>
            <Outlet />
        </UserDetailsContext.Provider>
    );

    return (
        <DesktopLayout
            chatListPanel={<ChatListPanel {...chatListPanelProps} />}
            chatComponent={chatComponent}
            userDetailsPanel={userDetailsPanel}
            particleOverlay={<ParticleOverlay />}
        />
    );
};

export default MainLayout;
