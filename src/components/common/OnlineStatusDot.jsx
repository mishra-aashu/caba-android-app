import React from 'react';
import usePresenceStore from '../../store/usePresenceStore';
import styles from '../../styles/ChatListItem.module.css';

/**
 * OnlineStatusDot
 * 
 * A high-performance component that renders an online status indicator.
 * Consumes usePresenceStore to stay updated without re-rendering
 * the entire parent list.
 */
const OnlineStatusDot = ({ userId, showOffline = false }) => {
    const isOnline = usePresenceStore(state => state.isUserOnline(userId));

    if (!isOnline && !showOffline) return null;

    return (
        <span 
            className={`${styles['online-dot']} ${!isOnline ? styles['offline'] : ''}`} 
            title={isOnline ? 'Online' : 'Offline'}
        />
    );
};


export default React.memo(OnlineStatusDot);
