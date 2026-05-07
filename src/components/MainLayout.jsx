import React, { 
  useState, 
  useCallback, 
  useMemo, 
  useEffect,
  useRef,
  Suspense, 
  lazy, 
  memo 
} from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

// Hooks & Contexts
import { useAuth } from '../hooks/useAuth';
import useIsDesktop from '../hooks/useIsDesktop';
import { UserDetailsContext } from '../contexts/UserDetailsContext';

// Services
import { syncService } from '../services/syncService';
import { processSyncQueue } from '../services/offlineQueue';
import { realtimeOrchestrator } from '../services/RealtimeOrchestrator';
import { syncHeartbeat } from '../services/SyncHeartbeat';

// Store
import useChatStore, { selectActiveChatId, selectActiveChat } from '../store/useChatStore';

// Components
import BottomNavigation from './common/BottomNavigation';
import ChatPlaceholder from './common/ChatPlaceholder';
import ParticleOverlay from './chat/ParticleOverlay';
import PageTransition from './common/PageTransition';
import ChatScreen from './chat/ChatScreen';
import VersionUpdateModal from './common/VersionUpdateModal';
import ErrorBoundary from './common/ErrorBoundary';

// Lazy Loads
const UserDetails = lazy(() => import('./UserDetails'));
const GroupInfoDrawer = lazy(() => import('./groups/GroupInfoDrawer'));
const Sidebar = lazy(() => import('./layout/Sidebar'));
const ChatListPanel = lazy(() => import('./ChatListPanel'));
const DesktopLayout = lazy(() => import('./DesktopLayout'));
const ThemeSelector = lazy(() => import('./chat/ThemeSelector'));
const SharedMedia = lazy(() => import('./chat/SharedMedia'));
import GlobalPlayer from './media/GlobalPlayer';
import FullscreenPlayer from './media/FullscreenPlayer';
import useMusicSync from '../hooks/media/useMusicSync';
import useMusicStore from '../store/useMusicStore';


// ══════════════════════════════════════════════════════════════
// Constants
// ══════════════════════════════════════════════════════════════

const SYNC_THROTTLE_MS = 120_000; // 2 minutes (Increased from 1m)
const SYNC_DEBOUNCE_MS = 2_000;   // 2 seconds (Increased from 1s)

const OVERLAY_ROUTES = new Set([
  '/contacts',
  '/profile',
  '/settings',
  '/settings/security',
  '/settings/devices',
  '/settings/help',
  '/terms',
  '/privacy',
  '/blocked',
  '/support',
  '/emoji-settings',
  '/history',
  '/games',
  '/reminders',
  '/create-reminder',
]);



const ACTIVE_CHAT_PATHS = new Set([
  '/user-details/',
  '/terms',
  '/privacy',
  '/blocked',
  '/support',
  '/emoji-settings',
  '/theme',
  '/shared-media/',
]);

// ══════════════════════════════════════════════════════════════
// Memoized Components
// ══════════════════════════════════════════════════════════════

const LoadingFallback = memo(() => (
  <div className="loading" role="status" aria-label="Loading">
    <div className="loading-spinner" aria-hidden="true" />
  </div>
));
LoadingFallback.displayName = 'LoadingFallback';

// ══════════════════════════════════════════════════════════════
// Custom Hooks
// ══════════════════════════════════════════════════════════════

/**
 * Manages global sync orchestration with throttling and debouncing
 */
