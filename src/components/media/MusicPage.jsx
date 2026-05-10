import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import useIsDesktop from '../../hooks/useIsDesktop';
import { 
  Music as MusicIcon, 
  Share2, 
  ChevronRight,
  LayoutGrid,
  Search as SearchIcon,
  Library as LibraryIcon,
  Users,
  Radio,
  UserPlus,
  PlusCircle,
  X,
  Compass,
  ArrowLeft,
  MessageSquare
} from 'lucide-react';
import useMusicStore from '../../store/useMusicStore';
import MusicSearch from './MusicSearch';
import useChatStore from '../../store/useChatStore';
import useAuthStore from '../../store/authStore';
import { db } from '../../db/db';
import { queueAction, QUEUE_ACTIONS } from '../../services/offlineQueue';
import { frontendToDb } from '../../utils/dbFieldMapping';
import { toast } from 'react-hot-toast';

// Sub-pages
import MusicHome from './MusicHome';
import MusicSearchPage from './MusicSearchPage';
import MusicLibrary from './MusicLibrary';
import MusicLikedPage from './MusicLikedPage';
import MusicSharePage from './MusicSharePage';
import MusicCategoryPage from './MusicCategoryPage';
import MusicDownloadsPage from './MusicDownloadsPage';
import './MusicPage.css';
import './MusicHubNav.css';

/**
 * MusicPage Component
 * A full-screen page for music discovery and session management.
 * Replaces the old sliding MusicPanel to improve performance.
 */
