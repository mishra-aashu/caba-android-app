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
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useLiveQuery } from 'dexie-react-hooks';

// Icons
import {
  Search,
  Plus,
  Bell,
  Info,
  HelpCircle,
  LogOut,
  Crown,
  User,
  Settings,
  RefreshCw,
  ArrowLeft,
  AlertCircle,
  X,
} from 'lucide-react';

// Contexts & Hooks
import { useSupabase } from '../contexts/SupabaseContext';
import { useAuth } from '../hooks/useAuth';
import { useChatListRealtime } from '../hooks/useChatListRealtime';
import { useSyncStatus } from '../hooks/useSyncStatus';
import { useChatDeletion } from '../hooks/useChatDeletion';
import useIsDesktop from '../hooks/useIsDesktop';

// Database
import { db } from '../db/db';

// Services
import messageReadsService from '../services/messageReadsService';

// Utilities
import { getChatAvatar } from '../utils/avatarHelpers';

// Components
import PullToRefresh from './common/PullToRefresh';
import DropdownMenu from './common/DropdownMenu';
import ChatListItem from './chat/ChatListItem';
import ScrollableChatList from './chat/ScrollableChatList';
import ChatSelectionHeader from './chat/ChatSelectionHeader';
import DeleteConfirmation from './chat/DeleteConfirmation';
import ChatContextMenu from './chat/ChatContextMenu';
import ErrorBoundary from './common/ErrorBoundary';
import LoadingSpinner from './common/LoadingSpinner';

// Lazy loaded components
const CreateGroupModal = lazy(() => import('./groups/CreateGroupModal'));
const AvatarModal = lazy(() => import('./chat/parts/AvatarModal'));

// Styles
import styles from '../styles/ChatListItem.module.css';

// ══════════════════════════════════════════════════════════════
// Constants
// ══════════════════════════════════════════════════════════════

const SEARCH_DEBOUNCE_MS = 500;
const FILTER_TYPES = {
  ALL: 'all',
  CHATS: 'chats',
  GROUPS: 'groups',
};

// ══════════════════════════════════════════════════════════════
// Sub-Components
// ══════════════════════════════════════════════════════════════

const RefreshBanner = memo(() => (
  <motion.div
    initial={{ height: 0, opacity: 0 }}
    animate={{ height: 'auto', opacity: 1 }}
    exit={{ height: 0, opacity: 0 }}
    className={styles['refresh-banner']}
    role="status"
    aria-live="polite"
  >
    <RefreshCw size={14} className="animate-spin" aria-hidden="true" />
    <span>Refreshing...</span>
  </motion.div>
));
RefreshBanner.displayName = 'RefreshBanner';

const SearchSuggestionItem = memo(({ user, onClick }) => (
  <button
    className={styles['search-suggestion-item']}
    onClick={onClick}
    type="button"
    aria-label={`Start chat with ${user.name}`}
  >
    <div className={styles['suggestion-avatar']}>
      <img 
        src={user.avatar || "https://ionicframework.com/docs/img/demos/avatar.svg"} 
        alt=""
        aria-hidden="true"
      />
      <span 
        className={`${styles['online-status']} ${user.isOnline ? styles.online : ''}`}
        aria-label={user.isOnline ? 'Online' : 'Offline'}
      />
    </div>
    <div className={styles['suggestion-info']}>
      <div className={styles['suggestion-name']}>{user.name}</div>
      <div className={styles['suggestion-phone']}>{user.phone}</div>
    </div>
  </button>
));
SearchSuggestionItem.displayName = 'SearchSuggestionItem';

// ══════════════════════════════════════════════════════════════
// Main Component (Refactored)
// ══════════════════════════════════════════════════════════════

