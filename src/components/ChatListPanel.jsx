import React, { useRef, useState, useMemo, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  X,
  RefreshCw
} from 'lucide-react';
import PullToRefresh from './common/PullToRefresh';
import DropdownMenu from './common/DropdownMenu';
import ChatListItem from './chat/ChatListItem';
import { getPublicMediaUrl } from '../services/mediaService';
import { getDpPath } from '../utils/dpOptions';
const ImageViewer = lazy(() => import('./chat/ImageViewer'));
import { getInitials } from '../utils/stringUtils';
import { isUserOnline } from '../utils/dateFormatter';
// lazy loaded below
import { useGroupActions } from '../hooks/useGroupActions';
import ScrollableChatList from './chat/ScrollableChatList';
import { useChatDeletion } from '../hooks/useChatDeletion';
import ChatSelectionHeader from './chat/ChatSelectionHeader';
import DeleteConfirmation from './chat/DeleteConfirmation';
import ChatContextMenu from './chat/ChatContextMenu';
import { Toaster, toast } from 'react-hot-toast';
import messageReadsService from '../services/messageReadsService';
const CreateGroupModal = lazy(() => import('./groups/CreateGroupModal'));

import styles from '../styles/ChatListItem.module.css';

const ChatListPanel = ({
  searchTerm,
  setSearchTerm,
  showSearch,
  setShowSearch,
  searchSuggestions,
  setSearchSuggestions,
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
  refetchChats, // Passed from MainLayout
}) => {
  const { supabase } = useSupabase();
  const { useUserGroups } = useGroupActions();

  // State for Create Group Modal
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all'); // 'all', 'chats', 'groups'

  // Chat Deletion Hook
  const { user } = useSupabase();
  const {
    selectionMode,
    selectedChats,
    pendingDeletions,
    toggleChatSelection,
    clearSelection,
    initiateDelete,
    handleTouchStart,
    handleTouchEnd,
    handleTouchMove
  } = useChatDeletion(user?.id);

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleManualRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      if (refetchChats) {
        await refetchChats();
      }
    } catch (error) {
      console.error('Refresh failed:', error);
      toast.error('Failed to refresh chats');
    } finally {
      setIsRefreshing(false);
    }
  };

  const [contextMenu, setContextMenu] = useState(null);
  const [deleteData, setDeleteData] = useState({ isOpen: false, chat: null, isGroup: false });

  const handleContextMenu = (e, chat) => {
    e.preventDefault();
    if (!isDesktop) return; // Only for desktop
    setContextMenu({ x: e.clientX, y: e.clientY, chat });
  };

  const openDeleteModal = (chat) => {
    setDeleteData({ isOpen: true, chat, isGroup: !!chat.isGroup });
  };

  const confirmDelete = () => {
    if (selectionMode) {
      initiateDelete(selectedChats);
    } else if (deleteData.chat) {
      initiateDelete(deleteData.chat);
    }
    setDeleteData({ isOpen: false, chat: null, isGroup: false });
    clearSelection();
  };
  // Create a fast lookup map for contacts
  const contactMap = useMemo(() => {
    const map = new Map();
    savedContacts.forEach(c => {
      if (c.contactUserId) map.set(c.contactUserId, c);
      if (c.id) map.set(c.id, c);
    });
    return map;
  }, [savedContacts]);

  // Separate DMs and Groups for specific layouts
  const { dmChats, groupChats, displayChats } = useMemo(() => {
    const dms = filteredChats.filter(chat => !chat.isGroup);
    const groups = filteredChats.filter(chat => chat.isGroup);

    let filtered = filteredChats;
    if (activeFilter === 'chats') {
      filtered = dms;
    } else if (activeFilter === 'groups') {
      filtered = groups;
    }

    return { 
      dmChats: dms, 
      groupChats: groups, 
      displayChats: filtered.filter(chat => !pendingDeletions.includes(chat.id)) 
    };
  }, [filteredChats, activeFilter, pendingDeletions]);

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
      icon: <Bell size={16} />,
      label: 'Check Reminders',
      onClick: () => handleNavigation('/reminders')
    },
    ...(isAdmin ? [{
      icon: <Crown size={16} />,
      label: 'Admin',
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

  // Helper to resolve avatar (numeric ID or URL)
  const resolveAvatar = (avatarValue, userId) => {
    let result = avatarValue;
    
    // 1. If no avatar, try contact lookup
    if (!result && userId) {
      const contact = contactMap.get(userId);
      result = contact?.otherUser?.avatar;
    }

    // 2. Resolve numeric ID if needed
    if (result && !isNaN(parseInt(result)) && result.toString().length < 5) {
      return getDpPath(result) || result;
    }

    return result;
  };

  // Helper for rendering chat list items
  const renderChatItem = (chat) => {
    // 1. Resolve contact using map
    const otherUserId = chat.metadata?.otherUserId || chat.otherUserId || chat.otherUser?.id || chat.id;
    
    // 2. Resolve display name with fallbacks
    const contact = contactMap.get(otherUserId);
    const displayName = contact?.contactName || chat.name;

    // 3. Robust Avatar resolution
    const avatar = resolveAvatar(chat.avatar || chat.otherUser?.avatar, otherUserId);

    // Merge everything into a clean object for ChatListItem
    const chatListItemProps = {
      ...chat,
      name: displayName,
      avatar: avatar,
      otherUserId: otherUserId // Ensure this is passed for the hook
    };

    return (
      <ChatListItem
        key={chat.id}
        chat={chatListItemProps}
        onClick={() => handleChatClick(chat)}
        isActive={chat.id == currentChatId}
        selectionMode={selectionMode}
        isSelected={selectedChats.includes(chat.id)}
        onSelect={toggleChatSelection}
        onLongPressStart={handleTouchStart}
        onLongPressEnd={handleTouchEnd}
        onLongPressMove={handleTouchMove}
        onContextMenu={handleContextMenu}
        isMobile={!isDesktop}
      />
    );
  };

  const handleMarkRead = async () => {
    try {
      const promises = selectedChats.map(chatId => messageReadsService.markAllAsRead(chatId, user.id));
      await Promise.all(promises);
      toast.success('Chats marked as read');
      clearSelection();
    } catch (error) {
      console.error('Error marking chats as read:', error);
      toast.error('Failed to mark chats as read');
    }
  };

  const handleMuteSelected = () => {
    const mutedChats = JSON.parse(localStorage.getItem('mutedChats') || '{}');
    selectedChats.forEach(chatId => {
      mutedChats[chatId] = true;
    });
    localStorage.setItem('mutedChats', JSON.stringify(mutedChats));
    toast.success('Chats muted');
    clearSelection();
  };

  return (
    <main className={styles['chat-list-panel-content']}>
      
      {/* Desktop Refreshing Banner */}
      <AnimatePresence>
        {isDesktop && isRefreshing && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className={styles['refresh-banner']}
            style={{
              backgroundColor: 'var(--brand-light)',
              color: 'var(--brand-primary)',
              textAlign: 'center',
              padding: '6px 0',
              fontSize: '0.85rem',
              fontWeight: '500',
              borderBottom: '1px solid var(--brand-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <RefreshCw size={14} className="animate-spin" />
            Refreshing...
          </motion.div>
        )}
      </AnimatePresence>
      {selectionMode && (
        <ChatSelectionHeader 
          selectedCount={selectedChats.length}
          onClear={clearSelection}
          onDelete={() => openDeleteModal(selectedChats)}
          onMarkRead={handleMarkRead}
          onMute={handleMuteSelected}
        />
      )}
      <header className={`${styles['top-header']} ${selectionMode ? styles.hidden : ''}`}>
        <div className={styles['header-left']}>
          <h1 className={styles['chats-title']}>Chats</h1>
        </div>
        <div className={styles['header-right']}>
          <button
            className={styles['icon-btn']}
            onClick={() => setShowNewContactModal(true)}
            title="Contacts"
          >
            <User size={20} />
          </button>
          {isDesktop && (
            <button
              className={`${styles['icon-btn']} ${isRefreshing ? 'animate-spin' : ''}`}
              onClick={handleManualRefresh}
              title="Refresh"
              disabled={isRefreshing}
            >
              <RefreshCw size={20} />
            </button>
          )}
          <button
            className={styles['icon-btn']}
            onClick={() => setShowSearch(!showSearch)}
            title="Search"
          >
            <Search size={20} />
          </button>

          <DropdownMenu items={dropdownItems} />
        </div>
      </header>

      <AnimatePresence>
        {showSearch && (
          <motion.div
            layout
            initial={{ height: 0, opacity: 0, y: -20 }}
            animate={{ height: 'auto', opacity: 1, y: 0 }}
            exit={{ height: 0, opacity: 0, y: -20 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className={styles['search-bar']}
            style={{ overflow: 'hidden' }}
          >
            <Search size={16} className={styles['search-input-icon']} />
            <input
              type="text"
              placeholder="Search by phone number..."
              value={searchTerm}
              onChange={handleSearchChange}
              autoFocus
            />
            <button
              className={styles['close-search']}
              onClick={() => {
                setShowSearch(false);
                setSearchTerm('');
                setSearchSuggestions([]);
                setShowSuggestions(false);
              }}
            >
              <X size={18} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div layout className={styles['filter-bar']}>
        <button
          className={`${styles['filter-pill']} ${activeFilter === 'all' ? styles.active : ''}`}
          onClick={() => setActiveFilter('all')}
        >
          All
        </button>
        <button
          className={`${styles['filter-pill']} ${activeFilter === 'chats' ? styles.active : ''}`}
          onClick={() => setActiveFilter('chats')}
        >
          Chats
        </button>
        <button
          className={`${styles['filter-pill']} ${activeFilter === 'groups' ? styles.active : ''}`}
          onClick={() => setActiveFilter('groups')}
        >
          Groups
        </button>
      </motion.div>

      <AnimatePresence>
        {showSearch && showSuggestions && searchSuggestions.length > 0 && (
          <motion.div
            layout
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className={styles['search-suggestions']}
          >
            {searchSuggestions.map(user => (
              <div
                key={user.id}
                className={styles['search-suggestion-item']}
                onClick={() => handleSuggestionClick(user)}
              >
                <div className={styles['suggestion-avatar']}>
                  <img
                    src={user.avatar && parseInt(user.avatar)
                      ? dpOptions.find(dp => dp.id === parseInt(user.avatar))?.path
                      : (user.avatar || "https://ionicframework.com/docs/img/demos/avatar.svg")}
                    alt={user.name}
                  />
                  <span className={`${styles['online-status']} ${isUserOnline(Boolean(user.is_online), user.last_seen) ? styles.online : ''}`}></span>
                </div>
                <div className={styles['suggestion-info']}>
                  <div className={styles['suggestion-name']}>{user.name}</div>
                  <div className={styles['suggestion-phone']}>{user.phone}</div>
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <PullToRefresh onRefresh={handleManualRefresh}>
          <ScrollableChatList
            isDesktop={isDesktop}
            groupChats={groupChats}
            dmChats={dmChats}
            filteredChats={displayChats}
            activeFilter={activeFilter}
            searchTerm={searchTerm}
            currentChatId={currentChatId}
            handleChatClick={handleChatClick}
            loadingMore={loadingMore}
            hasMoreChats={hasMoreChats}
            loadMoreChats={() => {
              if (hasMoreChats && !loadingMore) handleChatListScroll();
            }}
            renderChatItem={renderChatItem}
            setShowCreateGroupModal={setShowCreateGroupModal}
          />
        </PullToRefresh>
      </motion.div>

      <Suspense fallback={null}>
        <CreateGroupModal
          isOpen={showCreateGroupModal}
          onClose={() => setShowCreateGroupModal(false)}
          onSuccess={() => setShowCreateGroupModal(false)}
          savedContacts={savedContacts}
        />
      </Suspense>

      {contextMenu && (
        <ChatContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onDelete={() => openDeleteModal(contextMenu.chat)}
          chat={contextMenu.chat}
        />
      )}

      <Suspense fallback={null}>
        <DeleteConfirmation
          isOpen={deleteData.isOpen}
          onClose={() => setDeleteData({ isOpen: false, chat: null, isGroup: false })}
          onConfirm={confirmDelete}
          title={selectionMode ? "Delete Chats?" : "Delete Chat?"}
          selectedCount={selectionMode ? selectedChats.length : 1}
          isMobile={!isDesktop}
        />
      </Suspense>
    </main>
  );
};

export default ChatListPanel;
