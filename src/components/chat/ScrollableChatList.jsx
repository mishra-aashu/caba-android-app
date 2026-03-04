import React from 'react';
import { MessageCircle, Search, Plus, Users } from 'lucide-react';
import ChatListItem from './ChatListItem';
import { isUserOnline } from '../../utils/dateFormatter';

const ScrollableChatList = ({
    isDesktop,
    groupChats,
    dmChats,
    filteredChats,
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
        <div
            className="chat-list-wrapper chat-list-container scrollable-area"
            onScroll={handleChatListScroll}
            ref={chatListRef}
            style={{
                flex: 1,
                overflowY: 'auto',
                overflowX: 'hidden',
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column'
            }}
        >
            {/* Desktop Groups Sidebar Section */}
            {isDesktop && groupChats.length > 0 && !searchTerm && (
                <div className="sidebar-groups-section">
                    <div className="sidebar-section-header">
                        <h3>Groups</h3>
                        <button className="create-group-icon-btn" onClick={() => setShowCreateGroupModal(true)}>
                            <Plus size={16} />
                        </button>
                    </div>
                    <div className="sidebar-groups-list">
                        {groupChats.map(group => (
                            <div
                                key={group.id}
                                className={`sidebar-group-item ${currentChatId === group.id ? 'active' : ''}`}
                                onClick={() => handleChatClick(group)}
                            >
                                <div className="sidebar-group-avatar">
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
                                    <div className="group-avatar-fallback">
                                        <Users size={22} />
                                    </div>
                                </div>
                                <div className="sidebar-group-info">
                                    <span className="sidebar-group-name">{group.name}</span>
                                    {group.unreadCount > 0 && <span className="unread-dot"></span>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Main Chat List (DMs on Desktop, Unified on Mobile) */}
            <div className="chat-items-section" style={{ display: 'flex', flexDirection: 'column' }}>
                {isDesktop && !searchTerm && <div className="sidebar-section-header"><h3>Messages</h3></div>}

                {(isDesktop ? dmChats : filteredChats).length > 0 ? (
                    (isDesktop ? dmChats : filteredChats).map(renderChatItem)
                ) : (
                    !isDesktop && groupChats.length === 0 && (
                        <div className="empty-state">
                            <MessageCircle size={48} className="empty-state-icon" />
                            <h3>No conversations yet</h3>
                            <p>Start messaging your contacts</p>
                        </div>
                    )
                )}

                {/* Search results placeholder when searching */}
                {searchTerm && filteredChats.length === 0 && (
                    <div className="empty-state">
                        <Search size={48} className="empty-state-icon" />
                        <h3>No results found</h3>
                        <p>Try searching with another name or phone</p>
                    </div>
                )}
            </div>

            {loadingMore && (
                <div className="load-more-chats">
                    <div className="loading-spinner"></div>
                    <p>Loading more chats...</p>
                </div>
            )}
        </div>
    );
};

export default ScrollableChatList;
