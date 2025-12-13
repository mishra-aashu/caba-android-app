 import React, { useState, useEffect } from 'react';
 import { useParams, useNavigate } from 'react-router-dom';
 import { useSupabase } from '../contexts/SupabaseContext';
 import { useCall } from '../context/CallContext';
 import { dpOptions } from '../utils/dpOptions';
 import { ArrowLeft, Phone, Video, MessageCircle, Image, Link as LinkIcon, FileText, Bell, BellOff, UserPlus, Share2, Download, Ban, Flag, Trash2, Edit, MoreVertical } from 'lucide-react';
 import DropdownMenu from './common/DropdownMenu';
 import Modal from './common/Modal';
 import MessagingLoader from './MessagingLoader';
 import './user-details/UserDetails.css';
 import '../styles/layout-fixes.css';
 import '../styles/mobile-improvements.css';

const UserDetails = () => {
    const { id: userId } = useParams();
    const navigate = useNavigate();
    const { supabase } = useSupabase();
    const { startCall } = useCall();

    // State
    const [user, setUser] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isMuted, setIsMuted] = useState(false);
    const [isContact, setIsContact] = useState(false);
    const [isBlocked, setIsBlocked] = useState(false);
    const [mediaCount, setMediaCount] = useState({ images: 0, links: 0, docs: 0 });
    const [commonGroups, setCommonGroups] = useState([]);
    const [contactName, setContactName] = useState('');
    const [contactPhone, setContactPhone] = useState('');
    const [contactAbout, setContactAbout] = useState('');

    // Modals
    const [showBlockModal, setShowBlockModal] = useState(false);
    const [showEditContactModal, setShowEditContactModal] = useState(false);
    const [showReportModal, setShowReportModal] = useState(false);
    const [showImageModal, setShowImageModal] = useState(false);
    const [reportReason, setReportReason] = useState('');
    const [reportDetails, setReportDetails] = useState('');

    useEffect(() => {
        if (!userId || userId === 'undefined' || userId === 'null') {
            navigate('/');
            return;
        }
        loadUserDetails();
    }, [userId]);

    const loadUserDetails = async () => {
        try {
            const userStr = localStorage.getItem('currentUser');
            if (!userStr) {
                navigate('/login');
                return;
            }
            const current = JSON.parse(userStr);
            setCurrentUser(current);

            // Load other user details with caching
            const cacheKey = `digidad_user_${userId}`;
            let cachedUser = localStorage.getItem(cacheKey);
            let freshUserData;

            if (cachedUser) {
                cachedUser = JSON.parse(cachedUser);
                setUser(cachedUser);
                await loadAdditionalData(current, userId);
            }

            // Always try to fetch fresh data
            try {
                const { data: userData, error } = await supabase
                    .from('users')
                    .select('*')
                    .eq('id', userId)
                    .single();

                if (error) throw error;
                freshUserData = userData;

                // Cache the fresh data
                localStorage.setItem(cacheKey, JSON.stringify(freshUserData));

                // Update UI if data changed
                if (!cachedUser || JSON.stringify(cachedUser) !== JSON.stringify(freshUserData)) {
                    setUser(freshUserData);
                    await loadAdditionalData(current, userId);
                }
            } catch (networkError) {
                console.warn('Network error loading user details:', networkError);
                if (!cachedUser) {
                    // Set fallback data
                    const fallbackUser = {
                        id: userId,
                        name: 'Unknown User',
                        phone: 'N/A',
                        avatar: null,
                        about: 'User information not available'
                    };
                    setUser(fallbackUser);
                }
            }

            setLoading(false);
        } catch (error) {
            console.error('Error loading user details:', error);
            setLoading(false);
        }
    };

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
        } catch (error) {
            console.error('Error loading additional data:', error);
        }
    };

    const checkContactStatus = async (currentUserId, targetUserId) => {
        try {
            const { data, error } = await supabase
                .from('contacts')
                .select('*')
                .eq('user_id', currentUserId)
                .eq('contact_user_id', targetUserId);

            setIsContact(data && data.length > 0);
        } catch (error) {
            console.error('Error checking contact status:', error);
        }
    };

    const checkBlockStatus = async (currentUserId, targetUserId) => {
        try {
            const { data, error } = await supabase
                .from('blocked_users')
                .select('*')
                .eq('blocker_id', currentUserId)
                .eq('blocked_id', targetUserId);

            setIsBlocked(data && data.length > 0);
        } catch (error) {
            console.error('Error checking block status:', error);
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
            alert('Failed to open chat');
        }
    };

    const handleVoiceCall = async () => {
        try {
            const { callId } = await startCall(user.id, 'voice');
            navigate(`/call/${callId}`);
        } catch (error) {
            console.error('Failed to start voice call:', error);
            alert('Failed to start call: ' + error.message);
        }
    };

    const handleVideoCall = async () => {
        try {
            const { callId } = await startCall(user.id, 'video');
            navigate(`/call/${callId}`);
        } catch (error) {
            console.error('Failed to start video call:', error);
            alert('Failed to start call: ' + error.message);
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
            const { data: existingContact } = await supabase
                .from('contacts')
                .select('*')
                .eq('user_id', currentUser.id)
                .eq('contact_user_id', user.id)
                .single();

            if (existingContact) {
                alert('Contact already exists');
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
            alert('Contact added successfully');
        } catch (error) {
            console.error('Error adding contact:', error);
            alert('Failed to add contact');
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
                alert('Contact info copied');
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
                alert('No chat history found with this user');
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
                alert('No messages to export');
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

            alert('Chat exported successfully!');
        } catch (error) {
            console.error('Error exporting chat:', error);
            alert('Failed to export chat');
        }
    };

    const handleEditContact = () => {
        // Check if user is in contacts
        if (!isContact) {
            alert('Please add this user to contacts first');
            return;
        }

        // Get contact info from database
        supabase
            .from('contacts')
            .select('*')
            .eq('user_id', currentUser.id)
            .eq('contact_user_id', userId)
            .single()
            .then(({ data: contact, error }) => {
                if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
                    console.error('Error fetching contact:', error);
                    alert('Failed to load contact info');
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
        try {
            if (!contactName.trim()) {
                alert('Name is required');
                return;
            }

            // Update or insert contact in database
            const contactData = {
                user_id: currentUser.id,
                contact_user_id: userId,
                contact_name: contactName.trim(),
                updated_at: new Date().toISOString()
            };

            // First check if contact exists
            const { data: existingContact } = await supabase
                .from('contacts')
                .select('id')
                .eq('user_id', currentUser.id)
                .eq('contact_user_id', userId)
                .single();

            if (existingContact) {
                // Update existing contact
                await supabase
                    .from('contacts')
                    .update(contactData)
                    .eq('id', existingContact.id);
            } else {
                // Insert new contact
                await supabase
                    .from('contacts')
                    .insert([contactData]);
            }

            // Update user profile if it's the current user's own profile
            if (currentUser.id === userId) {
                const updateData = {
                    name: contactName.trim(),
                    phone: contactPhone.trim(),
                    updated_at: new Date().toISOString()
                };
                if (contactAbout.trim()) {
                    updateData.about = contactAbout.trim();
                }
                await supabase
                    .from('users')
                    .update(updateData)
                    .eq('id', currentUser.id);
            }

            // Update UI
            setUser({ ...user, name: contactName.trim(), phone: contactPhone.trim(), about: contactAbout.trim() });
            setShowEditContactModal(false);
            alert('Contact updated successfully');
        } catch (error) {
            console.error('Error saving contact:', error);
            alert('Failed to update contact');
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
                .insert([{
                    blocker_id: currentUser.id,
                    blocked_id: userId
                }]);

            if (error) throw error;

            setIsBlocked(true);
            setShowBlockModal(false);
            alert('Contact blocked');
        } catch (error) {
            console.error('Error blocking contact:', error);
            alert('Failed to block contact');
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
            alert('Contact unblocked');
        } catch (error) {
            console.error('Error unblocking contact:', error);
            alert('Failed to unblock contact');
        }
    };

    const handleReportUser = () => {
        setShowReportModal(true);
    };

    const submitReport = async () => {
        try {
            if (!reportReason.trim()) {
                alert('Please select a reason');
                return;
            }

            // Submit to reports table
            const { error } = await supabase
                .from('reports')
                .insert([{
                    reporter_id: currentUser.id,
                    reported_id: userId,
                    reason: reportReason,
                    details: reportDetails
                }]);

            if (error) throw error;

            setShowReportModal(false);
            setReportReason('');
            setReportDetails('');
            alert('Report submitted');
        } catch (error) {
            console.error('Error submitting report:', error);
            alert('Failed to submit report');
        }
    };

    const handleDeleteContact = async () => {
        const confirmed = confirm(`Delete chat with ${user.name}? This will delete all messages.`);

        if (!confirmed) return;

        try {
            // Get chat
            const { data: chat } = await supabase
                .from('chats')
                .select('id')
                .or(`and(user1_id.eq.${currentUser.id},user2_id.eq.${user.id}),and(user1_id.eq.${user.id},user2_id.eq.${currentUser.id})`)
                .single();

            if (chat) {
                // Delete messages
                await supabase
                    .from('messages')
                    .delete()
                    .eq('chat_id', chat.id);

                // Delete chat
                await supabase
                    .from('chats')
                    .delete()
                    .eq('id', chat.id);
            }

            alert('Contact deleted');
            navigate('/');
        } catch (error) {
            console.error('Error deleting contact:', error);
            alert('Failed to delete contact');
        }
    };

    if (loading) {
        return <MessagingLoader />;
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
        <div className="user-details-screen">
            {/* Header */}
            <header className="user-details-header">
                <button className="back-btn" onClick={() => navigate(-1)}>
                    <ArrowLeft size={24} />
                </button>
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

            {/* User Profile Section */}
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
                <h2 className="user-detail-name" id="userDetailName">{user.name}</h2>
                <p className="user-detail-phone" id="userDetailPhone">{user.phone || '+91 0000000000'}</p>
            </div>

            {/* Action Buttons */}
            <div className="user-actions">
                <button className="action-btn" id="messageUserBtn" onClick={handleMessage}>
                    <MessageCircle size={24} style={{ color: 'white' }} />
                </button>
                <button className="action-btn" id="voiceCallUserBtn" onClick={handleVoiceCall}>
                    <Phone size={24} style={{ color: 'white' }} />
                </button>
                <button className="action-btn" id="videoCallUserBtn" onClick={handleVideoCall}>
                    <Video size={24} style={{ color: 'white' }} />
                </button>
            </div>

            {/* User Information */}
            <div className="user-info-sections">
                {/* Media Section */}
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

                {/* Notifications Section */}
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

                {/* Contact Actions */}
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

                {/* Groups in Common */}
                <div className="info-section" id="groupsSection">
                    <h3 className="section-header">Groups in Common</h3>
                    <div id="commonGroups">
                        <p className="no-data">No groups in common</p>
                    </div>
                </div>

                {/* Danger Zone */}
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
                            <span className="label">Delete Contact</span>
                        </div>
                    </div>
                </div>

            </div>

            {/* Block Confirmation Modal */}
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

            {/* Edit Contact Modal */}
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

            {/* Report Modal */}
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

            {/* Image Modal */}
            {showImageModal && (
                <div className="modal-backdrop" onClick={() => setShowImageModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <button className="close-modal-btn" onClick={() => setShowImageModal(false)}>
                            ×
                        </button>
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
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserDetails;