const useSyncOrchestration = (userId) => {
  const lastSyncTimeRef = useRef(0);
  const syncTimeoutRef = useRef(null);
  const isMountedRef = useRef(true);

  const executeSync = useCallback((reason = 'unknown', force = false) => {
    if (!userId || !isMountedRef.current) return;

    const now = Date.now();
    
    // Throttle check
    if (!force && (now - lastSyncTimeRef.current) < SYNC_THROTTLE_MS) {
      console.log(`[Sync] Throttled sync request (${reason})`);
      return;
    }

    // Clear pending debounce
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    // Debounce execution
    syncTimeoutRef.current = setTimeout(() => {
      if (!isMountedRef.current || !userId) return;

      console.log(`[Sync] Executing sync (${reason})`);
      
      try {
        syncService.performGlobalSync(userId);
        processSyncQueue();
        lastSyncTimeRef.current = Date.now();
      } catch (error) {
        console.error('[Sync] Failed:', error);
      }
    }, force ? 0 : SYNC_DEBOUNCE_MS);
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      // Cleanup when user logs out
      syncService.stopPeriodicSync();
      realtimeOrchestrator.destroy();
      syncHeartbeat.stop();
      return;
    }

    isMountedRef.current = true;

    console.log('[Sync] Initializing orchestration for user:', userId);

    // Initialize realtime engine
    realtimeOrchestrator.initialize(userId);

    // Initialize active polling heartbeat
    syncHeartbeat.start(userId);

    // Start periodic sync
    syncService.startPeriodicSync(userId);

    // Listen for sync requests
    const handleSyncRequest = (e) => {
      const { reason } = e.detail || {};
      executeSync(reason || 'event', true);
    };

    window.addEventListener('app:sync-required', handleSyncRequest);

    // Initial sync
    executeSync('mount', true);

    return () => {
      isMountedRef.current = false;
      
      window.removeEventListener('app:sync-required', handleSyncRequest);
      
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }

      syncService.stopPeriodicSync();
      realtimeOrchestrator.destroy();
      syncHeartbeat.stop();

      console.log('[Sync] Orchestration cleaned up');
    };
  }, [userId, executeSync]);

  return executeSync;
};

/**
 * Manages side panel state (desktop only)
 */
const useSidePanel = () => {
  const [panelType, setPanelType] = useState(null);
  const [targetId, setTargetId] = useState(null);
  const [panelData, setPanelData] = useState(null);

  const openPanel = useCallback((type, id, data = null) => {
    console.log(`[SidePanel] Opening: ${type} (ID: ${id})`);
    setPanelType(type);
    setTargetId(id);
    setPanelData(data);
  }, []);

  const closePanel = useCallback(() => {
    console.log('[SidePanel] Closing');
    setPanelType(null);
    setTargetId(null);
    setPanelData(null);
  }, []);

  return {
    panelType,
    targetId,
    panelData,
    openPanel,
    closePanel,
  };
};

/**
 * Detects route types and extracts params
 */
const useRouteDetection = (pathname) => {
  return useMemo(() => {
    // Check if overlay route (sidebar content)
    const isOverlay = OVERLAY_ROUTES.has(pathname) || 
                     pathname.startsWith('/settings/') ||
                     pathname.startsWith('/reminders/') ||
                     pathname === '/reminders' ||
                     pathname === '/create-reminder';

    // Check if sub-page (not root)
    const isSubPage = pathname !== '/';

    // Check if active chat path
    const isChatActive = Array.from(ACTIVE_CHAT_PATHS)
      .some(path => pathname.startsWith(path));

    // Extract user details ID
    const isUserDetails = pathname.startsWith('/user-details/');
    const userDetailsId = isUserDetails 
      ? pathname.split('/user-details/')[1] 
      : null;

    // Extract shared media params
    const isSharedMedia = pathname.startsWith('/shared-media/');
    const sharedMediaId = isSharedMedia 
      ? pathname.split('/shared-media/')[1] 
      : null;

    return {
      isOverlay,
      isSubPage,
      isChatActive,
      isUserDetails,
      userDetailsId,
      isSharedMedia,
      sharedMediaId,
      isTheme: pathname === '/theme',
    };
  }, [pathname]);
};

// ══════════════════════════════════════════════════════════════
// Main Component
// ══════════════════════════════════════════════════════════════

