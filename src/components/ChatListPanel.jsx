import React, { 
  useRef, 
  useState, 
  useEffect, 
  useMemo, 
  useCallback,
  lazy, 
  Suspense,
  memo 
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  RefreshCw,
  ArrowLeft,
  AlertCircle
} from 'lucide-react';
import { useSupabase } from '../contexts/SupabaseContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useChatListRealtime } from '../hooks/useChatListRealtime';
import { useSyncStatus } from '../hooks/useSyncStatus';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { useQueryClient } from '@tanstack/react-query';
import useIsDesktop from '../hooks/useIsDesktop';
import PullToRefresh from './common/PullToRefresh';
import DropdownMenu from './common/DropdownMenu';
import ChatListItem from './chat/ChatListItem';
import { getChatAvatar } from '../utils/avatarHelpers';
import { isUserOnline } from '../utils/dateFormatter';
import { useGroupActions } from '../hooks/useGroupActions';
import ScrollableChatList from './chat/ScrollableChatList';
import { useChatDeletion } from '../hooks/useChatDeletion';
import ChatSelectionHeader from './chat/ChatSelectionHeader';
import DeleteConfirmation from './chat/DeleteConfirmation';
import ChatContextMenu from './chat/ChatContextMenu';
import { toast } from 'react-hot-toast';
import messageReadsService from '../services/messageReadsService';
import { dpOptions, getDpPath } from '../utils/dpOptions';

const CreateGroupModal = lazy(() => import('./groups/CreateGroupModal'));
const AvatarModal = lazy(() => import('./chat/parts/AvatarModal'));

import styles from '../styles/ChatListItem.module.css';

// ══════════════════════════════════════════════════════════════
// Memoized Sub-Components
// ══════════════════════════════════════════════════════════════

const RefreshBanner = memo(() => (
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
));
RefreshBanner.displayName = 'RefreshBanner';

const SearchSuggestionItem = memo(({ user, onClick }) => {
  const avatarSrc = useMemo(() => {
    if (user.avatar && parseInt(user.avatar)) {
      return dpOptions.find(dp => dp.id === parseInt(user.avatar))?.path;
    }
    return user.avatar || "https://ionicframework.com/docs/img/demos/avatar.svg";
  }, [user.avatar]);

  return (
    <div
      className={styles['search-suggestion-item']}
      onClick={onClick}
    >
      <div className={styles['suggestion-avatar']}>
        <img src={avatarSrc} alt={user.name} />
        <span 
          className={`${styles['online-status']} ${
            isUserOnline(Boolean(user.isOnline), user.lastSeen) ? styles.online : ''
          }`}
        />
      </div>
      <div className={styles['suggestion-info']}>
        <div className={styles['suggestion-name']}>{user.name}</div>
        <div className={styles['suggestion-phone']}>{user.phone}</div>
      </div>
    </div>
  );
});
SearchSuggestionItem.displayName = 'SearchSuggestionItem';

// ══════════════════════════════════════════════════════════════
// Main Component
// ══════════════════════════════════════════════════════════════

