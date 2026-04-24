import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { useChatThemeQuery } from '../hooks/useThemesData';
import { chatThemes, useChatTheme } from '../contexts/ChatThemeContext';
import { useResolveName } from '../hooks/useResolveName';
import {
    ArrowLeft, Phone, Video, MessageCircle,
    Image, Link as LinkIcon, FileText,
    BellOff, Bell, UserPlus, Share2, Download,
    Flag, Trash2, Edit, MoreVertical, X,
    ChevronRight, Shield, Clock, Users, Info,
    Copy, CheckCircle2, Ban, Lock
} from 'lucide-react';
import { EncryptionService } from '../services/EncryptionService';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import DropdownMenu from './common/DropdownMenu';
import Modal from './common/Modal';
import toast from 'react-hot-toast';
import CachedImage from './common/CachedImage';
import { realtimeManager } from '../utils/realtimeManager';
import { useTheme } from '../contexts/ThemeContext';
import { UserDetailsContext } from '../contexts/UserDetailsContext';
import { Palette } from 'lucide-react';
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
    const { showThemeSelector, showSharedMedia } = React.useContext(UserDetailsContext) || {};

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
    const [showSecurityModal, setShowSecurityModal] = useState(false);
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

        const channelName = `user_status_${userId}`;
        realtimeManager.subscribe(
            channelName,
            {},
            {
                postgres_changes: [{
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'users',
                    filter: `id=eq.${userId}`,
                    handler: (payload) => {
                        if (!mountedRef.current || !payload?.new) return;
                        const updated = payload.new;
                        console.log('[UserDetails] User status updated via manager:', updated);
                        setCurrentOnlineStatus({
                            is_online: updated.is_online,
                            last_seen: updated.last_seen
                        });
                        queryClient.setQueryData(
                            ['userFullProfile', userId, currentUser?.id],
                            (old) => old ? { ...old, ...updated } : old
                        );
                    }
                }]
            }
        );

        return () => realtimeManager.unsubscribe(channelName);
    }, [userId, queryClient, currentUser?.id]);

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

    // ─── Parallax Effect ───
    const scrollRef = useRef(null);
    const { scrollY } = useScroll({ 
        container: scrollRef 
    });
    
    // Background moves slower (0.3x speed)
    const backgroundY = useTransform(scrollY, [0, 400], [0, 120]);
    // Hero scales and fades as it sticks
    const heroScale = useTransform(scrollY, [0, 300], [1, 0.96]);
    const heroOpacity = useTransform(scrollY, [0, 300], [1, 0.85]);
    // Subtle scale for the avatar
    const avatarScale = useTransform(scrollY, [0, 300], [1, 0.8]);

    const { chatTheme: activeChatTheme, currentChatId: activeChatId } = useChatTheme();
    const { data: rawThemeName } = useChatThemeQuery(profileData?.chat_id, currentUser?.id);
    const { isDark } = useTheme();

    // ─── Tick for Relative Time ───
    const [tick, setTick] = useState(0);
    useEffect(() => {
        const timer = setInterval(() => setTick(t => t + 1), 60000);
        return () => clearInterval(timer);
    }, []);

    const isOnline = isUserOnline(
        Boolean(currentOnlineStatus?.is_online ?? user?.is_online),
        currentOnlineStatus?.last_seen || user?.last_seen
    );

    const coverStyle = React.useMemo(() => {
        // 1. If we're in an active chat with this user, use the active theme from context
        const isCurrentChatPartner = activeChatId && profileData?.chat_id === activeChatId;
        
        // 2. Normalize theme name (handling underscores vs hyphens)
        const themeKey = (isCurrentChatPartner ? activeChatTheme : rawThemeName)?.replace(/_/g, '-') 
            || (isDark ? 'midnight-amoled' : 'emerald-default');

        const theme = chatThemes[themeKey] || chatThemes[isDark ? 'midnight-amoled' : 'emerald-default'];
        
        // Extract a solid primary color for elements that don't support gradients
        const primaryColor = theme.background.includes('gradient') 
            ? (theme.background.match(/#[a-fA-F0-9]{3,6}|rgba?\([^)]+\)/)?.[0] || '#00a884')
            : theme.background;

        // Function to determine if a color is light or dark for contrast
        const isColorLight = (color) => {
            if (!color) return false;
            let r, g, b;
            if (color.startsWith('#')) {
                const hex = color.replace('#', '');
                r = parseInt(hex.length === 3 ? hex[0] + hex[0] : hex.substring(0, 2), 16);
                g = parseInt(hex.length === 3 ? hex[1] + hex[1] : hex.substring(2, 4), 16);
                b = parseInt(hex.length === 3 ? hex[2] + hex[2] : hex.substring(4, 6), 16);
            } else if (color.startsWith('rgb')) {
                const match = color.match(/\d+/g);
                if (match) [r, g, b] = match.map(Number);
            }
            if (r === undefined) return false;
            // HSP (Highly Sensitive Poo) color model brightness formula
            const brightness = Math.sqrt(0.299 * (r * r) + 0.587 * (g * g) + 0.114 * (b * b));
            return brightness > 180; // 180 is a good threshold for "light"
        };

        const themeIsLight = isColorLight(primaryColor);
        
        return {
            '--ud-theme-color': theme.background,
            '--ud-theme-primary': primaryColor,
            '--ud-theme-text': themeIsLight ? '#0f172a' : '#ffffff',
            '--ud-theme-text-muted': themeIsLight ? 'rgba(15, 23, 42, 0.6)' : 'rgba(255, 255, 255, 0.7)',
            '--ud-theme-pill-bg': themeIsLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(0, 0, 0, 0.25)',
            background: theme.background,
            backgroundImage: theme.background
        };
    }, [rawThemeName, isDark, activeChatTheme, activeChatId, profileData?.chat_id]);

    const securityCode = React.useMemo(() => {
        if (!currentUser?.id || !userId) return '';
        // Derive the key and take a fingerprint (first 16 chars of hash)
        const key = EncryptionService._deriveChatKey([currentUser.id, userId].sort().join('_'), userId);
        return key.substring(0, 16).match(/.{1,4}/g)?.join(' ') || 'Not Verified';
    }, [currentUser?.id, userId]);

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
                if (isPanel && onClose) onClose();
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
                if (data?.[0]) {
                    navigate(`/chat/${data[0].id}/${user.id}`);
                    if (isPanel && onClose) onClose();
                }
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

            if (existing) { toast.error('Already in Your Circle'); return; }

            const { error } = await supabase.from('contacts').insert([{
                user_id: currentUser.id,
                contact_user_id: user.id,
                contact_name: user.name
            }]);
            if (error) throw error;

            invalidateProfile();
            toast.success('Added to Your Circle');
        } catch (err) {
            toast.error('Failed to add to Circle');
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


    const handleEditContact = () => {
        if (!isContact) { toast.error('Add to Your Circle first'); return; }
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

    const handleSharedMediaClick = (tab) => {
        if (showSharedMedia) {
            showSharedMedia(userId, true);
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
                    aria-label="Back"
                >
                    {isPanel ? <X size={22} /> : <ArrowLeft size={22} />}
                </button>
                <h1 className="ud-header-title">
                    {isOwnProfile ? 'My Profile' : 'Circle Info'}
                </h1>
                <div className="ud-header-actions">
                    {isContact && !isOwnProfile && (
                        <DropdownMenu
                            trigger={
                                <button className="ud-header-btn">
                                    <MoreVertical size={22} />
                                </button>
                            }
                            items={[
                                {
                                    icon: <Edit size={16} />,
                                    label: 'Edit Circle Name',
                                    onClick: handleEditContact
                                },
                                {
                                    icon: <Share2 size={16} />,
                                    label: 'Share Circle Info',
                                    onClick: handleShareContact
                                }
                            ]}
                        />
                    )}
                </div>
            </header>

            {/* ── Scrollable Content ── */}
            <div className="ud-scroll" ref={scrollRef}>
                <motion.div variants={stagger} initial="initial" animate="animate">

                    {/* ── Profile Hero ── */}
                    <div className="ud-hero-container">
                        {/* Sticky Background Layer — Light Tint version */}
                        <motion.div 
                            className="ud-sticky-bg" 
                            style={{ 
                                background: coverStyle.background,
                                opacity: 0.2, // Light tinted version as requested
                                y: backgroundY,
                                scale: heroScale
                            }} 
                        />

                        <motion.section 
                            className="ud-profile-card" 
                            variants={fadeUp}
                        >
                            <div className="ud-cover-strip" />
                            
                            <motion.div
                            className={`ud-avatar ${avatarSrc ? 'clickable' : ''}`}
                            onClick={() => avatarSrc && setShowImageModal(true)}
                            style={{ scale: avatarScale }}
                        >
                            {avatarSrc ? (
                                <CachedImage src={avatarSrc} alt={user.name} className="ud-avatar-img" />
                            ) : (
                                <div className="ud-avatar-initials">
                                    {getInitials(user.name)}
                                </div>
                            )}
                        </motion.div>

                        <h2 className="ud-name">{resolvedName}</h2>
                        {resolvedName !== user.name && (
                            <p className="ud-username">@{user.name}</p>
                        )}

                        <div className="ud-phone-row" onClick={handleCopyPhone}>
                            <span className="ud-phone">{user.phone || 'No phone'}</span>
                            {user.phone && <Copy size={14} className="ud-copy-icon" />}
                        </div>

                        {!isOnline && (
                            <p className="ud-status">
                                <Clock size={12} />
                                {formatLastSeen(currentOnlineStatus?.last_seen || user.last_seen)}
                            </p>
                        )}
                        {isOnline && (
                             <p className="ud-status online">
                                <span className="ud-status-dot" />
                                Online Now
                             </p>
                        )}
                        <div className="ud-hero-merge" />
                    </motion.section>
                </div>

                    {/* ── Quick Actions ── */}
                    {!isOwnProfile && (
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
                    )}

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

                    {/* ── Media, Links, Docs ── */}
                    <motion.section className="ud-section" variants={fadeUp}>
                        <div className="ud-section-header">
                            <Image size={16} />
                            <span>Media, Links & Docs</span>
                            <ChevronRight size={16} className="ud-section-chevron" />
                        </div>
                        <div className="ud-media-grid">
                            <div className="ud-media-stat" onClick={() => showSharedMedia?.(userId, false, true)}>
                                <div className="ud-media-icon images">
                                    <Image size={18} />
                                </div>
                                <div className="ud-media-info">
                                    <span className="ud-media-count">{mediaCount.images}</span>
                                    <span className="ud-media-label">Photos</span>
                                </div>
                            </div>
                            <div className="ud-media-stat" onClick={() => showSharedMedia?.(userId, false, true)}>
                                <div className="ud-media-icon links">
                                    <LinkIcon size={18} />
                                </div>
                                <div className="ud-media-info">
                                    <span className="ud-media-count">{mediaCount.links}</span>
                                    <span className="ud-media-label">Links</span>
                                </div>
                            </div>
                            <div className="ud-media-stat" onClick={() => showSharedMedia?.(userId, false, true)}>
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
                        {!isOwnProfile && (
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
                        )}

                        {/* Add to Contacts */}
                        {!isContact && !isOwnProfile && (
                            <div
                                className={`ud-item ${actionLoading.addContact ? 'loading' : ''}`}
                                onClick={handleAddToContacts}
                            >
                                <div className="ud-item-left">
                                    <div className="ud-item-icon accent">
                                        <Users size={18} />
                                    </div>
                                    <span className="ud-item-label">Add to Circle</span>
                                </div>
                                {actionLoading.addContact
                                    ? <div className="ud-spinner-small" />
                                    : <ChevronRight size={16} className="ud-item-chevron" />
                                }
                            </div>
                        )}

                        {/* Share Circle */}
                        <div className="ud-item" onClick={handleShareContact}>
                            <div className="ud-item-left">
                                <div className="ud-item-icon">
                                    <Share2 size={18} />
                                </div>
                                <span className="ud-item-label">Share Circle Info</span>
                            </div>
                            <ChevronRight size={16} className="ud-item-chevron" />
                        </div>


                        {/* Chat Theme */}
                        {!isOwnProfile && (
                            <div className="ud-item" onClick={showThemeSelector}>
                                <div className="ud-item-left">
                                    <div className="ud-item-icon accent">
                                        <Palette size={18} />
                                    </div>
                                    <span className="ud-item-label">Chat Theme</span>
                                </div>
                                <ChevronRight size={16} className="ud-item-chevron" />
                            </div>
                        )}
                    </motion.section>

                    {/* ── Common Groups ── */}
                    {!isOwnProfile && (
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
                                            onClick={() => {
                                                navigate(`/chat/${group.id}/group`, { 
                                                    state: { groupName: group.name, groupAvatar: group.avatar } 
                                                });
                                                if (isPanel && onClose) onClose();
                                            }}
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
                    )}

                    {/* ── Encryption & Security ── */}
                    {!isOwnProfile && (
                        <motion.section variants={fadeUp}>
                            <div 
                                className="ud-encryption-badge clickable" 
                                onClick={() => setShowSecurityModal(true)}
                            >
                                <Lock size={18} />
                                <div className="ud-enc-info">
                                    <h3>End-to-End Encrypted</h3>
                                    <p>
                                        Messages and calls are secured with AES-256. Click to verify safety code.
                                    </p>
                                </div>
                                <ChevronRight size={16} />
                            </div>

                            <div className="ud-section">
                                <div className="ud-section-header">
                                    <Shield size={16} />
                                    <span>Security Verification</span>
                                </div>
                                <div className="ud-security-code-box" onClick={() => setShowSecurityModal(true)}>
                                    <span className="ud-security-code">{securityCode}</span>
                                    <p className="ud-security-hint">Verify this code with {resolvedName} to ensure your chat is 100% private.</p>
                                </div>
                            </div>
                        </motion.section>
                    )}

                    {/* ── Danger Zone ── */}
                    {!isOwnProfile && (
                        <motion.section className="ud-section ud-danger-section" variants={fadeUp}>
                            <div
                                className={`ud-item danger ${actionLoading.block ? 'loading' : ''}`}
                                onClick={handleBlockUser}
                            >
                                <div className="ud-item-left">
                                    <div className="ud-item-icon danger">
                                        <Ban size={18} />
                                    </div>
                                    <span className="ud-item-label">{isBlocked ? 'Unblock Contact' : 'Block Contact'}</span>
                                </div>
                                {actionLoading.block
                                    ? <div className="ud-spinner-small danger" />
                                    : <ChevronRight size={16} className="ud-item-chevron" />
                                }
                            </div>
                            <div className="ud-item danger" onClick={() => setShowReportModal(true)}>
                                <div className="ud-item-left">
                                    <div className="ud-item-icon danger">
                                        <Flag size={18} />
                                    </div>
                                    <span className="ud-item-label">Report User</span>
                                </div>
                                <ChevronRight size={16} className="ud-item-chevron" />
                            </div>
                            <div className="ud-item danger" onClick={() => setShowDeleteModal(true)}>
                                <div className="ud-item-left">
                                    <div className="ud-item-icon danger">
                                        <Trash2 size={18} />
                                    </div>
                                    <span className="ud-item-label">Delete Chat History</span>
                                </div>
                                <ChevronRight size={16} className="ud-item-chevron" />
                            </div>
                        </motion.section>
                    )}

                    <div className="ud-bottom-spacer" />
                </motion.div>
            </div>

            {/* ── Modals ── */}
            <AnimatePresence>
                {showBlockModal && (
                    <Modal
                        isOpen={showBlockModal}
                        onClose={() => setShowBlockModal(false)}
                        title={isBlocked ? "Unblock User?" : "Block User?"}
                    >
                        <div className="ud-modal-body">
                            <p>
                                {isBlocked 
                                    ? `Are you sure you want to unblock ${resolvedName}? They will be able to message you again.` 
                                    : `Are you sure you want to block ${resolvedName}? They won't be able to message or call you.`
                                }
                            </p>
                            {!isBlocked && (
                                <div className="ud-modal-warning">
                                    <Info size={14} />
                                    <span>Blocked users cannot see your status or last seen.</span>
                                </div>
                            )}
                        </div>
                        <div className="ud-modal-actions">
                            <button className="ud-btn secondary" onClick={() => setShowBlockModal(false)}>Cancel</button>
                            <button 
                                className={`ud-btn ${isBlocked ? 'primary' : 'danger'}`} 
                                onClick={confirmBlock}
                                disabled={actionLoading.block}
                            >
                                {actionLoading.block ? <div className="ud-spinner-small" /> : (isBlocked ? 'Unblock' : 'Block')}
                            </button>
                        </div>
                    </Modal>
                )}

                {showEditContactModal && (
                    <Modal
                        isOpen={showEditContactModal}
                        onClose={() => setShowEditContactModal(false)}
                        title="Edit Contact"
                    >
                        <div className="ud-modal-body">
                            <div className="ud-form-group">
                                <label>Contact Name</label>
                                <input
                                    type="text"
                                    value={contactName}
                                    onChange={(e) => setContactName(e.target.value)}
                                    placeholder="Enter name..."
                                    autoFocus
                                />
                            </div>
                            <p className="ud-modal-subtitle">This name will be used throughout your chats.</p>
                        </div>
                        <div className="ud-modal-actions">
                            <button className="ud-btn secondary" onClick={() => setShowEditContactModal(false)}>Cancel</button>
                            <button 
                                className="ud-btn primary" 
                                onClick={saveContactEdit}
                                disabled={actionLoading.editContact}
                            >
                                {actionLoading.editContact ? <div className="ud-spinner-small" /> : 'Save Changes'}
                            </button>
                        </div>
                    </Modal>
                )}

                {showReportModal && (
                    <Modal
                        isOpen={showReportModal}
                        onClose={() => setShowReportModal(false)}
                        title="Report User"
                    >
                        <div className="ud-modal-body">
                            <p>Why are you reporting this user?</p>
                            <div className="ud-report-options">
                                {['Spam', 'Abuse', 'Inappropriate content', 'Other'].map(option => (
                                    <div 
                                        key={option} 
                                        className={`ud-report-option ${reportReason === option ? 'selected' : ''}`}
                                        onClick={() => setReportReason(option)}
                                    >
                                        <div className="ud-radio-custom" />
                                        <span className="ud-report-label">{option}</span>
                                    </div>
                                ))}
                            </div>
                            {reportReason === 'Other' && (
                                <div className="ud-form-group">
                                    <input
                                        type="text"
                                        placeholder="Please specify..."
                                        value={reportDetails}
                                        onChange={(e) => setReportDetails(e.target.value)}
                                    />
                                </div>
                            )}
                        </div>
                        <div className="ud-modal-actions">
                            <button className="ud-btn secondary" onClick={() => setShowReportModal(false)}>Cancel</button>
                            <button 
                                className="ud-btn danger" 
                                onClick={submitReport}
                                disabled={actionLoading.report || !reportReason}
                            >
                                {actionLoading.report ? <div className="ud-spinner-small" /> : 'Submit Report'}
                            </button>
                        </div>
                    </Modal>
                )}

                {showDeleteModal && (
                    <Modal
                        isOpen={showDeleteModal}
                        onClose={() => setShowDeleteModal(false)}
                        title="Delete Chat History?"
                    >
                        <div className="ud-modal-body">
                            <p>This will permanently delete all messages in your chat with <strong>{resolvedName}</strong>.</p>
                            <div className="ud-modal-warning">
                                <Trash2 size={14} />
                                <span>This action cannot be undone.</span>
                            </div>
                        </div>
                        <div className="ud-modal-actions">
                            <button className="ud-btn secondary" onClick={() => setShowDeleteModal(false)}>Cancel</button>
                            <button 
                                className="ud-btn danger" 
                                onClick={confirmDelete}
                                disabled={actionLoading.delete}
                            >
                                {actionLoading.delete ? <div className="ud-spinner-small" /> : 'Delete Everything'}
                            </button>
                        </div>
                    </Modal>
                )}

                {showSecurityModal && (
                    <Modal
                        isOpen={showSecurityModal}
                        onClose={() => setShowSecurityModal(false)}
                        title="Security Verification"
                    >
                        <div className="ud-security-modal">
                            <div className="ud-sec-icon-large">
                                <Lock size={42} />
                            </div>
                            <p className="ud-sec-desc">
                                To verify that your chat with {resolvedName} is end-to-end encrypted, compare the code below with their device.
                            </p>
                            <div className="ud-sec-code-display">
                                {securityCode}
                            </div>
                            <div className="ud-sec-details">
                                <div className="ud-sec-detail-item">
                                    <CheckCircle2 size={20} />
                                    <div>
                                        <h4>Fully Encrypted</h4>
                                        <p>All data is secured using AES-256 GCM.</p>
                                    </div>
                                </div>
                                <div className="ud-sec-detail-item">
                                    <Shield size={20} />
                                    <div>
                                        <h4>Private Connection</h4>
                                        <p>Only you and {resolvedName} can read messages.</p>
                                    </div>
                                </div>
                            </div>
                            <button className="ud-modal-btn" onClick={() => setShowSecurityModal(false)}>
                                Done
                            </button>
                        </div>
                    </Modal>
                )}

                {showImageModal && avatarSrc && (
                    <Modal
                        isOpen={showImageModal}
                        onClose={() => setShowImageModal(false)}
                        title={resolvedName}
                        size="small"
                        className="ud-avatar-modal"
                    >
                        <div className="ud-image-modal">
                            <CachedImage src={avatarSrc} alt={user.name} className="ud-full-image" />
                        </div>
                    </Modal>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

export default UserDetails;