const MainLayout = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isDesktop = useIsDesktop();

  // ──────────────────────────────────────────────────────────
  // Global State
  // ──────────────────────────────────────────────────────────

  // ✅ Subscribe to primitive ID — prevents re-renders when same chat is re-set
  const activeChatId = useChatStore(selectActiveChatId);
  const activeChat   = useChatStore(selectActiveChat);
  const setActiveChat = useChatStore(state => state.setActiveChat);

  // Click throttle ref
  const clickThrottleRef = useRef(0);
  const CLICK_THROTTLE_MS = 200;

  useSyncOrchestration(user?.id);
  useMusicSync(); // Global music synchronization

  const {
    panelType,
    targetId,
    panelData,
    openPanel,
    closePanel,
  } = useSidePanel();

  const {
    currentSong, 
    isPlaying,
    setIsPlaying,
    setCurrentSong,
    isPlayerExpanded
  } = useMusicStore();


  const routeInfo = useRouteDetection(location.pathname);
  const isRemindersRoute = location.pathname === '/reminders' || location.pathname === '/create-reminder';

  // ──────────────────────────────────────────────────────────
  // Side Effects
  // ──────────────────────────────────────────────────────────

  // Sync heartbeat with active chat — only fires when ID actually changes
  useEffect(() => {
    syncHeartbeat.setActiveChat(activeChatId || null);
  }, [activeChatId]);

  // ──────────────────────────────────────────────────────────
  // Computed Values
  // ──────────────────────────────────────────────────────────

  const currentChatId = activeChatId;

  // Check if chat view is active (mobile)
  const isChatViewActive = useMemo(() => {
    return !!activeChatId || routeInfo.isChatActive;
  }, [activeChatId, routeInfo.isChatActive]);

  // Check if on sub-page
  const isSubPage = useMemo(() => {
    return activeChatId !== null || routeInfo.isSubPage;
  }, [activeChatId, routeInfo.isSubPage]);

  // ──────────────────────────────────────────────────────────
  // Event Handlers
  // ──────────────────────────────────────────────────────────

  const handleChatClick = useCallback((chat) => {
    console.log('👆 handleChatClick called', {
        chatId: chat?.id,
        currentActive: useChatStore.getState().activeChatId,
        timestamp: Date.now()
    });

    if (!chat?.id) {
        console.warn('❌ No chat ID');
        return;
    }

    const now = Date.now();
    // ✅ Throttle rapid double-clicks
    if (now - clickThrottleRef.current < CLICK_THROTTLE_MS) {
        console.warn('⏱️ THROTTLED');
        return;
    }
    clickThrottleRef.current = now;

    // ✅ Bail out if already on this chat (store also guards, but this skips even the store call)
    if (useChatStore.getState().activeChatId === chat.id) {
        console.warn('⚠️ DUPLICATE - Already active');
        return;
    }

    setActiveChat(chat);
  }, [setActiveChat]);

  const handleShowUserDetails = useCallback((userId) => {
    if (!userId) return;

    if (isDesktop) {
      openPanel('user', userId);
    } else {

      navigate(`/user-details/${userId}`);
    }
  }, [isDesktop, openPanel, navigate]);

  const handleShowGroupInfo = useCallback((groupId, groupData = null) => {
    if (!groupId) return;

    if (isDesktop) {
      openPanel('group', groupId, groupData);
    } else {
      navigate(`/chat/${groupId}/group/info`);
    }
  }, [isDesktop, openPanel, navigate]);

  const handleShowThemeSelector = useCallback(() => {
    if (isDesktop) {
      openPanel('theme', 'current');
    } else {
      navigate('/theme');
    }
  }, [isDesktop, openPanel, navigate]);

  const handleShowSharedMedia = useCallback((id, isGroup = false, isFromUserDetails = false) => {
    if (!id) return;

    console.log(`[MainLayout] ShowSharedMedia: id=${id}, isGroup=${isGroup}, fromUD=${isFromUserDetails}`);

    if (isDesktop) {
      openPanel('shared-media', id, { isGroup, isFromUserDetails });
    } else {
      navigate(`/shared-media/${id}${isGroup ? '?isGroup=true' : ''}`);
    }
  }, [isDesktop, openPanel, navigate]);

  const handleCloseSidePanel = useCallback(() => {
    console.log('[MainLayout] Closing side panel');
    closePanel();
  }, [closePanel]);

  // ──────────────────────────────────────────────────────────
  // Stable Props Objects
  // ──────────────────────────────────────────────────────────

  const chatListPanelProps = useMemo(() => ({
    handleChatClick,
    isDesktop,
    currentChatId,
    userId: user?.id, // Only pass ID, not full user object
  }), [handleChatClick, isDesktop, currentChatId, user?.id]);

  const userDetailsContextValue = useMemo(() => ({
    showUserDetails: handleShowUserDetails,
    showGroupInfo: handleShowGroupInfo,
    showThemeSelector: handleShowThemeSelector,
    showSharedMedia: handleShowSharedMedia,
  }), [
    handleShowUserDetails,
    handleShowGroupInfo,
    handleShowThemeSelector,
    handleShowSharedMedia,
  ]);

  // ──────────────────────────────────────────────────────────
  // Desktop Side Panel Content
  // ──────────────────────────────────────────────────────────

  const sidePanel = useMemo(() => {
    if (!isDesktop || !panelType || !targetId) return null;

    const commonProps = {
      isPanel: true,
      onClose: handleCloseSidePanel,
    };

    return (
      <ErrorBoundary>
        <Suspense fallback={<LoadingFallback />}>
          {panelType === 'user' && (
            <UserDetails userId={targetId} {...commonProps} />
          )}

          {panelType === 'group' && (
            <GroupInfoDrawer
              isOpen={true}
              onClose={handleCloseSidePanel}
              group={panelData || { id: targetId }}
            />
          )}

          {panelType === 'shared-media' && (
            <SharedMedia
              userId={!panelData?.isGroup ? targetId : null}
              chatId={panelData?.isGroup ? targetId : null}
              {...commonProps}
              onClose={() => {
                if (panelData?.isFromUserDetails) {
                  openPanel('user', targetId);
                } else {
                  handleCloseSidePanel();
                }
              }}
            />
          )}

          {panelType === 'theme' && (
            <ThemeSelector {...commonProps} />
          )}
        </Suspense>
      </ErrorBoundary>
    );
  }, [
    isDesktop,
    panelType,
    targetId,
    panelData,
    handleCloseSidePanel,
    openPanel,
  ]);

  // ──────────────────────────────────────────────────────────
  // Mobile Sub-Pages
  // ──────────────────────────────────────────────────────────

  const mobileSubPages = useMemo(() => {
    if (isDesktop) return null;

    const { isUserDetails, userDetailsId, isSharedMedia, sharedMediaId, isTheme } = routeInfo;

    if (isUserDetails && userDetailsId) {
      return (
        <ErrorBoundary>
          <Suspense fallback={<LoadingFallback />}>
            <UserDetails userId={userDetailsId} />
          </Suspense>
        </ErrorBoundary>
      );
    }

    if (isTheme) {
      return (
        <ErrorBoundary>
          <Suspense fallback={<LoadingFallback />}>
            <ThemeSelector onClose={() => navigate(-1)} />
          </Suspense>
        </ErrorBoundary>
      );
    }

    if (isSharedMedia && sharedMediaId) {
      const searchParams = new URLSearchParams(location.search);
      const isGroup = searchParams.get('isGroup') === 'true';

      return (
        <ErrorBoundary>
          <Suspense fallback={<LoadingFallback />}>
            <SharedMedia
              userId={!isGroup ? sharedMediaId : null}
              chatId={isGroup ? sharedMediaId : null}
              onClose={() => navigate(-1)}
            />
          </Suspense>
        </ErrorBoundary>
      );
    }

    return null;
  }, [isDesktop, routeInfo, location.search, navigate]);

  // ──────────────────────────────────────────────────────────
  // Desktop Layout Components
  // ──────────────────────────────────────────────────────────

  const chatComponent = useMemo(() => (
    <ErrorBoundary>
      <Suspense fallback={<LoadingFallback />}>
        {isDesktop && routeInfo.isOverlay ? (
          <ChatPlaceholder />
        ) : (location.pathname === '/listen-together') ? (
          <Outlet />
        ) : activeChatId ? (
          <ChatScreen key={activeChatId} />
        ) : (
          <Outlet />
        )}
      </Suspense>
    </ErrorBoundary>
  ), [isDesktop, routeInfo.isOverlay, activeChatId]);

  const sidebarPanel = useMemo(() => (
    <ErrorBoundary>
      <Suspense fallback={<LoadingFallback />}>
        <Sidebar
          isDesktop={isDesktop}
          isContactsRoute={location.pathname === '/contacts'}
          isProfileRoute={location.pathname === '/profile'}
          isSettingsRoute={
            location.pathname === '/settings' ||
            location.pathname.startsWith('/settings/')
          }
          isSecuritySettingsRoute={location.pathname === '/settings/security'}
          isHelpCenterRoute={location.pathname === '/settings/help'}
          isTermsRoute={location.pathname === '/terms'}
          isPrivacyRoute={location.pathname === '/privacy'}
          isBlockedRoute={location.pathname === '/blocked'}
          isSupportRoute={location.pathname === '/support'}
          isEmojiSettingsRoute={location.pathname === '/emoji-settings'}
          isHistoryRoute={location.pathname === '/history'}
          isGamesRoute={location.pathname === '/games'}
          isMusicRoute={location.pathname === '/listen-together'}
          isRemindersRoute={isRemindersRoute}
          chatListPanelProps={chatListPanelProps}


          onCloseSidebar={() => navigate('/')}
        />
      </Suspense>
    </ErrorBoundary>
  ), [isDesktop, location.pathname, chatListPanelProps, navigate]);

  // ══════════════════════════════════════════════════════════
  // Render - Mobile Layout
  // ══════════════════════════════════════════════════════════

  if (!isDesktop) {
    return (
      <UserDetailsContext.Provider value={userDetailsContextValue}>
        <VersionUpdateModal />
        <AnimatePresence>
          {isPlayerExpanded && <FullscreenPlayer />}
        </AnimatePresence>

        <div className={`mobile-layout ${currentSong ? 'has-global-player' : ''} ${isPlayerExpanded ? 'layout-hidden-for-player' : ''}`}>
          {/* ✅ PERFORMANCE: Skip rendering background elements when player is full screen */}
          {!isPlayerExpanded && (
            <>
              <div 
                className={`list-view ${isChatViewActive ? 'list-view--behind' : ''}`}
                inert={isChatViewActive ? '' : undefined}
              >
                <ErrorBoundary>
                  <Suspense fallback={<LoadingFallback />}>
                    <ChatListPanel {...chatListPanelProps} />
                  </Suspense>
                </ErrorBoundary>
              </div>
              {!isChatViewActive && <BottomNavigation />}
            </>
          )}

          {/* Backdrop */}
          <AnimatePresence>
            {isSubPage && (
              <motion.div
                key="subpage-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                style={{
                  position: 'absolute',
                  inset: 0,
                  zIndex: 5,
                  background: 'var(--bg-color)',
                  pointerEvents: isSubPage ? 'auto' : 'none',
                }}
                aria-hidden="true"
              />
            )}
          </AnimatePresence>

          {/* Sub-pages & Chat View */}
          <AnimatePresence mode="wait">
            {isSubPage && !isPlayerExpanded && (
              <PageTransition
                key={location.pathname + (activeChat?.id || '')}
                className={`chat-view ${!isChatViewActive ? 'with-nav' : ''}`}
              >
                <ErrorBoundary>
                  <Suspense fallback={<LoadingFallback />}>
                    {mobileSubPages || 
                      ((activeChat && location.pathname === '/') ? (
                        <ChatScreen key={activeChat.id} />
                      ) : (
                        <Outlet />
                      ))
                    }
                  </Suspense>
                </ErrorBoundary>
              </PageTransition>
            )}
          </AnimatePresence>
          <GlobalPlayer 
            showBottomNav={!isChatViewActive} 
            isMusicHub={location.pathname === '/listen-together'}
          />
        </div>
      </UserDetailsContext.Provider>
    );
  }

  // ══════════════════════════════════════════════════════════
  // Render - Desktop Layout
  // ══════════════════════════════════════════════════════════

  return (
    <UserDetailsContext.Provider value={userDetailsContextValue}>
      <VersionUpdateModal />
      <GlobalPlayer isMusicHub={location.pathname === '/listen-together'} />


      
      <ErrorBoundary>
        <Suspense fallback={<LoadingFallback />}>
          <div className="reveal-app" style={{ width: '100%', height: '100%' }}>
            {!isPlayerExpanded && (
              <DesktopLayout
                chatListPanel={sidebarPanel}
                chatComponent={chatComponent}
                userDetailsPanel={sidePanel}
                particleOverlay={<ParticleOverlay />}
              />
            )}
            {isPlayerExpanded && <div style={{ background: '#000', width: '100%', height: '100%' }} />}
          </div>
        </Suspense>
      </ErrorBoundary>

      <AnimatePresence>
        {isPlayerExpanded && <FullscreenPlayer />}
      </AnimatePresence>
    </UserDetailsContext.Provider>
  );
};

export default memo(MainLayout);