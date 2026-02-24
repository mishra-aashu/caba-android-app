import React, { useRef, useState, useMemo } from 'react';
import { useSupabase } from '../contexts/SupabaseContext';
import {
  MessageCircle,
  User,
  Search,
  MoreVertical,
  Plus,
  Bell,
  Info,
  HelpCircle,
  LogOut,
  Crown,
  Users,
  Settings,
  MessageSquarePlus,
  Edit,
  Trash2,
  X
} from 'lucide-react';
import DropdownMenu from './common/DropdownMenu';
import Modal from './common/Modal';
import ChatListItem from './chat/ChatListItem';
import { getInitials } from '../utils/stringUtils';
import { isUserOnline } from '../utils/timeUtils';
import CreateGroupModal from './groups/CreateGroupModal';
import { useGroupActions } from '../hooks/useGroupActions';
import ScrollableChatList from './chat/ScrollableChatList';

const ChatListPanel = ({
  searchTerm,
  setSearchTerm,
  showSearch,
  setShowSearch,
  searchSuggestions,
  showSuggestions = false,
  setShowSuggestions,
  handleSearchChange,
  handleSuggestionClick,
  handleChatClick,
  filteredChats, // These are passed from MainLayout, but we'll use 'chats' from hook or props
  handleChatListScroll,
  chatListRef,
  loadingMore,
  hasMoreChats,
  dpOptions,
  formatTime,
  setShowNewContactModal,
  handleNavigation,
  handleAboutApp,
  handleHelp,
  handleLogout,
  isAdmin,
  savedContacts,
  isDesktop,
  currentChatId,
  handleChatListRefresh, // Refresh handler from MainLayout
}) => {
  const { supabase } = useSupabase();
  const { useUserGroups } = useGroupActions();

  // State for Create Group Modal
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);

  // Separate DMs and Groups for specific layouts
  const { dmChats, groupChats } = useMemo(() => {
    const dms = filteredChats.filter(chat => !chat.isGroup);
    const groups = filteredChats.filter(chat => chat.isGroup);
    return { dmChats: dms, groupChats: groups };
  }, [filteredChats]);

  const dropdownItems = [
    {
      icon: <User size={16} />,
      label: 'Profile',
      onClick: () => handleNavigation('/profile')
    },
    {
      icon: <Settings size={16} />,
      label: 'Settings',
      onClick: () => handleNavigation('/settings')
    },
    {
      icon: <Users size={16} />,
      label: 'Groups',
      onClick: () => handleNavigation('/groups')
    },
    {
      icon: <Bell size={16} />,
      label: 'Check Reminders',
      onClick: () => handleNavigation('/reminders')
    },
    ...(isAdmin ? [{
      icon: <Crown size={16} />,
      label: 'Admin Panel',
      onClick: () => handleNavigation('/admin')
    }] : []),
    { divider: true },
    {
      icon: <Info size={16} />,
      label: 'About App',
      onClick: handleAboutApp
    },
    {
      icon: <HelpCircle size={16} />,
      label: 'Help',
      onClick: handleHelp
    },
    { divider: true },
    {
      icon: <LogOut size={16} />,
      label: 'Logout',
      onClick: handleLogout
    }
  ];

  // Helper for rendering chat list items
  const renderChatItem = (chat) => {
    // 1. Resolve contact
    const otherUserId = chat.metadata?.otherUserId || chat.otherUser_id || chat.otherUser?.id || chat.id;
    const contact = savedContacts.find(c => c.contact_user_id === otherUserId || c.id === otherUserId);

    // 2. Resolve display name with fallbacks
    const displayName = contact?.contact_name || chat.name;

    // 3. Process avatar
    // Try to get avatar from chat object, fallback to contact or otherUser
    let rawAvatar = chat.avatar || contact?.otherUser?.avatar || chat.otherUser?.avatar;

    let avatar = rawAvatar;
    if (avatar && !isNaN(parseInt(avatar)) && avatar.toString().length < 5) {
      const dp = dpOptions.find(dp => dp.id === parseInt(avatar));
      if (dp) avatar = dp.path;
    }

    // Merge everything into a clean object for ChatListItem
    const chatListItemProps = {
      ...chat,
      name: displayName,
      avatar: avatar
    };

    return (
      <ChatListItem
        key={chat.id}
        chat={chatListItemProps}
        onClick={() => handleChatClick(chat)}
        isActive={chat.id == currentChatId}
      />
    );
  };

  return (
    <main className="chat-list-panel-content">
      <header className="top-header">
        <div className="header-left">
          <h1 className="chats-title">Chats</h1>
        </div>
        <div className="header-right">
          <button
            className="icon-btn"
            onClick={() => setShowCreateGroupModal(true)}
            title="Create Group"
          >
            <Users size={20} />
          </button>
          <button
            className="icon-btn"
            onClick={() => setShowNewContactModal(true)}
            title="Contacts"
          >
            <User size={20} />
          </button>
          <button
            className="icon-btn"
            onClick={() => setShowSearch(!showSearch)}
            title="Search"
          >
            <Search size={20} />
          </button>

          <DropdownMenu items={dropdownItems} />
        </div>
      </header>

      {showSearch && (
        <div className="search-bar">
          <Search size={16} className="search-input-icon" />
          <input
            type="text"
            placeholder="Search by phone number..."
            value={searchTerm}
            onChange={handleSearchChange}
            autoFocus
          />
          <button
            className="close-search"
            onClick={() => {
              setShowSearch(false);
              setSearchTerm('');
              setSearchSuggestions([]);
              setShowSuggestions(false);
            }}
          >
            <X size={18} />
          </button>
        </div>
      )}

      {showSearch && showSuggestions && searchSuggestions.length > 0 && (
        <div className="search-suggestions">
          {searchSuggestions.map(user => (
            <div
              key={user.id}
              className="search-suggestion-item"
              onClick={() => handleSuggestionClick(user)}
            >
              <div className="suggestion-avatar">
                <img
                  src={user.avatar && parseInt(user.avatar)
                    ? dpOptions.find(dp => dp.id === parseInt(user.avatar))?.path
                    : (user.avatar || "https://ionicframework.com/docs/img/demos/avatar.svg")}
                  alt={user.name}
                />
                <span className={`online-status ${isUserOnline(Boolean(user.is_online), user.last_seen) ? 'online' : ''}`}></span>
              </div>
              <div className="suggestion-info">
                <div className="suggestion-name">{user.name}</div>
                <div className="suggestion-phone">{user.phone}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ScrollableChatList
        isDesktop={isDesktop}
        groupChats={groupChats}
        dmChats={dmChats}
        filteredChats={filteredChats}
        searchTerm={searchTerm}
        currentChatId={currentChatId}
        handleChatClick={handleChatClick}
        handleChatListScroll={handleChatListScroll}
        chatListRef={chatListRef}
        loadingMore={loadingMore}
        renderChatItem={renderChatItem}
        setShowCreateGroupModal={setShowCreateGroupModal}
        onRefresh={handleChatListRefresh}
      />

      <CreateGroupModal
        isOpen={showCreateGroupModal}
        onClose={() => setShowCreateGroupModal(false)}
        onSuccess={() => setShowCreateGroupModal(false)}
        savedContacts={savedContacts}
      />
    </main>
  );
};

export default ChatListPanel;
