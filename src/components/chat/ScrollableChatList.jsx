import React from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, Search, Plus, Users } from 'lucide-react';
import ChatListItem from './ChatListItem';
import { isUserOnline } from '../../utils/dateFormatter';
import styles from '../../styles/ChatListItem.module.css';

const ScrollableChatList = ({
    isDesktop,
    groupChats,
    dmChats,
    filteredChats,
    activeFilter,
    searchTerm,
    currentChatId,
    handleChatClick,
    handleChatListScroll,
    chatListRef,
    loadingMore,
    renderChatItem, // We can also define it here but keeping it flexible
    setShowCreateGroupModal
}) => {
    return (
        <motion.div
            layout
            className={`${styles['chat-list-container']} ${styles['scrollable-area']}`}
            onScroll={handleChatListScroll}
            ref={chatListRef}
        >
            {/* Desktop Groups Sidebar Section — Show only if 'all' or 'groups' is active */}
            {isDesktop && groupChats.length > 0 && !searchTerm && (activeFilter === 'all' || activeFilter === 'groups') && (
                <div className={styles['sidebar-groups-section']}>
                    <div className={styles['sidebar-section-header']}>
                        <h3>Groups</h3>
                        <button className={styles['create-group-icon-btn']} onClick={() => setShowCreateGroupModal(true)}>
                            <Plus size={16} />
                        </button>
                    </div>
                    <div className={styles['sidebar-groups-list']}>
                        {groupChats.map(group => (
                            <div
                                key={group.id}
                                className={`${styles['sidebar-group-item']} ${currentChatId === group.id ? styles.active : ''}`}
                                onClick={() => handleChatClick(group)}
                            >
                                <div className={styles['sidebar-group-avatar']}>
                                    {group.avatar ? (
                                        <img
                                            src={group.avatar}
                                            alt={group.name}
                                            onError={(e) => {
                                                e.target.style.display = 'none';
                                                e.target.nextSibling.style.display = 'flex';
                                            }}
                                        />
                                    ) : null}
                                    <div className={styles['group-avatar-fallback']}>
                                        <Users size={22} />
                                    </div>
                                </div>
                                <div className={styles['sidebar-group-info']}>
                                    <span className={styles['sidebar-group-name']}>{group.name}</span>
                                    {group.unreadCount > 0 && <span className={styles['unread-dot']}></span>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Main Chat List (DMs on Desktop, Unified on Mobile) */}
            <div className={styles['chat-items-section']}>
                {isDesktop && !searchTerm && (activeFilter === 'all' || activeFilter === 'chats') && (
                    <div className={styles['sidebar-section-header']}><h3>Messages</h3></div>
                )}

                {(isDesktop ? (activeFilter === 'all' ? dmChats : (activeFilter === 'chats' ? dmChats : [])) : filteredChats).length > 0 ? (
                    (isDesktop ? (activeFilter === 'all' ? dmChats : (activeFilter === 'chats' ? dmChats : [])) : filteredChats).map(renderChatItem)
                ) : (
                    (!isDesktop || activeFilter !== 'all') && (isDesktop ? (activeFilter === 'chats' ? dmChats.length === 0 : true) : true) && groupChats.length === 0 && (
                        <div className={styles['empty-state']}>
                            <MessageCircle size={48} className={styles['empty-state-icon']} />
                            <h3>No conversations yet</h3>
                            <p>Start messaging your contacts</p>
                        </div>
                    )
                )}

                {/* Search results placeholder when searching */}
                {searchTerm && filteredChats.length === 0 && (
                    <div className={styles['empty-state']}>
                        <Search size={48} className={styles['empty-state-icon']} />
                        <h3>No results found</h3>
                        <p>Try searching with another name or phone</p>
                    </div>
                )}
            </div>

            {loadingMore && (
                <div className={styles['load-more-chats']}>
                    <div className={styles['loading-spinner']}></div>
                    <p>Loading more chats...</p>
                </div>
            )}
        </motion.div>
    );
};

export default ScrollableChatList;
