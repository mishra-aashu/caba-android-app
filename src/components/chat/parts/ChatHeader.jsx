/**
 * ChatHeader.jsx
 *
 * Presentational component for the Chat screen's header.
 * Extracted from the monolithic Chat.jsx to improve maintainability.
 * Receives all state and handlers as props from the Chat component (via useChatRoom).
 */
import React, { memo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Phone, Video, User, Bell, BellOff, Search, Image as ImageIcon, Palette, Clock, Settings as SettingsIcon, Trash2, Ban, ArrowLeft, Gamepad2, Crown, MousePointer, Copy, ArrowRight } from 'lucide-react';
import DropdownMenu from '../../common/DropdownMenu';
import { dpOptions } from '../../../utils/dpOptions';
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
    isAdmin,
}) => {
    const isSelectionMode = useChatStore(state => state.isSelectionMode);
    const selectedCount = useChatStore(state => state.selectedMessageIds.size);

    const clearSelection = useChatStore(state => state.clearSelection);
    const setSelectionMode = useChatStore(state => state.setSelectionMode);

    // Legacy delete/copy/forward handlers passed from Chat.jsx
    // We'll keep them as props for now if they involve complex logic like Supabase calls
    // which are already in Chat.jsx (until we move those to a separate service/hook)
    
    const navigate = useNavigate();
    const location = useLocation();
    const resolvedName = useResolveName(!isGroupChat ? otherUser?.id : null, otherUser?.name);
    const resolvedAvatar = useResolveAvatar(!isGroupChat ? otherUser?.id : null, otherUser?.avatar);

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

    const avatarSrc = otherUser?.avatar
        ? (parseInt(otherUser.avatar)
            ? dpOptions.find(dp => dp.id === parseInt(otherUser.avatar))?.path || otherUser.avatar
            : otherUser.avatar)
        : null;

    const statusText = isGroupChat
        ? (otherUser?.member_count ? `${otherUser.member_count} members` : '')
        : (otherUser
            ? (Object.keys(typingUsers || {}).length > 0
                ? 'typing...'
                : isUserOnline(Boolean(otherUser.is_online), otherUser.last_seen)
                    ? 'Online'
                    : `Last seen ${formatLastSeen(otherUser.last_seen)}`)
            : 'Loading...');

    const menuItems = [
        ...(isGroupChat
            ? [{ icon: <User size={16} />, label: 'View Group Info', onClick: () => isDesktop ? onShowGroupInfo?.() : resolvedNavigate(`/chat/${chatId}/group/info`) }]
            : [{ icon: <User size={16} />, label: 'View Contact', onClick: onViewContact }]
        ),
        { icon: <Bell size={16} />, label: 'Create Reminder', onClick: onCreateReminder },
        { icon: isMuted ? <Bell size={16} /> : <BellOff size={16} />, label: isMuted ? 'Unmute Notifications' : 'Mute Notifications', onClick: onMuteToggle },
        ...(!isGroupChat ? [{ icon: <Search size={16} />, label: 'Search Messages', onClick: onSearchMessages }] : []),
        { icon: <Palette size={16} />, label: 'Themes', onClick: onChangeTheme },
        { icon: <ImageIcon size={16} />, label: 'Shared Media', onClick: () => resolvedNavigate(`${location.pathname}/media`) },
        { icon: <Gamepad2 size={16} />, label: 'Game Room', onClick: onShowGame },
        { divider: true },
        ...(isAdmin ? [{
            icon: <Crown size={16} />,
            label: 'Admin',
            onClick: () => (onNavigate || navigate)('/admin')
        }] : []),
        { divider: true },
        ...(!isGroupChat ? [
            { icon: <Clock size={16} />, label: isTempChat ? 'Disable Temporary Chat' : 'Enable Temporary Chat', onClick: onTempChatToggle },
            { icon: <SettingsIcon size={16} />, label: 'Temp Chat Settings', onClick: onTempChatSettings, disabled: !isTempChat },
            { icon: <Trash2 size={16} />, label: 'Clear Chat', onClick: onClearChat },
        ] : []),
        { icon: <MousePointer size={16} />, label: 'Select Messages', onClick: () => setSelectionMode(true) },
        ...(isGroupChat
            ? [{ divider: true }, { icon: <Ban size={16} />, label: 'Leave Group', onClick: () => isDesktop ? onShowGroupInfo?.() : resolvedNavigate(`/chat/${chatId}/group/info`), danger: true }]
            : [{ divider: true }, { icon: <Ban size={16} />, label: 'Block User', onClick: onBlockUser, danger: true }]
        ),
    ];

    if (isSelectionMode) {
        return (
            <header className={`${styles['chat-header']} ${styles['selectionModeHeader']}`}>
                <button className={styles['back-btn']} onClick={clearSelection}>
                    <ArrowLeft size={20} />
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
                        ✕
                    </button>
                </div>
            </header>
        );
    }

    return (
        <header className={styles['chat-header']}>
            <button className={styles['back-btn']} onClick={() => resolvedNavigate('/')}>
                <ArrowLeft size={20} />
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
                            alt={otherUser?.name}
                            onError={() => setImgError(true)}
                        />
                    ) : (
                        <div className={styles['avatar-fallback']} style={{ width: '100%', height: '100%', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, var(--brand-primary, #00a884) 0%, var(--brand-secondary, #00876a) 100%)', borderRadius: '50%', color: 'white' }}>
                            <User size={20} />
                        </div>
                    )}
                </div>
                <div className={styles['user-details']}>
                    <h3 className={styles['user-name']}>
                        {isGroupChat
                            ? (otherUser?.name || 'Group Chat')
                            : resolvedName}
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

export default ChatHeader;
