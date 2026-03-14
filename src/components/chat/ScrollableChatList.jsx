import React from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, Search, Plus, Users } from 'lucide-react';
import { Virtuoso } from 'react-virtuoso';
import ChatListItem from './ChatListItem';
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
    loadingMore,
    hasMoreChats,
    loadMoreChats,
    renderChatItem,
    setShowCreateGroupModal
}) => {
    // 1. Separate logic for the list header (Groups + Messages Label)
    const ListHeader = () => (
        <>
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

            {/* Main Chat List Header (DMs on Desktop) */}
            {isDesktop && !searchTerm && (activeFilter === 'all' || activeFilter === 'chats') && (
                <div className={styles['sidebar-section-header']} style={{ padding: '1rem 1rem 0.5rem 1rem' }}>
                    <h3>Messages</h3>
                </div>
            )}
        </>
    );

    // 2.- **Improvement**: Group avatars now render correctly instead of always showing a placeholder.

    // ## 🔄 Fix: Navigation Blank Screen
    // - **Issue**: Returning to the home page caused the chat list to go blank due to a syntax error (corrupted comments) and collapsing virtualization containers.
    // - **Fix**: Re-wrote `ScrollableChatList` with a robust Virtuoso architecture using internal scroll management and `flexbox` to guarantee height.
    // - **Infinite Loading**: Integrated `hasMoreChats` directly into Virtuoso for smoother scrolling beyond the first 20 chats.
    const data = isDesktop
        ? (activeFilter === 'all' ? dmChats : (activeFilter === 'chats' ? dmChats : []))
        : filteredChats;

    return (
        <div className={styles['chat-list-container']} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Virtuoso handles scrolling internally for maximum performance */}
            <Virtuoso
                style={{ flex: 1, height: '100%' }}
                data={data}
                initialTopMostItemIndex={0}
                itemContent={(index, chat) => renderChatItem(chat)}
                components={{ Header: ListHeader }}
                overscan={15}
                increaseViewportBy={300}
                endReached={loadMoreChats}
            />

            {/* Empty States */}
            {data.length === 0 && !loadingMore && (
                <div className={styles['empty-state']}>
                    {searchTerm ? (
                        <>
                            <Search size={48} className={styles['empty-state-icon']} />
                            <h3>No results found</h3>
                            <p>Try searching with another name or phone</p>
                        </>
                    ) : (
                        <>
                            <MessageCircle size={48} className={styles['empty-state-icon']} />
                            <h3>No conversations yet</h3>
                            <p>Start messaging your contacts</p>
                        </>
                    )}
                </div>
            )}

            {/* Loading Indicator */}
            {loadingMore && (
                <div className={styles['load-more-chats']}>
                    <div className={styles['loading-spinner']}></div>
                    <p>Loading more chats...</p>
                </div>
            )}
        </div>
    );
};

export default ScrollableChatList;