const MusicPage = () => {
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();

  // Hide main bottom navigation when on this page (mobile only)
  useEffect(() => {
    if (!isDesktop) {
      document.body.classList.add('hide-main-nav');
      return () => document.body.classList.remove('hide-main-nav');
    }
  }, [isDesktop]);

  const [sessionMode, setSessionMode] = React.useState(null);
  const [selectedCategory, setSelectedCategory] = React.useState(null);
  
  const currentSong = useMusicStore(state => state.currentSong);
  const activeSection = useMusicStore(state => state.activeSection);
  const setActiveSection = useMusicStore(state => state.setActiveSection);
  const songToShare = useMusicStore(state => state.songToShare);
  const setSongToShare = useMusicStore(state => state.setSongToShare);
  const isPlaying = useMusicStore(state => state.isPlaying);
  const setIsPlaying = useMusicStore(state => state.setIsPlaying);
  const setProgress = useMusicStore(state => state.setProgress);
  const roomId = useMusicStore(state => state.roomId);
  const joinRoom = useMusicStore(state => state.joinRoom);
  const leaveRoom = useMusicStore(state => state.leaveRoom);
  const user = useAuthStore(state => state.user);
  const backgroundImages = useMusicStore(state => state.backgroundImages);

  const handleSeek = (e) => {
    const time = parseFloat(e.target.value);
    setProgress(time);
  };

  const handleShareSession = () => {
    if (!roomId) {
      toast.error("No active session to share");
      return;
    }
    setSongToShare(null); 
    setActiveSection('share');
  };

  const handleShareSessionToChat = async (targetChat) => {
    if (!roomId || !targetChat || !user) return;

    const tempId = String(Date.now());
    const taskId = crypto.randomUUID();

    const isGroup = !!(targetChat.isGroup || targetChat.is_group);
    
    const shareMsg = {
      chatId: targetChat.id,
      senderId: user.id,
      receiverId: isGroup ? user.id : targetChat.otherUserId,
      content: `Join my Music Session! Room ID: ${roomId}`,
      metadata: {
        type: 'music_session_share',
        roomId: roomId,
        song: currentSong
      },
      isGroupMessage: isGroup,
      messageType: 'song', 
      createdAt: new Date().toISOString(),
      status: 'sending',
      tempId,
    };

    try {
      await db.transaction('rw', [db.messages, db.chats_list], async () => {
        await db.messages.put({ ...shareMsg, id: `temp_${tempId}` });
        // Update chat list recency
        await db.chats_list.update(String(targetChat.id), {
          lastMessageAt: shareMsg.createdAt,
          timestamp: shareMsg.createdAt,
          lastMessage: `🎧 Music Session Invite`,
          status: 'sending'
        }).catch(() => {});
      });
      
      const dbData = frontendToDb(shareMsg);
      await queueAction(QUEUE_ACTIONS.INSERT_MESSAGE, 'messages', dbData, { taskId });
      
      toast.success(`Invited ${isGroup ? (targetChat.name || 'Group') : (targetChat.otherUser?.name || 'User')}`, { 
        icon: <Users size={18} />,
        style: { background: '#0b141a', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }
      });
    } catch (err) {
      console.error("Session share failed:", err);
      toast.error("Failed to share room");
    }
  };

  const handleShareToChat = async (chat) => {
    // If we have a specific song to share, share that. Otherwise share the session.
    if (songToShare) {
      const tempId = String(Date.now());
      const taskId = crypto.randomUUID();

      const frontendMsg = {
        chatId: chat.id,
        senderId: user.id,
        receiverId: chat.isGroup ? user.id : chat.otherUserId,
        content: `Shared a song: ${songToShare.title}`,
        metadata: {
          song: songToShare,
          type: 'music_share',
          roomId: roomId
        },
        isGroupMessage: Boolean(chat.isGroup),
        messageType: 'song',
        createdAt: new Date().toISOString(),
        status: 'sending',
        tempId,
      };

      try {
        await db.transaction('rw', [db.messages, db.chats_list], async () => {
          await db.messages.put({ ...frontendMsg, id: `temp_${tempId}` });
          await db.chats_list.update(String(chat.id), {
            lastMessageAt: frontendMsg.createdAt,
            timestamp: frontendMsg.createdAt,
            lastMessage: `🎵 ${songToShare.title}`,
            status: 'sending'
          }).catch(() => {});
        });

        const dbData = frontendToDb(frontendMsg);
        await queueAction(QUEUE_ACTIONS.INSERT_MESSAGE, 'messages', dbData, { taskId });
        
        toast.success(`Shared to ${chat.resolvedName || 'Chat'}!`);
      } catch (error) {
        console.error("Music share failed:", error);
        toast.error("Failed to share");
      }
    } else {
      await handleShareSessionToChat(chat);
    }
  };


  const handleJoinManual = async (e) => {
    e.preventDefault();
    const id = e.target.roomInput.value.trim().toUpperCase();
    if (id) {
      await joinRoom(id, false);
    }
  };

  return (
    <div className="music-page-container">
      <div className="music-page-inner">
        {/* Root Background Layer */}
        <div className="parallax-bg-layer">
          <div className="bg-slider-wrapper">
            {currentSong ? (
              <img 
                src={currentSong.image} 
                alt="" 
                className="bg-parallax-img active-song-bg"
                loading="lazy"
              />
            ) : (backgroundImages || []).length > 0 ? (
              backgroundImages.slice(0, 2).map((song, i) => (
                <img 
                  key={`bg-root-${song.id}-${i}`} 
                  src={song.image || (song.images?.['500x500'])} 
                  alt="" 
                  className="bg-parallax-img"
                  style={{ animationDelay: `${i * -15}s` }}
                  loading="lazy"
                />
              ))
            ) : (
              <div className="bg-placeholder" />
            )}
          </div>
          <div className="bg-overlay-gradient" />
          <div className="vignette-overlay" />
        </div>
        
        {/* Content Layers */}
        <div className="music-page-content-wrapper">
          {/* Main header only shows when NOT in a specific category */}
          {!selectedCategory && (
            <div className="panel-header-glass">
              {currentSong && (
                <img 
                  key={`header-bg-${currentSong.id}`}
                  src={currentSong.image} 
                  className="header-dynamic-bg" 
                  alt="" 
                />
              )}
              <div className="header-top">
                <div className="brand-badge">
                  <div className="brand-dot" />
                  <span style={{ fontWeight: 800, letterSpacing: '0.05em' }}>
                    {activeSection === 'share' ? 'SELECT CHAT' : 'ELEVENgram'}
                  </span>
                </div>
                <button className="panel-close-btn" onClick={() => activeSection === 'share' ? setActiveSection('home') : navigate(-1)}>
                  {activeSection === 'share' ? <ArrowLeft size={24} /> : <X size={24} />}
                </button>
              </div>
              
              {activeSection === 'home' && (
                <h2 className="panel-title" style={{ marginTop: '8px', fontSize: '1.5rem', fontWeight: 900, letterSpacing: '-0.02em' }}>
                  <Compass size={24} className="title-icon" style={{ color: 'var(--brand-primary, #00ff88)' }} />
                  Discovery
                </h2>
              )}
            </div>
          )}

          <div className="panel-body-scrollable" style={{ paddingTop: selectedCategory ? '0' : '' }}>
            <AnimatePresence mode="wait">
              <motion.div 
                key={selectedCategory ? `cat-${selectedCategory.id}` : activeSection}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                style={{ padding: selectedCategory ? '0' : '0 8px 120px 8px' }}
              >
                {selectedCategory ? (
                  <MusicCategoryPage 
                    category={selectedCategory} 
                    onBack={() => setSelectedCategory(null)} 
                  />
                ) : (
                  <>
                    {activeSection === 'home' && (
                      <MusicHome 
                        onShareSession={handleShareSession} 
                        onSelectCategory={(cat) => setSelectedCategory(cat)} 
                      />
                    )}
                    {activeSection === 'search' && <MusicSearchPage />}
                    {activeSection === 'library' && <MusicLibrary />}
                    {activeSection === 'downloads' && <MusicDownloadsPage onBack={() => setActiveSection('library')} />}
                    {activeSection === 'liked' && <MusicLikedPage onBack={() => setActiveSection('library')} />}
                    {activeSection === 'playlists' && (
                      <div className="music-library-container">
                        <header className="library-header">
                          <button onClick={() => setActiveSection('library')} className="action-btn"><ArrowLeft size={24} /></button>
                          <h1>Playlists</h1>
                        </header>
                        <div className="empty-state-card">
                          <div className="empty-icon-circle">
                            <LayoutGrid size={32} />
                          </div>
                          <div className="empty-text">
                            <h4>Coming Soon</h4>
                            <p>We are building a powerful playlist engine for you.</p>
                          </div>
                        </div>
                      </div>
                    )}
                    {activeSection === 'share' && <MusicSharePage onShare={handleShareToChat} onBack={() => setActiveSection('home')} />}
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Dedicated Music Hub Sub-Navigation */}
          <div className="music-hub-nav">
            <button 
              className="hub-nav-item"
              onClick={() => navigate('/')}
            >
              <MessageSquare size={22} />
              <span>Chats</span>
            </button>
            <button 
              className={`hub-nav-item ${activeSection === 'home' ? 'active' : ''}`}
              onClick={() => setActiveSection('home')}
            >
              <LayoutGrid size={22} />
              <span>Home</span>
            </button>
            <button 
              className={`hub-nav-item ${activeSection === 'search' ? 'active' : ''}`}
              onClick={() => setActiveSection('search')}
            >
              <SearchIcon size={22} />
              <span>Search</span>
            </button>
            <button 
              className={`hub-nav-item ${activeSection === 'library' ? 'active' : ''}`}
              onClick={() => setActiveSection('library')}
            >
              <LibraryIcon size={22} />
              <span>Library</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MusicPage;
