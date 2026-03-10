import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSupabase } from '../contexts/SupabaseContext';
import { useData } from '../contexts/DataContext';
import { useUserFullProfile } from '../hooks/useUserFullProfile';
import { useCall } from '../contexts/CallContext';
import useAuthStore from '../store/authStore';
import { dpOptions } from '../utils/dpOptions';
import { formatLastSeen, isUserOnline } from '../utils/dateFormatter';
import { useResolveName } from '../hooks/useResolveName';
import { ArrowLeft, Phone, Video, MessageCircle, Image, Link as LinkIcon, FileText, Bell, BellOff, UserPlus, Share2, Download, Ban, Flag, Trash2, Edit, MoreVertical, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import DropdownMenu from './common/DropdownMenu';
import Modal from './common/Modal';
import toast from 'react-hot-toast';
import CachedImage from './common/CachedImage';
import './user-details/UserDetails.css';

const UserDetails = ({ isModal = false, userId: propUserId, isPanel = false, onClose }) => {
    const { id: paramUserId } = useParams();
    const userId = propUserId || paramUserId;
    const navigate = useNavigate();
    const { supabase } = useSupabase();
    const { refreshContacts, contacts: cachedContacts } = useData();
    const { startCall } = useCall();
    const queryClient = useQueryClient();
    const currentUser = useAuthStore((state) => state.dbUser);

    // Consolidated Data Fetching
    const {
        data: profileData,
        isLoading: isProfileLoading,
        isError,
        error
    } = useUserFullProfile(userId, currentUser?.id);

    const resolvedName = useResolveName(userId, profileData?.name);

    // Derived State from consolidated hook
    const user = profileData;
    const isContact = !!profileData?.contact_info;
    const contactId = profileData?.contact_info?.id;
    const isBlocked = !!profileData?.is_blocked;
    const mediaCount = profileData?.media_counts || { images: 0, links: 0, docs: 0 };
    const commonGroups = profileData?.common_groups || [];
    const isMuted = (() => {
        if (!currentUser || !userId) return false;
        const mutedChats = JSON.parse(localStorage.getItem('mutedChats') || '{}');
        const chatId = [currentUser.id, userId].sort().join('_');
        return !!mutedChats[chatId];
    })();

    // Local state for modals and forms (remains the same)
    const [showBlockModal, setShowBlockModal] = useState(false);
    const [showEditContactModal, setShowEditContactModal] = useState(false);
    const [showReportModal, setShowReportModal] = useState(false);
    const [showImageModal, setShowImageModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [reportReason, setReportReason] = useState('');
    const [reportDetails, setReportDetails] = useState('');
    const [contactName, setContactName] = useState('');
    const [contactPhone, setContactPhone] = useState('');
    const [contactAbout, setContactAbout] = useState('');

    // Redirect if userId is invalid
    useEffect(() => {
        if (!userId || userId === 'undefined' || userId === 'null') {
            navigate('/');
        }
    }, [userId, navigate]);

    // Handle Mute Toggle (Refactored to avoid redundant state)
    const [_muted, set_Muted] = useState(isMuted);
    const handleMuteToggle = () => {
        const chatId = [currentUser.id, userId].sort().join('_');
        const mutedChats = JSON.parse(localStorage.getItem('mutedChats') || '{}');

        if (_muted) {
            delete mutedChats[chatId];
        } else {
            mutedChats[chatId] = true;
        }

        localStorage.setItem('mutedChats', JSON.stringify(mutedChats));
        set_Muted(!_muted);
    };

    // Real-time status sync (Simplified)
    const [currentOnlineStatus, setCurrentOnlineStatus] = useState(null);

    useEffect(() => {
        if (profileData) {
            setCurrentOnlineStatus({
                is_online: profileData.is_online,
                last_seen: profileData.last_seen
            });
        }
    }, [profileData]);

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
                setCurrentOnlineStatus({
                    is_online: updatedUser.is_online,
                    last_seen: updatedUser.last_seen
                });
                // Update the consolidated cache
                queryClient.setQueryData(['userFullProfile', userId, currentUser?.id], (oldData) => {
                    return oldData ? { ...oldData, ...updatedUser } : oldData;
                });
            })
            .subscribe();

        return () => {
            supabase.removeChannel(subscription);
        };
    }, [userId, supabase, queryClient, currentUser?.id]);

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
                .maybeSingle();

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

            queryClient.invalidateQueries({ queryKey: ['userFullProfile', userId, currentUser?.id] });
            queryClient.invalidateQueries({ queryKey: ['contacts', currentUser.id] });
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

            // Invalidate consolidated profile cache
            queryClient.invalidateQueries({ queryKey: ['userFullProfile', userId, currentUser?.id] });

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

            queryClient.invalidateQueries({ queryKey: ['userFullProfile', userId, currentUser?.id] });
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

            queryClient.invalidateQueries({ queryKey: ['userFullProfile', userId, currentUser?.id] });
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
            queryClient.invalidateQueries({ queryKey: ['userFullProfile', userId, currentUser?.id] });
            queryClient.invalidateQueries({ queryKey: ['contacts', currentUser.id] });
            refreshContacts();
            toast.success('Contact and chat deleted');
            navigate('/');
        } catch (error) {
            console.error('Error deleting contact:', error);
            toast.error('Failed to delete contact');
        }
    };

    // Loading state
    const isLoading = isProfileLoading && !profileData;

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

    // Animation variants for framer motion
    const pageVariants = {
        initial: {
            opacity: 0,
            y: 20,
        },
        animate: {
            opacity: 1,
            y: 0,
            transition: {
                duration: 0.3,
                ease: 'easeOut',
                staggerChildren: 0.05,
            },
        },
    };

    const itemVariants = {
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
    };

    return (
        <motion.div
            className={`user-details-screen ${isModal ? 'user-details-modal' : ''} ${isPanel ? 'user-details-panel-view' : ''} ${isPanel ? 'panel-slide-in' : ''}`}
            initial="initial"
            animate="animate"
            variants={pageVariants}
        >
            <motion.header className="user-details-header" variants={itemVariants}>
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
                <div className="dropdown-trigger">
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
                </div>
            </motion.header>

            <div className="user-details-content-wrapper">
                <motion.div className="user-profile-section" variants={itemVariants}>
                    <div className="user-details-avatar" id="userDetailAvatar" onClick={() => user.avatar && setShowImageModal(true)} style={{ cursor: user.avatar ? 'pointer' : 'default' }}>
                        {user.avatar ? (
                            parseInt(user.avatar) ? (
                                <CachedImage id="userDetailImg" src={dpOptions.find(dp => dp.id === parseInt(user.avatar))?.path} alt={user.name} />
                            ) : (
                                <CachedImage id="userDetailImg" src={user.avatar} alt={user.name} />
                            )
                        ) : (
                            <div className="dp-preview-initials" id="userDetailInitials">{getInitials(user.name)}</div>
                        )}
                    </div>
                    <h2 className="user-detail-name" id="userDetailName">{resolvedName}</h2>
                    {resolvedName !== user.name && (
                        <p className="user-detail-global-name" style={{ opacity: 0.6, fontSize: '0.9rem', marginTop: '-10px' }}>
                            @{user.name}
                        </p>
                    )}
                    <p className="user-detail-phone" id="userDetailPhone">{user.phone || '+91 0000000000'}</p>
                    <p className="user-detail-status">
                        {isUserOnline(Boolean(currentOnlineStatus?.is_online), currentOnlineStatus?.last_seen || user.last_seen) ? 'Online' : `Last seen ${formatLastSeen(currentOnlineStatus?.last_seen || user.last_seen)}`}
                    </p>
                </motion.div>

                <motion.div className="user-actions" variants={itemVariants}>
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
                </motion.div>

                <div className="user-info-sections">
                    <motion.div className="info-section" variants={itemVariants}>
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
                    </motion.div>

                    <motion.div className="info-section" variants={itemVariants}>
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
                    </motion.div>

                    <motion.div className="info-section" variants={itemVariants}>
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
                    </motion.div>

                    <motion.div className="info-section" id="groupsSection" variants={itemVariants}>
                        <h3 className="section-header">Groups in Common</h3>
                        <div id="commonGroups">
                            {commonGroups.length > 0 ? (
                                commonGroups.map(group => (
                                    <div key={group.id} className="settings-item" onClick={() => navigate(`/chat/${group.id}/group`, { state: { groupName: group.name, groupAvatar: group.avatar } })}>
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
                    </motion.div>

                    <motion.div className="info-section danger-section" variants={itemVariants}>
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
                    </motion.div>
                </div>
            </div>

            <Modal
                isOpen={showBlockModal}
                onClose={() => setShowBlockModal(false)}
                title="Block Contact"
                size="small"
            >
                <div className="modal-content-text">
                    <p>Are you sure you want to block <strong>{user.name}</strong>?</p>
                    <p className="warning-text">
                        <Ban size={14} style={{ marginRight: '6px' }} />
                        Blocked contacts will no longer be able to call you or send you messages.
                    </p>
                    <div className="modal-actions">
                        <button className="btn-secondary" onClick={() => setShowBlockModal(false)}>
                            Cancel
                        </button>
                        <button className="btn-danger" onClick={confirmBlock}>
                            Block User
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
                    <p className="form-subtitle">Update how this contact appears in your list.</p>
                    <div className="input-group">
                        <label>
                            <Edit size={14} style={{ marginRight: '6px' }} />
                            Display Name
                        </label>
                        <input
                            type="text"
                            value={contactName}
                            onChange={(e) => setContactName(e.target.value)}
                            placeholder="Enter contact name"
                            autoFocus
                        />
                    </div>
                    <div className="modal-actions">
                        <button className="btn-secondary" onClick={() => setShowEditContactModal(false)}>
                            Cancel
                        </button>
                        <button className="btn-primary" onClick={saveContactEdit}>
                            Save Changes
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
                        <motion.img
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.3, ease: 'easeOut' }}
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
                    <p>Delete chat and contact with <strong>{user.name}</strong>?</p>
                    <p className="warning-text">
                        <Trash2 size={14} style={{ marginRight: '6px' }} />
                        This will remove this contact and delete your messages. This cannot be undone.
                    </p>
                    <div className="modal-actions">
                        <button className="btn-secondary" onClick={() => setShowDeleteModal(false)}>
                            Cancel
                        </button>
                        <button className="btn-danger" onClick={confirmDelete}>
                            Delete Everything
                        </button>
                    </div>
                </div>
            </Modal>
        </motion.div>
    );
};

export default UserDetails;