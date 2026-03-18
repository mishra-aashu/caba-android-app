import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useSupabase } from '../contexts/SupabaseContext';
import { useUserFullProfile } from '../hooks/useUserFullProfile';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { useCall } from '../contexts/CallContext';
import useAuthStore from '../store/authStore';
import { dpOptions } from '../utils/dpOptions';
import { formatLastSeen, isUserOnline } from '../utils/dateFormatter';
import { useResolveName } from '../hooks/useResolveName';
import {
    ArrowLeft, Phone, Video, MessageCircle,
    Image, Link as LinkIcon, FileText,
    BellOff, Bell, UserPlus, Share2, Download,
    Flag, Trash2, Edit, MoreVertical, X,
    ChevronRight, Shield, Clock, Users, Info,
    Copy, CheckCircle2
} from 'lucide-react';
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
    const location = useLocation();
    const { supabase } = useSupabase();
    const { startCall } = useCall();
    const queryClient = useQueryClient();
    const currentUser = useAuthStore((state) => state.dbUser);

    // ─── Data ───
    const {
        data: profileData,
        isLoading: isProfileLoading,
        isError,
        error
    } = useUserFullProfile(userId, currentUser?.id);

    const resolvedName = useResolveName(userId, profileData?.name);

    const user = profileData;
    const isContact = !!profileData?.contact_info;
    const contactId = profileData?.contact_info?.id;
    const isBlocked = !!profileData?.is_blocked;
    const mediaCount = profileData?.media_counts || { images: 0, links: 0, docs: 0 };
    const commonGroups = profileData?.common_groups || [];
    const isOwnProfile = currentUser?.id === userId;

    // ─── Mute State ───
    const getMutedState = useCallback(() => {
        if (!currentUser || !userId) return false;
        const mutedChats = JSON.parse(localStorage.getItem('mutedChats') || '{}');
        const chatId = [currentUser.id, userId].sort().join('_');
        return !!mutedChats[chatId];
    }, [currentUser, userId]);

    const [isMuted, setIsMuted] = useState(getMutedState);

    // ─── Modals ───
    const [showBlockModal, setShowBlockModal] = useState(false);
    const [showEditContactModal, setShowEditContactModal] = useState(false);
    const [showReportModal, setShowReportModal] = useState(false);
    const [showImageModal, setShowImageModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [reportReason, setReportReason] = useState('');
    const [reportDetails, setReportDetails] = useState('');
    const [contactName, setContactName] = useState('');

    // ─── Loading States ───
    const [actionLoading, setActionLoading] = useState({
        message: false,
        block: false,
        delete: false,
        report: false,
        addContact: false,
        export: false,
        editContact: false
    });

    // ─── Realtime Status ───
    const [currentOnlineStatus, setCurrentOnlineStatus] = useState(null);

    useEffect(() => {
        if (!userId || userId === 'undefined' || userId === 'null') {
            navigate('/');
        }
    }, [userId, navigate]);

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
                const updated = payload.new;
                setCurrentOnlineStatus({
                    is_online: updated.is_online,
                    last_seen: updated.last_seen
                });
                queryClient.setQueryData(
                    ['userFullProfile', userId, currentUser?.id],
                    (old) => old ? { ...old, ...updated } : old
                );
            })
            .subscribe();

        return () => supabase.removeChannel(subscription);
    }, [userId, supabase, queryClient, currentUser?.id]);

    // ─── Helpers ───
    const getInitials = (name) =>
        name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';

    const getAvatarSrc = () => {
        if (!user?.avatar) return null;
        const avatarId = parseInt(user.avatar);
        if (!isNaN(avatarId)) {
            return dpOptions.find(dp => dp.id === avatarId)?.path;
        }
        return user.avatar;
    };

    const isOnline = isUserOnline(
        Boolean(currentOnlineStatus?.is_online),
        currentOnlineStatus?.last_seen || user?.last_seen
    );

    const setLoading = (key, value) =>
        setActionLoading(prev => ({ ...prev, [key]: value }));

    const invalidateProfile = () => {
        queryClient.invalidateQueries({ queryKey: ['userFullProfile', userId, currentUser?.id] });
        queryClient.invalidateQueries({ queryKey: ['contacts', currentUser?.id] });
    };

    // ─── Handlers ───
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
        toast.success(isMuted ? 'Notifications unmuted' : 'Notifications muted');
    };

    const handleMessage = async () => {
        if (!currentUser || !user) return;
        setLoading('message', true);
        try {
            const { data: chat } = await supabase
                .from('chats')
                .select('*')
                .or(`and(user1_id.eq.${currentUser.id},user2_id.eq.${user.id}),and(user1_id.eq.${user.id},user2_id.eq.${currentUser.id})`)
                .maybeSingle();

            if (chat) {
                navigate(`/chat/${chat.id}/${user.id}`);
            } else {
                const { data, error } = await supabase
                    .from('chats')
                    .insert([{
                        user1_id: currentUser.id,
                        user2_id: user.id,
                        last_message: null,
                        last_message_time: new Date().toISOString(),
                        unread_count: 0
                    }])
                    .select();
                if (error) throw error;
                if (data?.[0]) navigate(`/chat/${data[0].id}/${user.id}`);
            }
        } catch (err) {
            console.error('Chat error:', err);
            toast.error('Failed to open chat');
        } finally {
            setLoading('message', false);
        }
    };

    const handleVoiceCall = async () => {
        try {
            const { callId } = await startCall(user.id, 'voice');
            navigate(`/call/${callId}`);
        } catch (err) {
            toast.error('Failed to start call');
        }
    };

    const handleVideoCall = async () => {
        try {
            const { callId } = await startCall(user.id, 'video');
            navigate(`/call/${callId}`);
        } catch (err) {
            toast.error('Failed to start call');
        }
    };

    const handleAddToContacts = async () => {
        if (!currentUser || !user) return;
        setLoading('addContact', true);
        try {
            const { data: existing } = await supabase
                .from('contacts')
                .select('id')
                .eq('user_id', currentUser.id)
                .eq('contact_user_id', user.id)
                .maybeSingle();

            if (existing) { toast.error('Already in contacts'); return; }

            const { error } = await supabase.from('contacts').insert([{
                user_id: currentUser.id,
                contact_user_id: user.id,
                contact_name: user.name
            }]);
            if (error) throw error;

            invalidateProfile();
            toast.success('Contact added');
        } catch (err) {
            toast.error('Failed to add contact');
        } finally {
            setLoading('addContact', false);
        }
    };

    const handleShareContact = () => {
        const text = `${user.name}\n${user.phone || ''}`;
        if (navigator.share) {
            navigator.share({ title: 'Share Contact', text });
        } else {
            navigator.clipboard.writeText(text).then(() => toast.success('Copied'));
        }
    };

    const handleCopyPhone = () => {
        if (user?.phone) {
            navigator.clipboard.writeText(user.phone)
                .then(() => toast.success('Phone number copied'));
        }
    };

    const handleExportChat = async () => {
        if (!currentUser || !user) return;
        setLoading('export', true);
        try {
            const { data: chat } = await supabase
                .from('chats')
                .select('id')
                .or(`and(user1_id.eq.${currentUser.id},user2_id.eq.${user.id}),and(user1_id.eq.${user.id},user2_id.eq.${currentUser.id})`)
                .single();

            if (!chat) { toast.error('No chat found'); return; }

            const { data: messages } = await supabase
                .from('messages')
                .select('*')
                .eq('chat_id', chat.id)
                .order('created_at', { ascending: true });

            if (!messages?.length) { toast.error('No messages'); return; }

            const csv = [
                ['Timestamp', 'Sender', 'Message'],
                ...messages.map(m => [
                    new Date(m.created_at).toLocaleString(),
                    m.sender_id === currentUser.id ? 'You' : user.name,
                    m.content || '[Media]'
                ])
            ].map(r => r.map(f => `"${f}"`).join(',')).join('\n');

            const blob = new Blob([csv], { type: 'text/csv' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `chat_${user.name}_${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast.success('Chat exported');
        } catch (err) {
            toast.error('Export failed');
        } finally {
            setLoading('export', false);
        }
    };

    const handleEditContact = () => {
        if (!isContact) { toast.error('Add to contacts first'); return; }
        setContactName(profileData?.contact_info?.contact_name || user.name);
        setShowEditContactModal(true);
    };

    const saveContactEdit = async () => {
        if (!contactName.trim()) { toast.error('Name required'); return; }
        setLoading('editContact', true);
        try {
            if (isContact && contactId) {
                const { error } = await supabase
                    .from('contacts')
                    .update({ contact_name: contactName.trim() })
                    .eq('id', contactId);
                if (error) throw error;
            }
            invalidateProfile();
            setShowEditContactModal(false);
            toast.success('Contact updated');
        } catch (err) {
            toast.error('Update failed');
        } finally {
            setLoading('editContact', false);
        }
    };

    const handleBlockUser = () => {
        if (isBlocked) unblockContact();
        else setShowBlockModal(true);
    };

    const confirmBlock = async () => {
        setLoading('block', true);
        try {
            const { error } = await supabase.from('blocked_users').insert([{
                blocker_id: currentUser.id,
                blocked_id: userId
            }]);
            if (error) throw error;
            invalidateProfile();
            setShowBlockModal(false);
            toast.success('Contact blocked');
        } catch (err) {
            toast.error('Failed to block');
        } finally {
            setLoading('block', false);
        }
    };

    const unblockContact = async () => {
        setLoading('block', true);
        try {
            const { error } = await supabase
                .from('blocked_users')
                .delete()
                .eq('blocker_id', currentUser.id)
                .eq('blocked_id', userId);
            if (error) throw error;
            invalidateProfile();
            toast.success('Contact unblocked');
        } catch (err) {
            toast.error('Failed to unblock');
        } finally {
            setLoading('block', false);
        }
    };

    const submitReport = async () => {
        if (!reportReason.trim()) { toast.error('Select a reason'); return; }
        setLoading('report', true);
        try {
            const { error } = await supabase.from('reports').insert([{
                reporter_id: currentUser.id,
                reported_id: userId,
                reason: reportReason,
                details: reportDetails
            }]);
            if (error) throw error;
            setShowReportModal(false);
            setReportReason('');
            setReportDetails('');
            toast.success('Report submitted');
        } catch (err) {
            toast.error('Report failed');
        } finally {
            setLoading('report', false);
        }
    };

    const confirmDelete = async () => {
        setLoading('delete', true);
        try {
            if (isContact) {
                await supabase.from('contacts').delete()
                    .eq('user_id', currentUser.id)
                    .eq('contact_user_id', user.id);
            }

            const { data: chat } = await supabase
                .from('chats')
                .select('id')
                .or(`and(user1_id.eq.${currentUser.id},user2_id.eq.${user.id}),and(user1_id.eq.${user.id},user2_id.eq.${currentUser.id})`)
                .maybeSingle();

            if (chat) {
                await supabase.from('messages').delete()
                    .eq('chat_id', chat.id).eq('sender_id', currentUser.id);
                await supabase.from('chats').delete().eq('id', chat.id);
            }

            setShowDeleteModal(false);
            invalidateProfile();
            toast.success('Deleted successfully');
            navigate('/');
        } catch (err) {
            toast.error('Delete failed');
        } finally {
            setLoading('delete', false);
        }
    };

    const handleBack = () => {
        if (isPanel && onClose) {
            onClose();
            return;
        }
        navigate('/');
    };

    // ─── Loading Skeleton ───
    if (isProfileLoading && !profileData) {
        return (
            <div className={`ud-screen ${isPanel ? 'ud-panel' : ''}`}>
                <div className="ud-skeleton">
                    <div className="ud-skeleton-header">
                        <div className="ud-skel-back" />
                        <div className="ud-skel-title" />
                    </div>
                    <div className="ud-skeleton-avatar" />
                    <div className="ud-skel-name" />
                    <div className="ud-skel-phone" />
                    <div className="ud-skeleton-actions">
                        <div className="ud-skel-action" />
                        <div className="ud-skel-action" />
                        <div className="ud-skel-action" />
                    </div>
                    <div className="ud-skel-section" />
                    <div className="ud-skel-section" />
                </div>
            </div>
        );
    }

    if (isError || !user) {
        return (
            <div className={`ud-screen ${isPanel ? 'ud-panel' : ''}`}>
                <div className="ud-error">
                    <Info size={48} />
                    <h3>{isError ? 'Something went wrong' : 'User not found'}</h3>
                    <p>{error?.message || 'This user may not exist anymore'}</p>
                    <button className="ud-error-btn" onClick={() => navigate('/')}>
                        <ArrowLeft size={16} /> Go Back
                    </button>
                </div>
            </div>
        );
    }

    const avatarSrc = getAvatarSrc();

    // ─── Animation Variants ───
    const stagger = {
        animate: { transition: { staggerChildren: 0.04 } }
    };
    const fadeUp = {
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0, transition: { duration: 0.3 } }
    };

    return (
        <motion.div
            className={`ud-screen ${isModal ? 'ud-modal' : ''} ${isPanel ? 'ud-panel' : ''}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
        >
            {/* ── Header ── */}
            <header className="ud-header">
                <button
                    className="ud-header-btn"
                    onClick={handleBack}
                >
                    {isPanel ? <X size={22} /> : <ArrowLeft size={22} />}
                </button>
                <h1 className="ud-header-title">
                    {isOwnProfile ? 'My Profile' : 'Contact Info'}
                </h1>
                {isContact && (
                    <DropdownMenu
                        trigger={
                            <button className="ud-header-btn">
                                <MoreVertical size={22} />
                            </button>
                        }
                        items={[
                            {
                                icon: <Edit size={16} />,
                                label: 'Edit Name',
                                onClick: handleEditContact
                            },
                            {
                                icon: <Share2 size={16} />,
                                label: 'Share Contact',
                                onClick: handleShareContact
                            }
                        ]}
                    />
                )}
            </header>

            {/* ── Scrollable Content ── */}
            <div className="ud-scroll">
                <motion.div variants={stagger} initial="initial" animate="animate">

                    {/* ── Profile Card ── */}
                    <motion.section className="ud-profile-card" variants={fadeUp}>
                        <div
                            className={`ud-avatar ${avatarSrc ? 'clickable' : ''} ${isOnline ? 'online' : ''}`}
                            onClick={() => avatarSrc && setShowImageModal(true)}
                        >
                            {avatarSrc ? (
                                <CachedImage src={avatarSrc} alt={user.name} className="ud-avatar-img" />
                            ) : (
                                <div className="ud-avatar-initials">
                                    {getInitials(user.name)}
                                </div>
                            )}
                            {isOnline && <div className="ud-online-dot" />}
                        </div>

                        <h2 className="ud-name">{resolvedName}</h2>
                        {resolvedName !== user.name && (
                            <p className="ud-username">@{user.name}</p>
                        )}

                        <div className="ud-phone-row" onClick={handleCopyPhone}>
                            <span className="ud-phone">{user.phone || 'No phone'}</span>
                            {user.phone && <Copy size={14} className="ud-copy-icon" />}
                        </div>

                        <p className={`ud-status ${isOnline ? 'online' : ''}`}>
                            {isOnline ? (
                                <>
                                    <span className="ud-status-dot" />
                                    Online
                                </>
                            ) : (
                                <>
                                    <Clock size={12} />
                                    {formatLastSeen(currentOnlineStatus?.last_seen || user.last_seen)}
                                </>
                            )}
                        </p>
                    </motion.section>

                    {/* ── About Section ── */}
                    {user.about && (
                        <motion.section className="ud-section" variants={fadeUp}>
                            <div className="ud-section-header">
                                <Info size={16} />
                                <span>About</span>
                            </div>
                            <p className="ud-about-text">{user.about}</p>
                        </motion.section>
                    )}

                    {/* ── Quick Actions ── */}
                    <motion.section className="ud-actions-grid" variants={fadeUp}>
                        <button
                            className="ud-action-btn"
                            onClick={handleMessage}
                            disabled={actionLoading.message}
                        >
                            <div className="ud-action-icon">
                                <MessageCircle size={22} />
                            </div>
                            <span>Message</span>
                        </button>
                        <button className="ud-action-btn" onClick={handleVoiceCall}>
                            <div className="ud-action-icon">
                                <Phone size={22} />
                            </div>
                            <span>Audio</span>
                        </button>
                        <button className="ud-action-btn" onClick={handleVideoCall}>
                            <div className="ud-action-icon">
                                <Video size={22} />
                            </div>
                            <span>Video</span>
                        </button>
                    </motion.section>

                    {/* ── Media, Links, Docs ── */}
                    <motion.section className="ud-section" variants={fadeUp}>
                        <div className="ud-section-header">
                            <Image size={16} />
                            <span>Media, Links & Docs</span>
                            <ChevronRight size={16} className="ud-section-chevron" />
                        </div>
                        <div className="ud-media-grid">
                            <div className="ud-media-stat">
                                <div className="ud-media-icon images">
                                    <Image size={18} />
                                </div>
                                <div className="ud-media-info">
                                    <span className="ud-media-count">{mediaCount.images}</span>
                                    <span className="ud-media-label">Photos</span>
                                </div>
                            </div>
                            <div className="ud-media-stat">
                                <div className="ud-media-icon links">
                                    <LinkIcon size={18} />
                                </div>
                                <div className="ud-media-info">
                                    <span className="ud-media-count">{mediaCount.links}</span>
                                    <span className="ud-media-label">Links</span>
                                </div>
                            </div>
                            <div className="ud-media-stat">
                                <div className="ud-media-icon docs">
                                    <FileText size={18} />
                                </div>
                                <div className="ud-media-info">
                                    <span className="ud-media-count">{mediaCount.docs}</span>
                                    <span className="ud-media-label">Docs</span>
                                </div>
                            </div>
                        </div>
                    </motion.section>

                    {/* ── Settings Items ── */}
                    <motion.section className="ud-section" variants={fadeUp}>
                        {/* Mute */}
                        <div className="ud-item" onClick={handleMuteToggle}>
                            <div className="ud-item-left">
                                <div className={`ud-item-icon ${isMuted ? 'muted' : ''}`}>
                                    {isMuted ? <BellOff size={18} /> : <Bell size={18} />}
                                </div>
                                <span className="ud-item-label">
                                    {isMuted ? 'Unmute Notifications' : 'Mute Notifications'}
                                </span>
                            </div>
                            <label className="ud-toggle" onClick={(e) => e.stopPropagation()}>
                                <input type="checkbox" checked={isMuted} onChange={handleMuteToggle} />
                                <span className="ud-toggle-track">
                                    <span className="ud-toggle-thumb" />
                                </span>
                            </label>
                        </div>

                        {/* Add to Contacts */}
                        {!isContact && !isOwnProfile && (
                            <div
                                className={`ud-item ${actionLoading.addContact ? 'loading' : ''}`}
                                onClick={handleAddToContacts}
                            >
                                <div className="ud-item-left">
                                    <div className="ud-item-icon accent">
                                        <UserPlus size={18} />
                                    </div>
                                    <span className="ud-item-label">Add to Contacts</span>
                                </div>
                                {actionLoading.addContact
                                    ? <div className="ud-spinner-small" />
                                    : <ChevronRight size={16} className="ud-item-chevron" />
                                }
                            </div>
                        )}

                        {/* Share Contact */}
                        <div className="ud-item" onClick={handleShareContact}>
                            <div className="ud-item-left">
                                <div className="ud-item-icon">
                                    <Share2 size={18} />
                                </div>
                                <span className="ud-item-label">Share Contact</span>
                            </div>
                            <ChevronRight size={16} className="ud-item-chevron" />
                        </div>

                        {/* Export Chat */}
                        <div
                            className={`ud-item ${actionLoading.export ? 'loading' : ''}`}
                            onClick={handleExportChat}
                        >
                            <div className="ud-item-left">
                                <div className="ud-item-icon">
                                    <Download size={18} />
                                </div>
                                <span className="ud-item-label">Export Chat</span>
                            </div>
                            {actionLoading.export
                                ? <div className="ud-spinner-small" />
                                : <ChevronRight size={16} className="ud-item-chevron" />
                            }
                        </div>
                    </motion.section>

                    {/* ── Common Groups ── */}
                    <motion.section className="ud-section" variants={fadeUp}>
                        <div className="ud-section-header">
                            <Users size={16} />
                            <span>Groups in Common</span>
                            <span className="ud-section-badge">{commonGroups.length}</span>
                        </div>

                        {commonGroups.length > 0 ? (
                            <div className="ud-groups-list">
                                {commonGroups.map(group => (
                                    <div
                                        key={group.id}
                                        className="ud-group-item"
                                        onClick={() => navigate(
                                            `/chat/${group.id}/group`,
                                            { state: { groupName: group.name, groupAvatar: group.avatar } }
                                        )}
                                    >
                                        <div className="ud-group-avatar">
                                            {group.avatar ? (
                                                <img src={group.avatar} alt={group.name} />
                                            ) : (
                                                <span>{getInitials(group.name)}</span>
                                            )}
                                        </div>
                                        <span className="ud-group-name">{group.name}</span>
                                        <ChevronRight size={16} className="ud-item-chevron" />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="ud-empty-text">No groups in common</p>
                        )}
                    </motion.section>

                    {/* ── Encryption Badge ── */}
                    <motion.section className="ud-encryption-badge" variants={fadeUp}>
                        <Shield size={16} />
                        <p>
                            Messages are end-to-end encrypted. No one outside of this chat can
                            read or listen to them.
                        </p>
                    </motion.section>

                    {/* ── Danger Zone ── */}
                    {!isOwnProfile && (
                        <motion.section className="ud-section ud-danger-section" variants={fadeUp}>
                            <div
                                className={`ud-item danger ${actionLoading.block ? 'loading' : ''}`}
                                onClick={handleBlockUser}
                            >
                                <div className="ud-item-left">
                                    <div className="ud-item-icon danger">
                                        <span style={{ fontSize: '18px' }}>🚫</span>
                                    </div>
                                    <span className="ud-item-label">
                                        {isBlocked ? 'Unblock Contact' : 'Block Contact'}
                                    </span>
                                </div>
                                {actionLoading.block && <div className="ud-spinner-small danger" />}
                            </div>

                            <div
                                className="ud-item danger"
                                onClick={() => setShowReportModal(true)}
                            >
                                <div className="ud-item-left">
                                    <div className="ud-item-icon danger">
                                        <Flag size={18} />
                                    </div>
                                    <span className="ud-item-label">Report Contact</span>
                                </div>
                            </div>

                            <div
                                className="ud-item danger"
                                onClick={() => setShowDeleteModal(true)}
                            >
                                <div className="ud-item-left">
                                    <div className="ud-item-icon danger">
                                        <Trash2 size={18} />
                                    </div>
                                    <span className="ud-item-label">Delete Chat & Contact</span>
                                </div>
                            </div>
                        </motion.section>
                    )}
                </motion.div>

                {/* Spacer for bottom */}
                <div className="ud-bottom-spacer" />
            </div>

            {/* ═══ Modals ═══ */}

            {/* Block Modal */}
            <Modal isOpen={showBlockModal} onClose={() => setShowBlockModal(false)}
                title="Block Contact" size="small">
                <div className="ud-modal-body">
                    <p>Block <strong>{user.name}</strong>?</p>
                    <p className="ud-modal-warning">
                        <Ban size={14} />
                        They won't be able to message or call you.
                    </p>
                    <div className="ud-modal-actions">
                        <button className="ud-btn secondary" onClick={() => setShowBlockModal(false)}>
                            Cancel
                        </button>
                        <button className="ud-btn danger" onClick={confirmBlock}
                            disabled={actionLoading.block}>
                            {actionLoading.block ? 'Blocking...' : 'Block'}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Edit Contact Modal */}
            <Modal isOpen={showEditContactModal} onClose={() => setShowEditContactModal(false)}
                title="Edit Contact" size="small">
                <div className="ud-modal-body">
                    <div className="ud-form-group">
                        <label>
                            <Edit size={14} />
                            Display Name
                        </label>
                        <input
                            type="text"
                            value={contactName}
                            onChange={(e) => setContactName(e.target.value)}
                            placeholder="Contact name"
                            autoFocus
                            onKeyDown={(e) => e.key === 'Enter' && saveContactEdit()}
                        />
                    </div>
                    <div className="ud-modal-actions">
                        <button className="ud-btn secondary" onClick={() => setShowEditContactModal(false)}>
                            Cancel
                        </button>
                        <button className="ud-btn primary" onClick={saveContactEdit}
                            disabled={actionLoading.editContact}>
                            {actionLoading.editContact ? 'Saving...' : 'Save'}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Report Modal */}
            <Modal isOpen={showReportModal} onClose={() => setShowReportModal(false)}
                title="Report Contact" size="small">
                <div className="ud-modal-body">
                    <p className="ud-modal-subtitle">Why are you reporting?</p>
                    <div className="ud-report-options">
                        {['spam', 'harassment', 'inappropriate', 'other'].map(reason => (
                            <label key={reason} className={`ud-report-option ${reportReason === reason ? 'selected' : ''}`}>
                                <input
                                    type="radio"
                                    name="report"
                                    value={reason}
                                    checked={reportReason === reason}
                                    onChange={(e) => setReportReason(e.target.value)}
                                />
                                <span className="ud-radio-custom">
                                    {reportReason === reason && <CheckCircle2 size={16} />}
                                </span>
                                <span className="ud-report-label">
                                    {reason.charAt(0).toUpperCase() + reason.slice(1)}
                                </span>
                            </label>
                        ))}
                    </div>
                    <div className="ud-modal-actions">
                        <button className="ud-btn secondary" onClick={() => setShowReportModal(false)}>
                            Cancel
                        </button>
                        <button className="ud-btn danger" onClick={submitReport}
                            disabled={actionLoading.report || !reportReason}>
                            {actionLoading.report ? 'Submitting...' : 'Report'}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Delete Modal */}
            <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)}
                title="Delete Everything" size="small">
                <div className="ud-modal-body">
                    <p>Delete chat and contact with <strong>{user.name}</strong>?</p>
                    <p className="ud-modal-warning">
                        <Trash2 size={14} />
                        This will remove the contact and delete your messages. Cannot be undone.
                    </p>
                    <div className="ud-modal-actions">
                        <button className="ud-btn secondary" onClick={() => setShowDeleteModal(false)}>
                            Cancel
                        </button>
                        <button className="ud-btn danger" onClick={confirmDelete}
                            disabled={actionLoading.delete}>
                            {actionLoading.delete ? 'Deleting...' : 'Delete Everything'}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Image Preview Modal */}
            <Modal isOpen={showImageModal} onClose={() => setShowImageModal(false)}
                title="" size="large" bodyClassName="ud-image-modal-body">
                <div className="ud-image-modal">
                    {avatarSrc && (
                        <motion.img
                            initial={{ opacity: 0, scale: 0.85 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.3 }}
                            src={avatarSrc}
                            alt={user.name}
                            className="ud-full-image"
                            onClick={() => setShowImageModal(false)}
                        />
                    )}
                </div>
            </Modal>
        </motion.div>
    );
};

export default UserDetails;