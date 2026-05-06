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
import MusicSharePage from './MusicSharePage';
import MusicCategoryPage from './MusicCategoryPage';
import './MusicPage.css';

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
  const { 
    currentSong, 
    activeSection,
    setActiveSection,
    isPlaying,
    setIsPlaying,
    progress,
    setProgress,
    duration,
    roomId, 
    joinRoom, 
    leaveRoom,
    isHost,
    setPlayerExpanded,
    backgroundImages
  } = useMusicStore();

  const handleSeek = (e) => {
    const time = parseFloat(e.target.value);
    setProgress(time);
  };

  const handleShareSession = () => {
    if (!roomId) {
      toast.error("No active session to share");
      return;
    }
    setActiveSection('share');
  };

  const handleShareToChat = async (targetChat) => {
    if (!roomId || !targetChat) return;
    
    const { user } = useAuthStore.getState();
    if (!user) return;

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

  const handleJoinManual = (e) => {
    e.preventDefault();
    const id = e.target.roomInput.value.trim().toUpperCase();
    if (id) {
      joinRoom(id, false);
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
              backgroundImages.slice(0, 3).map((song, i) => (
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
          {/* Header remains but is simplified for sub-pages */}
          <div className="panel-header-glass">
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

          <div className="panel-body-scrollable">
            <AnimatePresence mode="wait">
              <motion.div 
                key={selectedCategory ? `cat-${selectedCategory.id}` : activeSection}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                style={{ padding: selectedCategory ? '0' : '0 16px 120px 16px' }}
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

// Add styles for the new sub-navigation
const styles = `
.music-hub-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 75px;
  background: rgba(15, 23, 42, 0.85);
  backdrop-filter: blur(25px) saturate(180%);
  display: flex;
  justify-content: space-around;
  align-items: center;
  padding-bottom: env(safe-area-inset-bottom);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  z-index: 1000;
  box-shadow: 0 -10px 40px rgba(0,0,0,0.4);
}

.hub-nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  background: none;
  border: none;
  color: #94a3b8;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  opacity: 0.6;
  flex: 1;
  padding: 10px 0;
  cursor: pointer;
}

.hub-nav-item.active {
  color: #00ff88;
  opacity: 1;
  transform: translateY(-4px);
}

.hub-nav-item span {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.hub-nav-item svg {
  filter: drop-shadow(0 0 8px rgba(0, 255, 136, 0));
  transition: filter 0.3s ease;
}

.hub-nav-item.active svg {
  filter: drop-shadow(0 0 8px rgba(0, 255, 136, 0.4));
}

.music-home-fade-in, .music-search-page-fade-in, .music-library-fade-in {
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(5px); }
  to { opacity: 1; transform: translateY(0); }
}
`;

if (typeof document !== 'undefined') {
  const styleSheet = document.createElement("style");
  styleSheet.innerText = styles;
  document.head.appendChild(styleSheet);
}
