/**
 * ChatHeader.jsx
 *
 * Presentational component for the Chat screen's header.
 * Extracted from the monolithic Chat.jsx to improve maintainability.
 *
 * FIXES APPLIED:
 * [FIX #1] Removed dead `avatarSrc` computation — `resolvedAvatar` is the one actually used
 * [FIX #2] Fixed double dividers in menu when isAdmin is false
 * [FIX #3] Added search for group chats — was only available for DMs
 * [FIX #4] Group typing now shows WHO is typing
 */
import React, { memo, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    Phone, Video, User, Bell, BellOff, Search, Plus,
    Image as ImageIcon, Palette, Clock, Settings as SettingsIcon,
    Trash2, ArrowLeft, Gamepad2, Crown, MousePointer,
    Copy, ArrowRight, X, Lock
} from 'lucide-react';
import DropdownMenu from '../../common/DropdownMenu';
import { formatLastSeen, isUserOnline } from '../../../utils/dateFormatter';
import { useResolveName } from '../../../hooks/useResolveName';
import { useResolveAvatar } from '../../../hooks/useResolveAvatar';
import styles from '../../../styles/chat.module.css';
import useChatStore from '../../../store/useChatStore';

const ChatHeader = memo(({
    chatId,
    otherUser,
    isGroupChat,
    isDesktop,
    typingUsers,
    isMuted,
    isTempChat,
    // Handlers
    onVoiceCall,
    onVideoCall,
    onMuteToggle,
    onViewContact,
    onSearchMessages,
    onChangeTheme,
    onShowSharedMedia,
    onShowGame,
    onShowGroupInfo,
    onBlockUser,
    onClearChat,
    onCreateReminder,
    onTempChatToggle,
    onTempChatSettings,
    onDeleteSelected,
    onCopySelected,
    onForwardSelected,
    onNavigate,
    onAddMember,
    isAdmin,
}) => {
    const isSelectionMode = useChatStore(state => state.isSelectionMode);
    const selectedCount = useChatStore(state => state.selectedMessageIds.size);
    const clearSelection = useChatStore(state => state.clearSelection);
    const clearActiveChat = useChatStore(state => state.clearActiveChat);
    const setSelectionMode = useChatStore(state => state.setSelectionMode);

    const navigate = useNavigate();
    const location = useLocation();
    const resolvedName = useResolveName(!isGroupChat ? otherUser?.id : null, otherUser?.name);
    const resolvedAvatar = useResolveAvatar(!isGroupChat ? otherUser?.id : null, otherUser?.avatar || otherUser?.avatar_url);

    const [imgError, setImgError] = React.useState(false);

    const resolvedNavigate = onNavigate || navigate;

    const handleAvatarClick = () => {
        if (isSelectionMode) return;
        if (isGroupChat) {
            isDesktop ? onShowGroupInfo?.() : resolvedNavigate(`/chat/${chatId}/group/info`);
        } else {
            onViewContact?.();
        }
    };

    // [FIX #1] Removed dead `avatarSrc` computation
    // Previously: avatarSrc was computed with dpOptions lookup but NEVER used in JSX
    // resolvedAvatar (from useResolveAvatar hook) is what's actually rendered

    // [FIX #4] Group typing shows WHO is typing
    const statusText = useMemo(() => {
        if (isGroupChat) {
            const typingNames = Object.values(typingUsers || {});
            if (typingNames.length > 0) {
                if (typingNames.length === 1) {
                    return `${typingNames[0]?.name || 'Someone'} is typing...`;
                }
                if (typingNames.length === 2) {
                    return `${typingNames[0]?.name || 'Someone'} and ${typingNames[1]?.name || 'someone'} are typing...`;
                }
                return `${typingNames.length} people are typing...`;
            }
            return otherUser?.member_count ? `${otherUser.member_count} members` : '';
        }

        // DM chat
        if (!otherUser) return 'Loading...';

        const typingKeys = Object.keys(typingUsers || {});
        if (typingKeys.length > 0) return 'typing...';

        if (isUserOnline(Boolean(otherUser.is_online || otherUser.isOnline), otherUser.last_seen || otherUser.lastSeen)) {
            return 'Online';
        }
        const lastSeen = otherUser.last_seen || otherUser.lastSeen;
        return lastSeen ? `Last seen ${formatLastSeen(lastSeen)}` : '';
    }, [isGroupChat, otherUser, typingUsers]);

    // [FIX #2] Build menu items without double dividers
    const menuItems = useMemo(() => {
        const items = [];

        // View contact/group info
        if (isGroupChat) {
            items.push({
                icon: <User size={16} />,
                label: 'View Group Info',
                onClick: () => isDesktop ? onShowGroupInfo?.() : resolvedNavigate(`/chat/${chatId}/group/info`),
            });
            
            if (isAdmin) {
                items.push({
                    icon: <Plus size={16} />,
                    label: 'Add Members',
                    onClick: onAddMember,
                });
            }
        } else {
            items.push({
                icon: <User size={16} />,
                label: 'View Contact',
                onClick: onViewContact,
            });
        }

        // [FIX #3] Search available for BOTH group and DM chats
        items.push({
            icon: <Search size={16} />,
            label: 'Search Messages',
            onClick: onSearchMessages,
        });

        // Notifications
        items.push({
            icon: isMuted ? <Bell size={16} /> : <BellOff size={16} />,
            label: isMuted ? 'Unmute Notifications' : 'Mute Notifications',
            onClick: onMuteToggle,
        });

        // Only for DM chats
        if (!isGroupChat) {
            items.push({
                icon: <Bell size={16} />,
                label: 'Create Reminder',
                onClick: onCreateReminder,
            });
        }

        // Theme & Media
        items.push({
            icon: <Palette size={16} />,
            label: 'Themes',
            onClick: onChangeTheme,
        });
        items.push({
            icon: <ImageIcon size={16} />,
            label: 'Shared Media',
            onClick: onShowSharedMedia,
        });
        items.push({
            icon: <Gamepad2 size={16} />,
            label: 'Game Room',
            onClick: onShowGame,
        });

        // [FIX #2] Single divider before admin/settings section
        items.push({ divider: true });

        // Admin (only if user is admin)
        if (isAdmin) {
            items.push({
                icon: <Crown size={16} />,
                label: 'Admin',
                onClick: () => resolvedNavigate('/admin'),
            });
        }

        // Vanish Mode settings
        if (!isGroupChat) {
            items.push({
                icon: <Clock size={16} />,
                label: isTempChat ? 'Disable Vanish Mode' : 'Enable Vanish Mode',
                onClick: onTempChatToggle,
            });
            
            // Vanish Settings are now ALWAYS visible in DMs
            items.push({
                icon: <SettingsIcon size={16} />,
                label: 'Vanish Settings',
                onClick: onTempChatSettings,
            });

            items.push({
                icon: <Trash2 size={16} />,
                label: 'Clear Chat',
                onClick: onClearChat,
            });
        }


        // Selection mode
        items.push({
            icon: <MousePointer size={16} />,
            label: 'Select Messages',
            onClick: () => setSelectionMode(true),
        });

        // [FIX #2] Single divider before danger zone
        items.push({ divider: true });

        // Block/Leave
        if (isGroupChat) {
            items.push({
                icon: <span style={{ fontSize: '16px' }}>🚫</span>,
                label: 'Leave Group',
                onClick: () => isDesktop ? onShowGroupInfo?.() : resolvedNavigate(`/chat/${chatId}/group/info`),
                danger: true,
            });
        } else {
            items.push({
                icon: <span style={{ fontSize: '16px' }}>🚫</span>,
                label: 'Block User',
                onClick: onBlockUser,
                danger: true,
            });
        }

        return items;
    }, [
        isGroupChat, isDesktop, chatId, isMuted, isTempChat, isAdmin,
        onViewContact, onShowGroupInfo, onSearchMessages, onMuteToggle,
        onCreateReminder, onChangeTheme, onShowGame, onTempChatToggle,
        onTempChatSettings, onClearChat, onBlockUser, setSelectionMode,
        resolvedNavigate, location.pathname,
    ]);

    // ─── SELECTION MODE HEADER ───
    if (isSelectionMode) {
        return (
            <header className={`${styles['chat-header']} ${styles['selectionModeHeader']}`}>
                <button 
                    type="button"
                    className={styles['back-btn']} 
                    onClick={(e) => {
                        e.stopPropagation();
                        clearSelection();
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    title="Cancel selection"
                    style={{ zIndex: 99999, position: 'relative', pointerEvents: 'auto' }}
                >
                    <ArrowLeft size={24} />
                </button>
                <div className={styles['selectionHeaderInfo']}>
                    <h3>{selectedCount} Selected</h3>
                </div>
                <div className={styles['chat-actions']}>
                    {selectedCount > 0 && (
                        <>
                            <button className={styles['icon-btn']} onClick={onCopySelected} title="Copy">
                                <Copy size={20} />
                            </button>
                            <button className={styles['icon-btn']} onClick={onForwardSelected} title="Forward">
                                <ArrowRight size={20} />
                            </button>
                            <button className={styles['icon-btn']} onClick={onDeleteSelected} title="Delete">
                                <Trash2 size={20} />
                            </button>
                        </>
                    )}
                    <button className={styles['icon-btn']} onClick={clearSelection} title="Cancel">
                        <X size={20} />
                    </button>
                </div>
            </header>
        );
    }

    // ─── NORMAL HEADER ───
    return (
        <header className={styles['chat-header']}>
            <button 
                type="button"
                className={styles['back-btn']} 
                onPointerDown={(e) => {
                    e.stopPropagation();
                }}
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('[ChatHeader] Back button clicked - navigating back to list');
                    clearActiveChat(); 
                    // [FIX] Always use React Router navigate to prevent full page reload
                    navigate('/');
                }}
                style={{ 
                    zIndex: 99999, 
                    position: 'relative', 
                    pointerEvents: 'auto',
                    cursor: 'pointer',
                    WebkitTapHighlightColor: 'transparent'
                }}
            >
                <ArrowLeft size={24} />
            </button>

            <div
                className={styles['chat-user-info']}
                onClick={handleAvatarClick}
                style={{ cursor: otherUser ? 'pointer' : 'default' }}
            >
                <div className={styles['user-avatar']}>
                    {resolvedAvatar && !imgError ? (
                        <img
                            src={resolvedAvatar}
                            alt={otherUser?.name || 'User'}
                            onError={() => setImgError(true)}
                        />
                    ) : (
                        <div
                            className={styles['avatar-fallback']}
                            style={{
                                width: '100%',
                                height: '100%',
                                fontSize: '0.9rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: 'linear-gradient(135deg, var(--brand-primary, #00a884) 0%, var(--brand-secondary, #00876a) 100%)',
                                borderRadius: '50%',
                                color: 'white',
                            }}
                        >
                            <User size={20} />
                        </div>
                    )}
                </div>
                <div className={styles['user-details']}>
                    <h3 className={styles['user-name']}>
                        {isGroupChat
                            ? (otherUser?.name || 'Group Chat')
                            : resolvedName}
                        <Lock size={12} style={{ marginLeft: '6px', opacity: 0.6, color: 'var(--brand-primary)' }} />
                    </h3>
                    <p className={styles['user-status']}>{statusText}</p>
                </div>
            </div>

            <div className={styles['chat-actions']}>
                <button className={styles['icon-btn']} onClick={onVoiceCall} title="Voice Call">
                    <Phone size={20} />
                </button>
                <button className={styles['icon-btn']} onClick={onVideoCall} title="Video Call">
                    <Video size={20} />
                </button>
                <DropdownMenu items={menuItems} />
            </div>
        </header>
    );
});

ChatHeader.displayName = 'ChatHeader';

export default ChatHeader;