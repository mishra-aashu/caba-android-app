import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, Clock, User, Users } from 'lucide-react';
import { formatInboxTime } from '../../utils/dateFormatter';
import { resolveAvatarUrl } from '../../utils/avatarHelpers';
import styles from '../../styles/ChatListItem.module.css';

const MessageSearchResultItem = ({ 
    result, 
    searchTerm, 
    onClick 
}) => {
    const {
        content,
        chatName,
        senderName,
        chatAvatar,
        createdAt,
        chatId,
        senderId
    } = result;

    const displayTime = formatInboxTime(createdAt);
    const resolvedAvatar = resolveAvatarUrl(chatAvatar);

    // Highlight search term in content
    const highlightSearchTerm = (text, term) => {
        if (!term) return text;
        // Escape special regex characters to prevent crashes
        const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const parts = text.split(new RegExp(`(${escapedTerm})`, 'gi'));
        return (
            <span>
                {parts.map((part, i) => 
                    part.toLowerCase() === term.toLowerCase() ? (
                        <mark key={i} className={styles['search-highlight']}>{part}</mark>
                    ) : part
                )}
            </span>
        );
    };

    return (
        <motion.button
            className={styles['search-result-item']}
            onClick={() => onClick(result)}
            whileHover={{ backgroundColor: 'var(--hover-color, rgba(0, 168, 132, 0.08))' }}
            whileTap={{ scale: 0.98 }}
            type="button"
        >
            <div className={styles['result-avatar-container']}>
                {resolvedAvatar ? (
                    <img src={resolvedAvatar} alt="" className={styles['result-avatar']} />
                ) : (
                    <div className={styles['result-avatar-fallback']}>
                        {result.isGroupMessage ? <Users size={18} /> : <User size={18} />}
                    </div>
                )}
            </div>
            
            <div className={styles['result-content']}>
                <div className={styles['result-header']}>
                    <span className={styles['result-chat-name']}>{chatName}</span>
                    <span className={styles['result-time']}>
                        <Clock size={12} style={{ marginRight: 4 }} />
                        {displayTime}
                    </span>
                </div>
                
                <div className={styles['result-sender']}>
                    {senderName}:
                </div>
                
                <div className={styles['result-snippet']}>
                    <MessageSquare size={14} style={{ marginRight: 6, opacity: 0.6, flexShrink: 0 }} />
                    <p>{highlightSearchTerm(content, searchTerm)}</p>
                </div>
            </div>
        </motion.button>
    );
};

export default memo(MessageSearchResultItem);
