/**
 * ChatHeader.jsx
 *
 * Presentational component for the Chat screen's header.
 * Extracted from the monolithic Chat.jsx to improve maintainability.
 * Receives all state and handlers as props from the Chat component (via useChatRoom).
 */
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Phone, Video, User, Bell, BellOff, Search, Image as ImageIcon, Palette, Clock, Settings as SettingsIcon, Trash2, Ban, ArrowLeft, Gamepad2 } from 'lucide-react';
import DropdownMenu from '../../common/DropdownMenu';
import { dpOptions } from '../../../utils/dpOptions';
import { formatLastSeen, isUserOnline } from '../../../utils/dateFormatter';
import { useResolveName } from '../../../hooks/useResolveName';

const ChatHeader = ({
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
    onShowWallpaper,
    onShowGame,
    onShowGroupInfo,
    onBlockUser,
    onClearChat,
    onCreateReminder,
    onTempChatToggle,
    onTempChatSettings,
    onNavigate,
}) => {
    const navigate = useNavigate();
    const location = useLocation();
    const resolvedName = useResolveName(!isGroupChat ? otherUser?.id : null, otherUser?.name);

    const resolvedNavigate = onNavigate || navigate;

    const handleAvatarClick = () => {
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
        { icon: <ImageIcon size={16} />, label: 'Chat Wallpaper', onClick: onShowWallpaper },
        { icon: <Gamepad2 size={16} />, label: 'Game Room', onClick: onShowGame },
        { divider: true },
        ...(!isGroupChat ? [
            { icon: <Clock size={16} />, label: isTempChat ? 'Disable Temporary Chat' : 'Enable Temporary Chat', onClick: onTempChatToggle },
            { icon: <SettingsIcon size={16} />, label: 'Temp Chat Settings', onClick: onTempChatSettings, disabled: !isTempChat },
            { icon: <Trash2 size={16} />, label: 'Clear Chat', onClick: onClearChat },
        ] : []),
        ...(isGroupChat
            ? [{ divider: true }, { icon: <Ban size={16} />, label: 'Leave Group', onClick: () => isDesktop ? onShowGroupInfo?.() : resolvedNavigate(`/chat/${chatId}/group/info`), danger: true }]
            : [{ divider: true }, { icon: <Ban size={16} />, label: 'Block User', onClick: onBlockUser, danger: true }]
        ),
    ];

    return (
        <header className="chat-header">
            <button className="back-btn" onClick={() => resolvedNavigate('/')}>
                <ArrowLeft size={20} />
            </button>

            <div
                className="chat-user-info"
                onClick={handleAvatarClick}
                style={{ cursor: otherUser ? 'pointer' : 'default' }}
            >
                <div className="user-avatar">
                    {avatarSrc ? (
                        <img src={avatarSrc} alt={otherUser?.name} />
                    ) : (
                        <div className="user-avatar-loading" />
                    )}
                </div>
                <div className="user-details">
                    <h3 className="user-name">
                        {isGroupChat
                            ? (otherUser?.name || 'Group Chat')
                            : resolvedName}
                    </h3>
                    <p className="user-status">{statusText}</p>
                </div>
            </div>

            <div className="chat-actions">
                <button className="icon-btn" onClick={onVoiceCall} title="Voice Call">
                    <Phone size={20} />
                </button>
                <button className="icon-btn" onClick={onVideoCall} title="Video Call">
                    <Video size={20} />
                </button>
                <DropdownMenu items={menuItems} />
            </div>
        </header>
    );
};

export default ChatHeader;
