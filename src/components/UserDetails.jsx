import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSupabase } from '../contexts/SupabaseContext';
import { useData } from '../contexts/DataContext';
import { useCall } from '../context/CallContext';
import useAuthStore from '../store/authStore';
import { dpOptions } from '../utils/dpOptions';
import { formatLastSeen, isUserOnline } from '../utils/timeUtils';
import { ArrowLeft, Phone, Video, MessageCircle, Image, Link as LinkIcon, FileText, Bell, BellOff, UserPlus, Share2, Download, Ban, Flag, Trash2, Edit, MoreVertical, X } from 'lucide-react';
import DropdownMenu from './common/DropdownMenu';
import Modal from './common/Modal';
import toast from 'react-hot-toast';
import './user-details/UserDetails.css';

const UserDetails = ({ isModal = false, userId: propUserId, isPanel = false, onClose }) => {
    const { id: paramUserId } = useParams();
    const userId = propUserId || paramUserId;
    const navigate = useNavigate();
    const { supabase } = useSupabase();
    const { refreshContacts } = useData();
    const { startCall } = useCall();
    const queryClient = useQueryClient();
    const currentUser = useAuthStore((state) => state.dbUser);

    // State
    const [user, setUser] = useState(null);
    const [isMuted, setIsMuted] = useState(false);
    const [isContact, setIsContact] = useState(false);
    const [isBlocked, setIsBlocked] = useState(false);
    const [mediaCount, setMediaCount] = useState({ images: 0, links: 0, docs: 0 });
    const [commonGroups, setCommonGroups] = useState([]);
    const [contactName, setContactName] = useState('');
    const [contactPhone, setContactPhone] = useState('');
    const [contactAbout, setContactAbout] = useState('');
    const [contactId, setContactId] = useState(null);

    // Modals
    const [showBlockModal, setShowBlockModal] = useState(false);
    const [showEditContactModal, setShowEditContactModal] = useState(false);
    const [showReportModal, setShowReportModal] = useState(false);
    const [showImageModal, setShowImageModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [reportReason, setReportReason] = useState('');
    const [reportDetails, setReportDetails] = useState('');

    // Fetch user details with caching (30 minutes) - using TanStack Query
    const { data: cachedUser, isLoading: isQueryLoading, isError, error } = useQuery({
        queryKey: ['userDetails', userId, currentUser?.id],
        queryFn: async () => {
            if (!userId || !currentUser) return null;

            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('id', userId)
                .single();

            if (error) throw error;

            // Check if contact name exists for this user
            if (currentUser.id !== userId) {
                const { data: contact } = await supabase
                    .from('contacts')
                    .select('contact_name')
                    .eq('user_id', currentUser.id)
                    .eq('contact_user_id', userId)
                    .maybeSingle();

                if (contact) {
                    return { ...data, contact_name: contact.contact_name };
                }
            }

            return data;
        },
        staleTime: 1000 * 60 * 30, // 30 minutes
        enabled: !!userId && !!currentUser,
    });

    // Update user state when cached data changes
    useEffect(() => {
        if (cachedUser) {
            setUser(cachedUser);
        }
    }, [cachedUser]);

    // Redirect if userId is invalid
    useEffect(() => {
        if (!userId || userId === 'undefined' || userId === 'null') {
            navigate('/');
        }
    }, [userId, navigate]);

    // Load additional data after user is loaded
    useEffect(() => {
        if (!user || !currentUser) return;
        loadAdditionalData(currentUser, userId);
    }, [user, currentUser, userId]);

    // Subscribe to real-time updates for user's online status
    useEffect(() => {
        if (!userId) return;

        const subscription = supabase
            .channel(`user_status_${userId}`)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'users',
                filter: `id=eq.${userId}`
            }, (payload) => {
                const updatedUser = payload.new;
                setUser(prev => ({ ...prev, ...updatedUser }));
                // Update the cached data as well
                queryClient.setQueryData(['userDetails', userId], (oldData) => {
                    return oldData ? { ...oldData, ...updatedUser } : oldData;
                });
            })
            .subscribe();

        return () => {
            supabase.removeChannel(subscription);
        };
    }, [userId, supabase, queryClient]);

    // Real-time online status
    const [currentOnlineStatus, setCurrentOnlineStatus] = useState(null);

    // Update online status from user data
    useEffect(() => {
        if (user) {
            setCurrentOnlineStatus({
                is_online: user.is_online,
                last_seen: user.last_seen
            });
        }
    }, [user]);

    const loadAdditionalData = async (currentUser, userId) => {
        try {
            // Check if muted
            const mutedChats = JSON.parse(localStorage.getItem('mutedChats') || '{}');
            const chatId = [currentUser.id, userId].sort().join('_');
            setIsMuted(!!mutedChats[chatId]);

            // Check contact status
            await checkContactStatus(currentUser.id, userId);

            // Check block status
            await checkBlockStatus(currentUser.id, userId);

            // Load media count
            await loadMediaCount(currentUser.id, userId);

            // Load common groups
            await loadCommonGroups(currentUser.id, userId);
        } catch (error) {
            console.error('Error loading additional data:', error);
        }
    };

    const checkContactStatus = async (currentUserId, targetUserId) => {
        try {
            const { data, error } = await supabase
                .from('contacts')
                .select('id')
                .eq('user_id', currentUserId)
                .eq('contact_user_id', targetUserId)
                .maybeSingle();

            if (error) {
                console.error('Error checking contact status:', error);
                setIsContact(false);
                setContactId(null);
                return;
            }

            if (data) {
                setIsContact(true);
                setContactId(data.id);
            } else {
                setIsContact(false);
                setContactId(null);
            }
        } catch (error) {
            console.error('Error in checkContactStatus function:', error);
        }
    };

    const checkBlockStatus = async (currentUserId, targetUserId) => {
        try {
            const { data, error } = await supabase
                .from('blocked_users')
                .select('blocker_id')
                .eq('blocker_id', currentUserId)
                .eq('blocked_id', targetUserId)
                .limit(1);

            if (error) {
                console.error('Error checking block status:', error);
                setIsBlocked(false); // Assume not blocked on error
                return;
            }

            setIsBlocked(data && data.length > 0);
        } catch (error) {
            console.error('Error in checkBlockStatus function:', error);
        }
    };

    const loadMediaCount = async (currentUserId, targetUserId) => {
        try {
            // Get chat ID
            const { data: chat } = await supabase
                .from('chats')
                .select('id')
                .or(`and(user1_id.eq.${currentUserId},user2_id.eq.${targetUserId}),and(user1_id.eq.${targetUserId},user2_id.eq.${currentUserId})`)
                .single();

            if (!chat) {
                setMediaCount({ images: 0, links: 0, docs: 0 });
                return;
            }

            // Count different types of media messages
            const { data: messages, error: messagesError } = await supabase
                .from('messages')
                .select('message_type, content')
                .eq('chat_id', chat.id);

            if (messagesError) throw messagesError;

            let images = 0, links = 0, docs = 0;

            messages.forEach(msg => {
                if (msg.message_type === 'image') images++;
                else if (msg.message_type === 'document') docs++;
                else if (msg.content && (msg.content.includes('http://') || msg.content.includes('https://'))) links++;
            });

            setMediaCount({ images, links, docs });
        } catch (error) {
            console.error('Error loading media count:', error);
            setMediaCount({ images: 0, links: 0, docs: 0 });
        }
    };

    const loadCommonGroups = async (currentUserId, targetUserId) => {
        try {
            // Get groups the current user is in
            const { data: myGroups, error: myError } = await supabase
                .from('group_members')
                .select('group_id')
                .eq('user_id', currentUserId);

            if (myError) throw myError;

            if (!myGroups || myGroups.length === 0) {
                setCommonGroups([]);
                return;
            }

            const myGroupIds = myGroups.map(g => g.group_id);

            // Get groups the target user is in that overlap with ours
            const { data: theirGroups, error: theirError } = await supabase
                .from('group_members')
                .select('group_id')
                .eq('user_id', targetUserId)
                .in('group_id', myGroupIds);

            if (theirError) throw theirError;

            if (!theirGroups || theirGroups.length === 0) {
                setCommonGroups([]);
                return;
            }

            const commonGroupIds = theirGroups.map(g => g.group_id);

            // Fetch group details
            const { data: groups, error: groupsError } = await supabase
                .from('groups')
                .select('id, name, avatar')
                .in('id', commonGroupIds);

            if (groupsError) throw groupsError;

            setCommonGroups(groups || []);
        } catch (error) {
            console.error('Error loading common groups:', error);
            setCommonGroups([]);
        }
    };

    const getInitials = (name) => {
        return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
    };

    const handleMessage = async () => {
        try {
            if (!currentUser || !user) return;

            // Check if chat exists
            const { data: chat } = await supabase
                .from('chats')
                .select('*')
                .or(`and(user1_id.eq.${currentUser.id},user2_id.eq.${user.id}),and(user1_id.eq.${user.id},user2_id.eq.${currentUser.id})`)
                .single();

            if (chat) {
                navigate(`/chat/${chat.id}/${user.id}`);
            } else {
                // Create new chat
                const newChat = {
                    user1_id: currentUser.id,
                    user2_id: user.id,
                    last_message: null,
                    last_message_time: new Date().toISOString(),
                    unread_count: 0
                };

                const { data, error } = await supabase
                    .from('chats')
                    .insert([newChat])
                    .select();

                if (error) throw error;

                if (data && data[0]) {
                    navigate(`/chat/${data[0].id}/${user.id}`);
                } else {
                    throw new Error('Failed to create chat');
                }
            }
        } catch (error) {
            console.error('Error navigating to chat:', error);
            toast.error('Failed to open chat');
        }
    };

    const handleVoiceCall = async () => {
        try {
            const { callId } = await startCall(user.id, 'voice');
            navigate(`/call/${callId}`);
        } catch (error) {
            console.error('Failed to start voice call:', error);
            toast.error('Failed to start call: ' + error.message);
        }
    };

    const handleVideoCall = async () => {
        try {
            const { callId } = await startCall(user.id, 'video');
            navigate(`/call/${callId}`);
        } catch (error) {
            console.error('Failed to start video call:', error);
            toast.error('Failed to start call: ' + error.message);
        }
    };

    const handleMuteToggle = () => {
        const chatId = [currentUser.id, userId].sort().join('_');
        const mutedChats = JSON.parse(localStorage.getItem('mutedChats') || '{}');

        if (isMuted) {
            delete mutedChats[chatId];
        } else {
            mutedChats[chatId] = true;
        }

        localStorage.setItem('mutedChats', JSON.stringify(mutedChats));
        setIsMuted(!isMuted);
    };

    const handleAddToContacts = async () => {
        try {
            if (!currentUser || !user) return;

            // Check if contact already exists
            const { data: existingContact, error: existingContactError } = await supabase
                .from('contacts')
                .select('id')
                .eq('user_id', currentUser.id)
                .eq('contact_user_id', user.id)
                .maybeSingle();

            if (existingContactError && existingContactError.code !== 'PGRST116') { // PGRST116 is 'Not a single row'
                throw existingContactError;
            }

            if (existingContact) {
                toast.error('Contact already exists');
                return;
            }

            // Add to contacts
            const { error } = await supabase
                .from('contacts')
                .insert([{
                    user_id: currentUser.id,
                    contact_user_id: user.id,
                    contact_name: user.name
                }]);

            if (error) throw error;

            setIsContact(true);
            refreshContacts();
            toast.success('Contact added successfully');
        } catch (error) {
            console.error('Error adding contact:', error);
            toast.error('Failed to add contact');
        }
    };

    const handleShareContact = () => {
        const shareText = `${user.name}\n${user.phone || ''}`;
        if (navigator.share) {
            navigator.share({
                title: 'Share Contact',
                text: shareText
            });
        } else {
            navigator.clipboard.writeText(shareText).then(() => {
                toast.success('Contact info copied');
            });
        }
    };

    const handleExportChat = async () => {
        try {
            if (!currentUser || !user) return;

            // Find chat between current user and this user
            const { data: chat, error: chatError } = await supabase
                .from('chats')
                .select('id')
                .or(`and(user1_id.eq.${currentUser.id},user2_id.eq.${user.id}),and(user1_id.eq.${user.id},user2_id.eq.${currentUser.id})`)
                .single();

            if (chatError || !chat) {
                toast.error('No chat history found with this user');
                return;
            }

            // Get all messages
            const { data: messages, error: messagesError } = await supabase
                .from('messages')
                .select('*')
                .eq('chat_id', chat.id)
                .order('created_at', { ascending: true });

            if (messagesError) throw messagesError;

            if (!messages || messages.length === 0) {
                toast.error('No messages to export');
                return;
            }

            // Format messages for export
            const exportData = messages.map(msg => ({
                timestamp: new Date(msg.created_at).toLocaleString(),
                sender: msg.sender_id === currentUser.id ? 'You' : user.name,
                message: msg.content
            }));

            // Convert to CSV
            const csvContent = [
                ['Timestamp', 'Sender', 'Message'],
                ...exportData.map(row => [row.timestamp, row.sender, row.message])
            ].map(row => row.map(field => `"${field}"`).join(',')).join('\n');

            // Download file
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `chat_${user.name}_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            toast.success('Chat exported successfully!');
        } catch (error) {
            console.error('Error exporting chat:', error);
            toast.error('Failed to export chat');
        }
    };

    const handleEditContact = () => {
        // Check if user is in contacts
        if (!isContact) {
            toast.error('Please add this user to contacts first');
            return;
        }

        // Get contact info from database
        supabase
            .from('contacts')
            .select('*')
            .eq('user_id', currentUser.id)
            .eq('contact_user_id', userId)
            .maybeSingle()
            .then(({ data: contact, error }) => {
                if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
                    console.error('Error fetching contact:', error);
                    toast.error('Failed to load contact info');
                    return;
                }

                // Populate modal with current data
                setContactName(contact?.contact_name || user.name);
                setContactPhone(user.phone || '');
                // Only show about field if editing own profile
                if (currentUser.id === userId) {
                    setContactAbout(user.about || '');
                }

                setShowEditContactModal(true);
            });
    };

    const saveContactEdit = async () => {
        if (!contactName.trim()) {
            toast.error('Name is required');
            return;
        }

        try {
            // Update contact name in contacts table
            if (isContact && contactId) {
                const { error } = await supabase
                    .from('contacts')
                    .update({ contact_name: contactName.trim() })
                    .eq('id', contactId);
                if (error) throw error;
            }

            // If editing own profile, update name/about in users table
            if (currentUser.id === userId) {
                const updateData = { name: contactName.trim() };
                if (contactAbout.trim()) {
                    updateData.about = contactAbout.trim();
                }
                const { error: userError } = await supabase
                    .from('users')
                    .update(updateData)
                    .eq('id', currentUser.id);
                if (userError) throw userError;
            }

            // Update local UI state — only update contact_name, not the actual user.name
            setUser(prevUser => ({
                ...prevUser,
                contact_name: contactName.trim(),
                // Only update actual name/about if editing own profile
                ...(currentUser.id === userId ? {
                    name: contactName.trim(),
                    about: contactAbout.trim()
                } : {})
            }));

            // Invalidate cached query so it re-fetches with new contact_name
            queryClient.invalidateQueries({ queryKey: ['userDetails', userId, currentUser?.id] });

            setShowEditContactModal(false);
            refreshContacts();
            toast.success('Contact updated successfully');
        } catch (error) {
            console.error('Error saving contact:', error);
            toast.error('Failed to update contact.');
        }
    };

    const handleBlockUser = () => {
        if (isBlocked) {
            // Unblock user
            unblockContact();
        } else {
            setShowBlockModal(true);
        }
    };

    const confirmBlock = async () => {
        try {
            const { error } = await supabase
                .from('blocked_users')
                .insert([
                    {
                        blocker_id: currentUser.id,
                        blocked_id: userId
                    }
                ]);

            if (error) throw error;

            setIsBlocked(true);
            setShowBlockModal(false);
            toast.success('Contact blocked');
        } catch (error) {
            console.error('Error blocking contact:', error);
            toast.error('Failed to block contact');
        }
    };

    const unblockContact = async () => {
        try {
            const { error } = await supabase
                .from('blocked_users')
                .delete()
                .eq('blocker_id', currentUser.id)
                .eq('blocked_id', userId);

            if (error) throw error;

            setIsBlocked(false);
            toast.success('Contact unblocked');
        } catch (error) {
            console.error('Error unblocking contact:', error);
            toast.error('Failed to unblock contact');
        }
    };

    const handleReportUser = () => {
        setShowReportModal(true);
    };

    const submitReport = async () => {
        try {
            if (!reportReason.trim()) {
                toast.error('Please select a reason');
                return;
            }

            // Submit to reports table
            const { error } = await supabase
                .from('reports')
                .insert([
                    {
                        reporter_id: currentUser.id,
                        reported_id: userId,
                        reason: reportReason,
                        details: reportDetails
                    }
                ]);

            if (error) throw error;

            setShowReportModal(false);
            setReportReason('');
            setReportDetails('');
            toast.success('Report submitted');
        } catch (error) {
            console.error('Error submitting report:', error);
            toast.error('Failed to submit report');
        }
    };

    const handleDeleteContact = () => {
        setShowDeleteModal(true);
    };

    const confirmDelete = async () => {
        try {
            // 1. Remove from contacts table
            if (isContact) {
                await supabase
                    .from('contacts')
                    .delete()
                    .eq('user_id', currentUser.id)
                    .eq('contact_user_id', user.id);
            }

            // 2. Get chat
            const { data: chat } = await supabase
                .from('chats')
                .select('id')
                .or(`and(user1_id.eq.${currentUser.id},user2_id.eq.${user.id}),and(user1_id.eq.${user.id},user2_id.eq.${currentUser.id})`)
                .maybeSingle();

            if (chat) {
                // 3. Delete only our own messages (RLS only allows sender to delete)
                await supabase
                    .from('messages')
                    .delete()
                    .eq('chat_id', chat.id)
                    .eq('sender_id', currentUser.id);

                // 4. Delete the chat
                await supabase
                    .from('chats')
                    .delete()
                    .eq('id', chat.id);
            }

            setShowDeleteModal(false);
            setIsContact(false);
            setContactId(null);
            refreshContacts();
            toast.success('Contact and chat deleted');
            navigate('/');
        } catch (error) {
            console.error('Error deleting contact:', error);
            toast.error('Failed to delete contact');
        }
    };

    // Loading state - only show loading if query is loading AND no cached data exists yet
    // When data comes from cache (cachedUser exists), don't show loading
    const isLoading = isQueryLoading && !cachedUser && !user;

    if (isLoading) {
        return (
            <div className="user-details-loading">
                <div className="loading-spinner"></div>
                <p>Loading user details...</p>
            </div>
        );
    }

    if (isError) {
        return (
            <div className="user-details-error">
                <p>Error loading user: {error?.message || 'User not found'}</p>
                <button onClick={() => navigate('/')}>Go Back</button>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="user-details-error">
                <p>User not found</p>
                <button onClick={() => navigate('/')}>Go Back</button>
            </div>
        );
    }

    return (
        <div className={`user-details-screen ${isModal ? 'user-details-modal' : ''} ${isPanel ? 'user-details-panel-view' : ''} ${isPanel ? 'panel-slide-in' : ''}`}>
            <header className="user-details-header">
                {isPanel ? (
                    <button className="close-panel-btn" onClick={onClose || (() => navigate(-1))}>
                        <X size={24} />
                    </button>
                ) : (
                    <button className="back-btn" onClick={isModal ? () => navigate('/') : () => navigate(-1)}>
                        <ArrowLeft size={24} />
                    </button>
                )}
                <h1>Contact Info</h1>
                <DropdownMenu
                    trigger={<MoreVertical size={24} />}
                    items={[
                        {
                            icon: <Edit size={16} />,
                            label: 'Edit Contact',
                            onClick: handleEditContact,
                            disabled: !isContact
                        }
                    ]}
                />
            </header>

            <div className="user-profile-section">
                <div className="user-details-avatar" id="userDetailAvatar" onClick={() => user.avatar && setShowImageModal(true)} style={{ cursor: user.avatar ? 'pointer' : 'default' }}>
                    {user.avatar ? (
                        parseInt(user.avatar) ? (
                            <img id="userDetailImg" src={dpOptions.find(dp => dp.id === parseInt(user.avatar))?.path} alt={user.name} />
                        ) : (
                            <img id="userDetailImg" src={user.avatar} alt={user.name} />
                        )
                    ) : (
                        <div className="dp-preview-initials" id="userDetailInitials">{getInitials(user.name)}</div>
                    )}
                </div>
                <h2 className="user-detail-name" id="userDetailName">{user.contact_name || user.name}</h2>
                <p className="user-detail-phone" id="userDetailPhone">{user.phone || '+91 0000000000'}</p>
                <p className="user-detail-status">
                    {isUserOnline(Boolean(currentOnlineStatus?.is_online), currentOnlineStatus?.last_seen || user.last_seen) ? 'Online' : `Last seen ${formatLastSeen(currentOnlineStatus?.last_seen || user.last_seen)}`}
                </p>
            </div>

            <div className="user-actions">
                <button className="action-btn" id="messageUserBtn" onClick={handleMessage}>
                    <MessageCircle size={24} />
                    <span>Message</span>
                </button>
                <button className="action-btn" id="voiceCallUserBtn" onClick={handleVoiceCall}>
                    <Phone size={24} />
                    <span>Call</span>
                </button>
                <button className="action-btn" id="videoCallUserBtn" onClick={handleVideoCall}>
                    <Video size={24} />
                    <span>Video</span>
                </button>
            </div>

            <div className="user-info-sections">
                <div className="info-section">
                    <h3 className="section-header">Media, Links, and Docs</h3>
                    <div className="media-preview">
                        <div className="media-item">
                            <Image className="icon" size={20} />
                            <span className="count" id="mediaCount">{mediaCount.images}</span>
                        </div>
                        <div className="media-item">
                            <LinkIcon className="icon" size={20} />
                            <span className="count" id="linksCount">{mediaCount.links}</span>
                        </div>
                        <div className="media-item">
                            <FileText className="icon" size={20} />
                            <span className="count" id="docsCount">{mediaCount.docs}</span>
                        </div>
                    </div>
                </div>

                <div className="info-section">
                    <div className="settings-item toggle-item">
                        <div className="item-left">
                            <BellOff className="icon" size={20} />
                            <span className="label">Mute Notifications</span>
                        </div>
                        <label className="toggle-switch">
                            <input type="checkbox" id="muteUserToggle" checked={isMuted} onChange={handleMuteToggle} />
                            <span className="toggle-slider"></span>
                        </label>
                    </div>
                </div>

                <div className="info-section">
                    {!isContact && (
                        <div className="settings-item" id="addToContactsBtn" onClick={handleAddToContacts}>
                            <div className="item-left">
                                <UserPlus className="icon" size={20} />
                                <span className="label">Add to Contacts</span>
                            </div>
                        </div>
                    )}

                    <div className="settings-item" id="shareContactBtn" onClick={handleShareContact}>
                        <div className="item-left">
                            <Share2 className="icon" size={20} />
                            <span className="label">Share Contact</span>
                        </div>
                    </div>

                    <div className="settings-item" id="exportChatBtn" onClick={handleExportChat}>
                        <div className="item-left">
                            <Download className="icon" size={20} />
                            <span className="label">Export Chat</span>
                        </div>
                    </div>
                </div>

                <div className="info-section" id="groupsSection">
                    <h3 className="section-header">Groups in Common</h3>
                    <div id="commonGroups">
                        {commonGroups.length > 0 ? (
                            commonGroups.map(group => (
                                <div key={group.id} className="settings-item" onClick={() => navigate(`/group/${group.id}`)}>
                                    <div className="item-left">
                                        <div className="group-avatar-small">
                                            {group.avatar ? (
                                                <img src={group.avatar} alt={group.name} />
                                            ) : (
                                                <span>{getInitials(group.name)}</span>
                                            )}
                                        </div>
                                        <span className="label">{group.name}</span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="no-data">No groups in common</p>
                        )}
                    </div>
                </div>

                <div className="info-section danger-section">
                    <div className="settings-item danger" id="blockContactBtn" onClick={handleBlockUser}>
                        <div className="item-left">
                            <Ban className="icon" size={20} />
                            <span className="label">{isBlocked ? 'Unblock Contact' : 'Block Contact'}</span>
                        </div>
                    </div>

                    <div className="settings-item danger" id="reportContactBtn" onClick={handleReportUser}>
                        <div className="item-left">
                            <Flag className="icon" size={20} />
                            <span className="label">Report Contact</span>
                        </div>
                    </div>

                    <div className="settings-item danger" id="deleteContactBtn" onClick={handleDeleteContact}>
                        <div className="item-left">
                            <Trash2 className="icon" size={20} />
                            <span className="label">Delete Chat & Contact</span>
                        </div>
                    </div>
                </div>

            </div>

            <Modal
                isOpen={showBlockModal}
                onClose={() => setShowBlockModal(false)}
                title="Block Contact"
                size="small"
            >
                <div className="modal-content-text">
                    <p>Block {user.name}?</p>
                    <p className="warning-text">Blocked contacts will no longer be able to call you or send you messages.</p>
                    <div className="modal-actions">
                        <button className="btn-secondary" onClick={() => setShowBlockModal(false)}>
                            Cancel
                        </button>
                        <button className="btn-danger" onClick={confirmBlock}>
                            Block
                        </button>
                    </div>
                </div>
            </Modal>

            <Modal
                isOpen={showEditContactModal}
                onClose={() => setShowEditContactModal(false)}
                title="Edit Contact"
                size="small"
            >
                <div className="edit-contact-form">
                    <div className="input-group">
                        <label>Contact Name</label>
                        <input
                            type="text"
                            value={contactName}
                            onChange={(e) => setContactName(e.target.value)}
                            placeholder="Enter name"
                        />
                    </div>
                    <div className="modal-actions">
                        <button className="btn-secondary" onClick={() => setShowEditContactModal(false)}>
                            Cancel
                        </button>
                        <button className="btn-primary" onClick={saveContactEdit}>
                            Save
                        </button>
                    </div>
                </div>
            </Modal>

            <Modal
                isOpen={showReportModal}
                onClose={() => setShowReportModal(false)}
                title="Report Contact"
                size="small"
            >
                <div className="report-form">
                    <p>Why are you reporting this contact?</p>
                    <div className="report-reasons">
                        <label className="report-reason-item">
                            <input
                                type="radio"
                                name="report"
                                value="spam"
                                checked={reportReason === 'spam'}
                                onChange={(e) => setReportReason(e.target.value)}
                            />
                            <span>Spam</span>
                        </label>
                        <label className="report-reason-item">
                            <input
                                type="radio"
                                name="report"
                                value="harassment"
                                checked={reportReason === 'harassment'}
                                onChange={(e) => setReportReason(e.target.value)}
                            />
                            <span>Harassment</span>
                        </label>
                        <label className="report-reason-item">
                            <input
                                type="radio"
                                name="report"
                                value="inappropriate"
                                checked={reportReason === 'inappropriate'}
                                onChange={(e) => setReportReason(e.target.value)}
                            />
                            <span>Inappropriate Content</span>
                        </label>
                        <label className="report-reason-item">
                            <input
                                type="radio"
                                name="report"
                                value="other"
                                checked={reportReason === 'other'}
                                onChange={(e) => setReportReason(e.target.value)}
                            />
                            <span>Other</span>
                        </label>
                    </div>
                    <div className="modal-actions">
                        <button className="btn-secondary" onClick={() => setShowReportModal(false)}>
                            Cancel
                        </button>
                        <button className="btn-danger" onClick={submitReport}>
                            Report
                        </button>
                    </div>
                </div>
            </Modal>

            <Modal
                isOpen={showImageModal}
                onClose={() => setShowImageModal(false)}
                title="Image"
                size="large"
                bodyClassName="image-modal-body"
            >
                <div className="image-modal-content">
                    {user.avatar && (
                        <img
                            src={parseInt(user.avatar) ? dpOptions.find(dp => dp.id === parseInt(user.avatar))?.path : user.avatar}
                            alt={user.name}
                            className="full-screen-image"
                            onClick={() => setShowImageModal(false)}
                        />
                    )}
                </div>
            </Modal>

            <Modal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                title="Delete Chat"
                size="small"
            >
                <div className="modal-content-text">
                    <p>Delete chat and contact with {user.name}?</p>
                    <p className="warning-text">This will remove this contact and delete your messages. This cannot be undone.</p>
                    <div className="modal-actions">
                        <button className="btn-secondary" onClick={() => setShowDeleteModal(false)}>
                            Cancel
                        </button>
                        <button className="btn-danger" onClick={confirmDelete}>
                            Delete
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default UserDetails;