const ChatListPanel = ({
  handleChatClick,
  isDesktop: isDesktopProp,
  currentChatId,
  user: userProp,
}) => {
  const { supabase } = useSupabase();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isDesktop = useIsDesktop();
  const { user, dbUser } = useAuth();
  const location = useLocation();

  // ──────────────────────────────────────────────────────────
  // Data Fetching (OPTIMIZED)
  // ──────────────────────────────────────────────────────────

  // Use stable query key to prevent unnecessary re-fetches
  const chatsQueryKey = useMemo(() => ['chats_list', user?.id], [user?.id]);
  
  const rawChats = useLiveQuery(
    () => db.chats_list.orderBy('timestamp').reverse().toArray(),
    [],
    [] // Default value
  );

  const rawContacts = useLiveQuery(
    () => db.contacts.toArray(),
    [],
    []
  );

  // Stable array references using deep comparison
  const chats = useMemo(() => rawChats || [], [rawChats?.length]);
  const savedContacts = useMemo(() => rawContacts || [], [rawContacts?.length]);

  const {
    loading,
    hasMoreChats,
    loadingMore,
    loadMoreChats,
    refetch: refetchChats,
  } = useChatListRealtime(user?.id);

  // ──────────────────────────────────────────────────────────
  // UI State
  // ──────────────────────────────────────────────────────────

  const [searchTerm, setSearchTerm] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [sidebarView, setSidebarView] = useState('chats');
  const [activeFilter, setActiveFilter] = useState('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAtTop, setIsAtTop] = useState(true);
  const [avatarViewerData, setAvatarViewerData] = useState({
    isOpen: false,
    imageUrl: '',
    name: '',
  });
  const [contextMenu, setContextMenu] = useState(null);
  const [deleteData, setDeleteData] = useState({ 
    isOpen: false, 
    chat: null, 
    isGroup: false 
  });

  // Refs
  const chatListRef = useRef();
  const debounceTimeout = useRef(null);
  const mountedRef = useRef(true);

  // Chat Deletion Hook
  const {
    selectionMode,
    selectedChats,
    pendingDeletions,
    toggleChatSelection,
    clearSelection,
    initiateDelete,
    handleTouchStart,
    handleTouchEnd,
    handleTouchMove,
  } = useChatDeletion(user?.id);

  // ──────────────────────────────────────────────────────────
  // Cleanup on Unmount
  // ──────────────────────────────────────────────────────────

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
    };
  }, []);

  // ──────────────────────────────────────────────────────────
  // Sync sidebar view with URL
  // ──────────────────────────────────────────────────────────

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get('view') === 'create-group') {
      setSidebarView('create-group');
    } else {
      setSidebarView('chats');
    }
  }, [location.search]);

  // ──────────────────────────────────────────────────────────
  // Contact Lookup Map (STABLE)
  // ──────────────────────────────────────────────────────────

  const contactMap = useMemo(() => {
    const map = new Map();
    savedContacts.forEach((c) => {
      if (c.contactUserId) map.set(c.contactUserId, c);
      if (c.id) map.set(c.id, c);
    });
    return map;
  }, [savedContacts.length]); // ✅ Only recreate when contact count changes

  // ──────────────────────────────────────────────────────────
  // Filtered Chats (OPTIMIZED)
  // ──────────────────────────────────────────────────────────

  const filteredChats = useMemo(() => {
    if (!searchTerm.trim()) return chats;

    const lowerSearch = searchTerm.toLowerCase();
    return chats.filter(
      (chat) =>
        chat.name?.toLowerCase().includes(lowerSearch) ||
        chat.metadata?.otherUserPhone?.includes(searchTerm)
    );
  }, [chats.length, searchTerm]); // ✅ Only re-filter when chat count or search changes

  // ──────────────────────────────────────────────────────────
  // Display Chats with Filter (STABLE)
  // ──────────────────────────────────────────────────────────

  const { dmChats, groupChats, displayChats } = useMemo(() => {
    const dms = filteredChats.filter((chat) => !chat.isGroup);
    const groups = filteredChats.filter((chat) => chat.isGroup);

    let filtered = filteredChats;
    if (activeFilter === 'chats') {
      filtered = dms;
    } else if (activeFilter === 'groups') {
      filtered = groups;
    }

    return {
      dmChats: dms,
      groupChats: groups,
      displayChats: filtered.filter((chat) => !pendingDeletions.includes(chat.id)),
    };
  }, [filteredChats.length, activeFilter, pendingDeletions.length]);

  // ──────────────────────────────────────────────────────────
  // Handlers (STABLE with useCallback)
  // ──────────────────────────────────────────────────────────

  const handleExitCreateGroup = useCallback(() => {
    setSidebarView('chats');
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get('view') === 'create-group') {
      searchParams.delete('view');
      const newQuery = searchParams.toString();
      navigate(newQuery ? `?${newQuery}` : location.pathname);
    }
  }, [location.search, location.pathname, navigate]);

  const handleManualRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      if (refetchChats) {
        await refetchChats();
      }
      queryClient.invalidateQueries({ queryKey: ['contacts', user.id] });
    } catch (error) {
      console.error('[ChatListPanel] Refresh failed:', error);
      toast.error('Failed to refresh chats');
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, refetchChats, queryClient, user.id]);

  const handleSearchChange = useCallback(
    (e) => {
      const query = e.target.value.replace(/\D/g, '');
      setSearchTerm(query);

      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }

      if (query.length !== 10) {
        setSearchSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      debounceTimeout.current = setTimeout(async () => {
        if (!mountedRef.current) return;

        try {
          const { data, error } = await supabase
            .from('users')
            .select('id, name, phone, avatar, is_online, last_seen')
            .eq('phone', query)
            .neq('id', user.id)
            .limit(1);

          if (error) throw error;

          if (mountedRef.current) {
            const { safeDbConversion } = await import('../utils/dbFieldMapping');
            setSearchSuggestions(safeDbConversion(data || []));
            setShowSuggestions(true);
          }
        } catch (error) {
          console.error('[ChatListPanel] Search error:', error);
          if (mountedRef.current) {
            toast.error('Failed to search for users.');
          }
        }
      }, 500);
    },
    [supabase, user.id]
  );

  const handleSuggestionClick = useCallback(
    async (suggestedUser) => {
      setSearchTerm('');
      setShowSuggestions(false);
      setShowSearch(false);

      try {
        const { data: chat, error: chatError } = await supabase
          .from('chats')
          .select('id')
          .or(
            `and(user1_id.eq.${user.id},user2_id.eq.${suggestedUser.id}),and(user1_id.eq.${suggestedUser.id},user2_id.eq.${user.id})`
          )
          .single();

        if (chatError && chatError.code !== 'PGRST116') throw chatError;

        if (chat) {
          navigate(`/chat/${chat.id}/${suggestedUser.id}`);
        } else {
          const { data: newChatData, error: newChatError } = await supabase
            .from('chats')
            .insert([{ user1_id: user.id, user2_id: suggestedUser.id }])
            .select()
            .single();

          if (newChatError) throw newChatError;
          if (newChatData) navigate(`/chat/${newChatData.id}/${suggestedUser.id}`);
        }
      } catch (error) {
        console.error('[ChatListPanel] Start chat error:', error);
        toast.error('Could not start chat.');
      }
    },
    [supabase, user.id, navigate]
  );

  const handleNavigation = useCallback((path) => navigate(path), [navigate]);
  
  const setShowNewContactModal = useCallback(
    (val) => (val ? navigate('/contacts') : navigate('/')),
    [navigate]
  );

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    navigate('/login');
  }, [supabase, navigate]);

  const handleAboutApp = useCallback(() => navigate('/about'), [navigate]);
  const handleHelp = useCallback(() => navigate('/support'), [navigate]);

  const handleContextMenu = useCallback(
    (e, chat) => {
      e.preventDefault();
      if (!isDesktop) return;
      setContextMenu({ x: e.clientX, y: e.clientY, chat });
    },
    [isDesktop]
  );

  const openDeleteModal = useCallback((chat) => {
    setDeleteData({ isOpen: true, chat, isGroup: !!chat.isGroup });
  }, []);

  const confirmDelete = useCallback(() => {
    if (selectionMode) {
      initiateDelete(selectedChats);
    } else if (deleteData.chat) {
      initiateDelete(deleteData.chat);
    }
    setDeleteData({ isOpen: false, chat: null, isGroup: false });
    clearSelection();
  }, [selectionMode, selectedChats, deleteData.chat, initiateDelete, clearSelection]);

  const handleMarkRead = useCallback(async () => {
    try {
      const promises = selectedChats.map((chatId) =>
        messageReadsService.markAllAsRead(chatId, user.id)
      );
      await Promise.all(promises);
      toast.success('Chats marked as read');
      clearSelection();
    } catch (error) {
      console.error('[ChatListPanel] Mark read error:', error);
      toast.error('Failed to mark chats as read');
    }
  }, [selectedChats, user.id, clearSelection]);

  const handleMuteSelected = useCallback(() => {
    const mutedChats = JSON.parse(localStorage.getItem('mutedChats') || '{}');
    selectedChats.forEach((chatId) => {
      mutedChats[chatId] = true;
    });
    localStorage.setItem('mutedChats', JSON.stringify(mutedChats));
    toast.success('Chats muted');
    clearSelection();
  }, [selectedChats, clearSelection]);

  const handleChatListScroll = useCallback(() => {
    if (chatListRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = chatListRef.current;
      if (scrollTop + clientHeight >= scrollHeight - 500 && hasMoreChats && !loadingMore) {
        loadMoreChats();
      }
    }
  }, [hasMoreChats, loadingMore, loadMoreChats]);

  // ──────────────────────────────────────────────────────────
  // Enhanced Chat Item Renderer (STABLE)
  // ──────────────────────────────────────────────────────────

  const renderChatItem = useCallback(
    (chat) => {
      const otherUserId =
        chat.metadata?.otherUserId ||
        chat.otherUserId ||
        chat.otherUser?.id ||
        chat.id;

      const contact = contactMap.get(otherUserId);
      const displayName = contact?.contactName || chat.name;
      const avatar = getChatAvatar(chat);

      const enhancedChat = {
        id: chat.id,
        name: displayName,
        avatar: avatar,
        otherUserId: otherUserId,
        lastMessage: chat.lastMessage,
        lastMessageAt: chat.lastMessageAt,
        unreadCount: chat.unreadCount,
        isGroup: chat.isGroup,
        isOnline: chat.isOnline,
        lastSeen: chat.lastSeen,
        timestamp: chat.timestamp,
        metadata: chat.metadata,
      };

      return (
        <ChatListItem
          key={chat.id}
          chat={enhancedChat}
          onClick={() => handleChatClick(enhancedChat)} // ✅ Uses enhanced chat
          onAvatarClick={(imageUrl, name) => {
            setAvatarViewerData({
              isOpen: true,
              imageUrl,
              name,
            });
          }}
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
    },
    [
      contactMap,
      handleChatClick,
      currentChatId,
      selectionMode,
      selectedChats,
      toggleChatSelection,
      handleTouchStart,
      handleTouchEnd,
      handleTouchMove,
      handleContextMenu,
      isDesktop,
    ]
  );

  // ──────────────────────────────────────────────────────────
  // Dropdown Menu Items
  // ──────────────────────────────────────────────────────────

  const isAdmin = dbUser?.isAdmin || user?.isAdmin;

  const dropdownItems = useMemo(
    () => [
      {
        icon: <User size={16} />,
        label: 'Profile',
        onClick: () => handleNavigation('/profile'),
      },
      {
        icon: <Settings size={16} />,
        label: 'Settings',
        onClick: () => handleNavigation('/settings'),
      },
      {
        icon: <Bell size={16} />,
        label: 'Check Reminders',
        onClick: () => handleNavigation('/reminders'),
      },
      ...(isAdmin
        ? [
            {
              icon: <Crown size={16} />,
              label: 'Admin',
              onClick: () => handleNavigation('/admin'),
            },
          ]
        : []),
      { divider: true },
      {
        icon: <Info size={16} />,
        label: 'About App',
        onClick: handleAboutApp,
      },
      {
        icon: <HelpCircle size={16} />,
        label: 'Help',
        onClick: handleHelp,
      },
      { divider: true },
      {
        icon: <LogOut size={16} />,
        label: 'Logout',
        onClick: handleLogout,
      },
    ],
    [isAdmin, handleNavigation, handleAboutApp, handleHelp, handleLogout]
  );

  // ──────────────────────────────────────────────────────────
  // Sync Status
  // ──────────────────────────────────────────────────────────

  const { hasFailures } = useSyncStatus();

  // ══════════════════════════════════════════════════════════
  // Render
  // ══════════════════════════════════════════════════════════

  return (
    <main className={styles['chat-list-panel-content']}>
      {/* Desktop Refreshing Banner */}
      <AnimatePresence>
        {isDesktop && isRefreshing && <RefreshBanner />}
      </AnimatePresence>

      {/* Selection Header */}
      {selectionMode && (
        <ChatSelectionHeader
          selectedCount={selectedChats.length}
          onClear={clearSelection}
          onDelete={() => openDeleteModal(selectedChats)}
          onMarkRead={handleMarkRead}
          onMute={handleMuteSelected}
        />
      )}

      {/* Top Header */}
      <header className={`${styles['top-header']} ${selectionMode ? styles.hidden : ''}`}>
        <div className={styles['header-left']}>
          {sidebarView === 'create-group' ? (
            <>
              <button
                className={styles['icon-btn']}
                onClick={handleExitCreateGroup}
                style={{ marginRight: '12px' }}
              >
                <ArrowLeft size={20} />
              </button>
              <h1 className={styles['chats-title']}>New Group</h1>
            </>
          ) : (
            <h1 className={styles['chats-title']}>Chats</h1>
          )}
        </div>
        <div className={styles['header-right']}>
          {sidebarView === 'chats' && (
            <>
              <button
                className={styles['icon-btn']}
                onClick={() => setShowNewContactModal(true)}
                title="Your Circle"
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

              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                {hasFailures && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    title="Sync Failures Detected"
                    style={{
                      position: 'absolute',
                      left: '-10px',
                      top: '10px',
                      zIndex: 101,
                      color: '#ff4b4b',
                      pointerEvents: 'none',
                    }}
                  >
                    <AlertCircle size={14} />
                  </motion.div>
                )}
                <DropdownMenu items={dropdownItems} />
              </div>
            </>
          )}
        </div>
      </header>

      {/* Search Bar */}
      <AnimatePresence>
        {showSearch && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              height: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
              opacity: { duration: 0.2, ease: 'linear' },
            }}
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

      {/* Filter Bar */}
      {sidebarView === 'chats' && (
        <motion.div className={styles['filter-bar']}>
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
      )}

      {/* Search Suggestions */}
      <AnimatePresence>
        {showSearch && showSuggestions && searchSuggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className={styles['search-suggestions']}
          >
            {searchSuggestions.map((user) => (
              <SearchSuggestionItem
                key={user.id}
                user={user}
                onClick={() => handleSuggestionClick(user)}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <motion.div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {sidebarView === 'chats' ? (
          <PullToRefresh onRefresh={handleManualRefresh} isAtTop={isAtTop}>
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
              setShowCreateGroupModal={() => setSidebarView('create-group')}
              onAtTopChange={setIsAtTop}
              onAvatarClick={(imageUrl, name) => {
                setAvatarViewerData({
                  isOpen: true,
                  imageUrl,
                  name,
                });
              }}
            />
          </PullToRefresh>
        ) : (
          <Suspense fallback={null}>
            <CreateGroupModal
              isOpen={sidebarView === 'create-group'}
              onClose={handleExitCreateGroup}
              onSuccess={handleExitCreateGroup}
              savedContacts={savedContacts}
              inline={true}
            />
          </Suspense>
        )}
      </motion.div>

      {/* Context Menu */}
      {contextMenu && (
        <ChatContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onDelete={() => openDeleteModal(contextMenu.chat)}
          chat={contextMenu.chat}
        />
      )}

      {/* Delete Confirmation */}
      <Suspense fallback={null}>
        <DeleteConfirmation
          isOpen={deleteData.isOpen}
          onClose={() => setDeleteData({ isOpen: false, chat: null, isGroup: false })}
          onConfirm={confirmDelete}
          title={selectionMode ? 'Delete Chats?' : 'Delete Chat?'}
          selectedCount={selectionMode ? selectedChats.length : 1}
          isMobile={!isDesktop}
        />
      </Suspense>

      {/* Avatar Modal */}
      <Suspense fallback={null}>
        {avatarViewerData.isOpen && (
          <AvatarModal
            isOpen={avatarViewerData.isOpen}
            imageUrl={avatarViewerData.imageUrl}
            name={avatarViewerData.name}
            onClose={() => setAvatarViewerData({ ...avatarViewerData, isOpen: false })}
          />
        )}
      </Suspense>
    </main>
  );
};

export default memo(ChatListPanel);