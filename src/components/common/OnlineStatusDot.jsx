import React, { useContext, useMemo } from 'react';
import { GameLobbyContext } from '../../contexts/GameLobbyContext';
import styles from '../../styles/ChatListItem.module.css';

/**
 * OnlineStatusDot
 * 
 * A high-performance component that renders an online status indicator.
 * Consumes the global GameLobbyContext to stay updated without re-rendering
 * the entire parent list.
 */
const OnlineStatusDot = ({ userId, showOffline = false }) => {
    const lobby = useContext(GameLobbyContext);
    const onlineUsers = lobby?.onlineUsers || [];

    const isOnline = useMemo(() => {
        if (!userId) return false;
        // String comparison to handle both numerical and UUID formats
        return onlineUsers.some(u => String(u.id) === String(userId));
    }, [onlineUsers, userId]);

    if (!isOnline && !showOffline) return null;

    return (
        <span 
            className={`${styles['online-dot']} ${!isOnline ? styles['offline'] : ''}`} 
            title={isOnline ? 'Online' : 'Offline'}
        />
    );
};

export default React.memo(OnlineStatusDot);