const ChatListPanel = ({
  handleChatClick,
  currentChatId,
  userId,
}) => {
  const { supabase } = useSupabase();
  const navigate = useNavigate();
  const location = useLocation();
  const isDesktop = useIsDesktop();
  const { user, dbUser } = useAuth();

  // ──────────────────────────────────────────────────────────
  // Data Layer
  // ──────────────────────────────────────────────────────────

  const chats = useLiveQuery(
    () => db.chats_list.orderBy('timestamp').reverse().toArray(),
    [],
    []
  );

  const contacts = useLiveQuery(
    () => db.contacts.toArray(),
    [],
    []
  );

  const {
    loading,
    hasMoreChats,
    loadingMore,
    loadMoreChats,
    refetch: refetchChats,
  } = useChatListRealtime(user?.id);

  const { hasFailures } = useSyncStatus();

  // ──────────────────────────────────────────────────────────
  // State Management
  // ──────────────────────────────────────────────────────────

  const [searchTerm, setSearchTerm] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [sidebarView, setSidebarView] = useState('chats');
  const [activeFilter, setActiveFilter] = useState(FILTER_TYPES.ALL);
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
  const searchDebounceRef = useRef(null);
  const isMountedRef = useRef(true);

  // Chat Deletion
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
  // Effects
  // ──────────────────────────────────────────────────────────

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, []);

  // Sync sidebar view with URL
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const viewParam = searchParams.get('view');
    
    if (viewParam === 'create-group') {
      setSidebarView('create-group');
    } else {
      setSidebarView('chats');
    }
  }, [location.search]);

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return;

    const handleClick = () => setContextMenu(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [contextMenu]);

  // ──────────────────────────────────────────────────────────
  // Computed Values
  // ──────────────────────────────────────────────────────────

  // Contact lookup map
  const contactMap = useMemo(() => {
    const map = new Map();
    contacts.forEach((c) => {
      if (c.contactUserId) map.set(c.contactUserId, c);
      if (c.id) map.set(c.id, c);
    });
    return map;
  }, [contacts]);

  // Filtered chats by search term
  const searchFilteredChats = useMemo(() => {
    if (!searchTerm.trim()) return chats;

    const lowerSearch = searchTerm.toLowerCase();
    return chats.filter(chat => 
      chat.name?.toLowerCase().includes(lowerSearch) ||
      chat.metadata?.otherUserPhone?.includes(searchTerm)
    );
  }, [chats, searchTerm]);

  // 1. First enhance ALL searchFilteredChats (names + avatars)
  const allEnhancedChats = useMemo(() => {
    return searchFilteredChats.map(chat => {
      const otherUserId = chat.isGroup
        ? null
        : (chat.metadata?.otherUserId || chat.otherUserId || chat.id);

      const contact = contactMap.get(otherUserId);

      return {
        ...chat,
        name: contact?.contactName || chat.name,
        avatar: getChatAvatar(chat, contact),
        otherUserId,
      };
    });
  }, [searchFilteredChats, contactMap]);

  // 2. Then filter into dmChats, groupChats, and displayChats
  const { dmChats, groupChats, displayChats } = useMemo(() => {
    const dms = allEnhancedChats.filter(c => !c.isGroup);
    const groups = allEnhancedChats.filter(c => c.isGroup);

    let filtered = allEnhancedChats;
    if (activeFilter === FILTER_TYPES.CHATS) {
      filtered = dms;
    } else if (activeFilter === FILTER_TYPES.GROUPS) {
      filtered = groups;
    }

    // Exclude pending deletions
    const visible = filtered.filter(c => !pendingDeletions.includes(c.id));

    return { dmChats: dms, groupChats: groups, displayChats: visible };
  }, [allEnhancedChats, activeFilter, pendingDeletions]);

  // Dropdown menu items
  const dropdownItems = useMemo(() => {
    const isAdmin = dbUser?.isAdmin || user?.isAdmin;

    return [
      {
        icon: <User size={16} />,
        label: 'Profile',
        onClick: () => navigate('/profile'),
      },
      {
        icon: <Settings size={16} />,
        label: 'Settings',
        onClick: () => navigate('/settings'),
      },
      {
        icon: <Bell size={16} />,
        label: 'Reminders',
        onClick: () => navigate('/reminders'),
      },
      ...(isAdmin ? [{
        icon: <Crown size={16} />,
        label: 'Admin',
        onClick: () => navigate('/admin'),
      }] : []),
      { divider: true },
      {
        icon: <Info size={16} />,
        label: 'About',
        onClick: () => navigate('/about'),
      },
      {
        icon: <HelpCircle size={16} />,
        label: 'Help',
        onClick: () => navigate('/support'),
      },
      { divider: true },
      {
        icon: <LogOut size={16} />,
        label: 'Logout',
        onClick: async () => {
          await supabase.auth.signOut();
          navigate('/login');
        },
      },
    ];
  }, [dbUser?.isAdmin, user?.isAdmin, navigate, supabase]);

  // ──────────────────────────────────────────────────────────
  // Event Handlers
  // ──────────────────────────────────────────────────────────

  const handleManualRefresh = useCallback(async () => {
    if (isRefreshing || !refetchChats) return;

    setIsRefreshing(true);
    try {
      await refetchChats();
      toast.success('Chats refreshed');
    } catch (error) {
      console.error('[ChatListPanel] Refresh failed:', error);
      toast.error('Failed to refresh');
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, refetchChats]);

  const handleSearchChange = useCallback((e) => {
    const query = e.target.value.replace(/\D/g, ''); // Digits only
    setSearchTerm(query);

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    if (query.length !== 10) {
      setSearchSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    // Debounced search
    searchDebounceRef.current = setTimeout(async () => {
      if (!isMountedRef.current) return;

      try {
        const { data, error } = await supabase
          .from('users')
          .select('id, name, phone, avatar, is_online, last_seen')
          .eq('phone', query)
          .neq('id', user.id)
          .limit(5);

        if (error) throw error;

        if (isMountedRef.current) {
          const { safeDbConversion } = await import('../utils/dbFieldMapping');
          setSearchSuggestions(safeDbConversion(data || []));
          setShowSuggestions(data?.length > 0);
        }
      } catch (error) {
        console.error('[ChatListPanel] Search error:', error);
        if (isMountedRef.current) {
          toast.error('Search failed');
        }
      }
    }, SEARCH_DEBOUNCE_MS);
  }, [supabase, user?.id]);

  const handleSuggestionClick = useCallback(async (suggestedUser) => {
    setSearchTerm('');
    setShowSuggestions(false);
    setShowSearch(false);

    try {
      // Check if chat exists
      const { data: existingChat, error: chatError } = await supabase
        .from('chats')
        .select('id')
        .or(`and(user1_id.eq.${user.id},user2_id.eq.${suggestedUser.id}),and(user1_id.eq.${suggestedUser.id},user2_id.eq.${user.id})`)
        .maybeSingle();

      if (chatError && chatError.code !== 'PGRST116') throw chatError;

      if (existingChat) {
        navigate(`/chat/${existingChat.id}/${suggestedUser.id}`);
      } else {
        // Create new chat
        const { data: newChat, error: newChatError } = await supabase
          .from('chats')
          .insert([{ user1_id: user.id, user2_id: suggestedUser.id }])
          .select()
          .single();

        if (newChatError) throw newChatError;
        if (newChat) {
          navigate(`/chat/${newChat.id}/${suggestedUser.id}`);
        }
      }
    } catch (error) {
      console.error('[ChatListPanel] Start chat error:', error);
      toast.error('Failed to start chat');
    }
  }, [supabase, user?.id, navigate]);

  const handleExitCreateGroup = useCallback(() => {
    setSidebarView('chats');
    
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get('view') === 'create-group') {
      searchParams.delete('view');
      const newQuery = searchParams.toString();
      navigate(newQuery ? `?${newQuery}` : location.pathname, { replace: true });
    }
  }, [location, navigate]);

  const handleContextMenu = useCallback((e, chat) => {
    e.preventDefault();
    if (!isDesktop) return;
    
    setContextMenu({ 
      x: e.clientX, 
      y: e.clientY, 
      chat 
    });
  }, [isDesktop]);

  const openDeleteModal = useCallback((chat) => {
    setDeleteData({ 
      isOpen: true, 
      chat, 
      isGroup: !!chat.isGroup 
    });
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
      await Promise.all(
        selectedChats.map(chatId => 
          messageReadsService.markAllAsRead(chatId, user.id)
        )
      );
      toast.success('Marked as read');
      clearSelection();
    } catch (error) {
      console.error('[ChatListPanel] Mark read error:', error);
      toast.error('Failed to mark as read');
    }
  }, [selectedChats, user?.id, clearSelection]);

  const handleMuteSelected = useCallback(() => {
    const mutedChats = JSON.parse(localStorage.getItem('mutedChats') || '{}');
    selectedChats.forEach(chatId => {
      mutedChats[chatId] = true;
    });
    localStorage.setItem('mutedChats', JSON.stringify(mutedChats));
    toast.success('Chats muted');
    clearSelection();
  }, [selectedChats, clearSelection]);

  const handleOpenAvatarModal = useCallback((imageUrl, name) => {
    setAvatarViewerData({ isOpen: true, imageUrl, name });
  }, []);

  const handleCloseAvatarModal = useCallback(() => {
    setAvatarViewerData(prev => ({ ...prev, isOpen: false }));
  }, []);

  // Logic moved to allEnhancedChats for consistency across all views

  // ──────────────────────────────────────────────────────────
  // Render Chat Item
  // ──────────────────────────────────────────────────────────

  const renderChatItem = useCallback((chat) => {
    return (
      <ChatListItem
        key={chat.id}
        chat={chat}
        onClick={handleChatClick}
        onAvatarClick={handleOpenAvatarModal}
        isActive={String(chat.id) === String(currentChatId)}
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
  }, [
    handleChatClick,
    handleOpenAvatarModal,
    currentChatId,
    selectionMode,
    selectedChats,
    toggleChatSelection,
    handleTouchStart,
    handleTouchEnd,
    handleTouchMove,
    handleContextMenu,
    isDesktop,
  ]);

  // ══════════════════════════════════════════════════════════
  // Render
  // ══════════════════════════════════════════════════════════

  return (
    <ErrorBoundary>
      <main className={styles['chat-list-panel-content']} role="main">
        {/* Refresh Banner */}
        <AnimatePresence>
          {isDesktop && isRefreshing && <RefreshBanner />}
        </AnimatePresence>

        {/* Selection Header */}
        <AnimatePresence>
          {selectionMode && (
            <ChatSelectionHeader
              selectedCount={selectedChats.length}
              onClear={clearSelection}
              onDelete={() => openDeleteModal(selectedChats)}
              onMarkRead={handleMarkRead}
              onMute={handleMuteSelected}
            />
          )}
        </AnimatePresence>

        {/* Main Header */}
        <header 
          className={`${styles['top-header']} ${selectionMode ? styles.hidden : ''}`}
          role="banner"
        >
          <div className={styles['header-left']}>
            {sidebarView === 'create-group' ? (
              <>
                <button
                  className={styles['icon-btn']}
                  onClick={handleExitCreateGroup}
                  aria-label="Back to chats"
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
                  onClick={() => navigate('/contacts')}
                  aria-label="View contacts"
                >
                  <User size={20} />
                </button>

                {isDesktop && (
                  <button
                    className={`${styles['icon-btn']} ${isRefreshing ? 'animate-spin' : ''}`}
                    onClick={handleManualRefresh}
                    disabled={isRefreshing}
                    aria-label="Refresh chats"
                  >
                    <RefreshCw size={20} />
                  </button>
                )}

                <button
                  className={styles['icon-btn']}
                  onClick={() => setShowSearch(!showSearch)}
                  aria-label={showSearch ? 'Close search' : 'Open search'}
                  aria-expanded={showSearch}
                >
                  <Search size={20} />
                </button>

                <div style={{ position: 'relative' }}>
                  {hasFailures && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      title="Sync failures detected"
                      style={{
                        position: 'absolute',
                        left: '-10px',
                        top: '10px',
                        color: '#ff4b4b',
                        pointerEvents: 'none',
                      }}
                      aria-label="Sync failures"
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
              className={styles['search-bar']}
              role="search"
            >
              <Search size={16} className={styles['search-input-icon']} aria-hidden="true" />
              <input
                type="tel"
                placeholder="Search by phone number..."
                value={searchTerm}
                onChange={handleSearchChange}
                autoFocus
                aria-label="Search users by phone"
                maxLength={10}
              />
              <button
                className={styles['close-search']}
                onClick={() => {
                  setShowSearch(false);
                  setSearchTerm('');
                  setSearchSuggestions([]);
                  setShowSuggestions(false);
                }}
                aria-label="Close search"
              >
                <X size={18} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Filter Bar */}
        {sidebarView === 'chats' && (
          <nav className={styles['filter-bar']} role="tablist" aria-label="Chat filters">
            <button
              role="tab"
              aria-selected={activeFilter === FILTER_TYPES.ALL}
              className={`${styles['filter-pill']} ${activeFilter === FILTER_TYPES.ALL ? styles.active : ''}`}
              onClick={() => setActiveFilter(FILTER_TYPES.ALL)}
            >
              All
            </button>
            <button
              role="tab"
              aria-selected={activeFilter === FILTER_TYPES.CHATS}
              className={`${styles['filter-pill']} ${activeFilter === FILTER_TYPES.CHATS ? styles.active : ''}`}
              onClick={() => setActiveFilter(FILTER_TYPES.CHATS)}
            >
              Chats
            </button>
            <button
              role="tab"
              aria-selected={activeFilter === FILTER_TYPES.GROUPS}
              className={`${styles['filter-pill']} ${activeFilter === FILTER_TYPES.GROUPS ? styles.active : ''}`}
              onClick={() => setActiveFilter(FILTER_TYPES.GROUPS)}
            >
              Groups
            </button>
          </nav>
        )}

        {/* Search Suggestions */}
        <AnimatePresence>
          {showSearch && showSuggestions && searchSuggestions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={styles['search-suggestions']}
              role="listbox"
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
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {sidebarView === 'chats' ? (
            <PullToRefresh onRefresh={handleManualRefresh} isAtTop={isAtTop}>
              {loading && displayChats.length === 0 ? (
                <LoadingSpinner />
              ) : (
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
                  loadMoreChats={loadMoreChats}
                  renderChatItem={renderChatItem}
                  setShowCreateGroupModal={() => setSidebarView('create-group')}
                  onAtTopChange={setIsAtTop}
                  onAvatarClick={handleOpenAvatarModal}
                />
              )}
            </PullToRefresh>
          ) : (
            <Suspense fallback={<LoadingSpinner />}>
              <CreateGroupModal
                isOpen={sidebarView === 'create-group'}
                onClose={handleExitCreateGroup}
                onSuccess={handleExitCreateGroup}
                savedContacts={contacts}
                inline
              />
            </Suspense>
          )}
        </div>

        {/* Context Menu */}
        {contextMenu && (
          <ChatContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={() => setContextMenu(null)}
            onDelete={() => {
              openDeleteModal(contextMenu.chat);
              setContextMenu(null);
            }}
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
              onClose={handleCloseAvatarModal}
            />
          )}
        </Suspense>
      </main>
    </ErrorBoundary>
  );
};

export default memo(ChatListPanel);