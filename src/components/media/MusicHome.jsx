import React from 'react';
import { motion } from 'framer-motion';
import { Play, Clock, TrendingUp, Sparkles, Heart, Users, Music, Disc, Mic2, Zap, Radio, Copy, Send } from 'lucide-react';
import { toast } from 'react-hot-toast';
import useMusicStore from '../../store/useMusicStore';
import useAuthStore from '../../store/authStore';

const MusicHome = ({ onShareSession, onSelectCategory }) => {
  const { user } = useAuthStore();
  const playbackHistory = useMusicStore(state => state.playbackHistory);
  const likedSongs = useMusicStore(state => state.likedSongs);
  const setCurrentSong = useMusicStore(state => state.setCurrentSong);
  const setIsPlaying = useMusicStore(state => state.setIsPlaying);
  const setActiveTab = useMusicStore(state => state.setActiveTab);
  const setActiveSection = useMusicStore(state => state.setActiveSection);
  const setSearchQuery = useMusicStore(state => state.setSearchQuery);
  const joinRoom = useMusicStore(state => state.joinRoom);
  const leaveRoom = useMusicStore(state => state.leaveRoom);
  const roomId = useMusicStore(state => state.roomId);

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const handleSongClick = (song) => {
    setCurrentSong(song);
    setIsPlaying(true);
  };

  return (
    <div className="music-home-fade-in" style={{ paddingBottom: '120px' }}>
      {/* Personalized Header - Premium Overhaul */}
      <header style={{ marginBottom: '44px', padding: '0 4px' }}>
        <h1 style={{ 
          fontSize: '2.6rem', 
          lineHeight: 1.1,
          fontWeight: 900, 
          margin: 0, 
          color: '#fff', 
          letterSpacing: '-0.04em' 
        }}>
          {greeting()}, <br/>
          <span style={{ 
            background: 'linear-gradient(90deg, var(--brand-primary, #00ff88), #fff)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            {user?.display_name || user?.full_name?.split(' ')[0] || 'there'}
          </span>
        </h1>
        <p style={{ margin: '14px 0 0 0', opacity: 0.4, fontSize: '1.05rem', fontWeight: 500, letterSpacing: '0.01em' }}>
          What's your vibe today?
        </p>
      </header>


      {/* Session Management - Integrated */}
      <section style={{ 
        marginBottom: '40px', 
        padding: '20px', 
        borderRadius: '24px', 
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <Users size={20} style={{ color: '#00ff88' }} />
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>
            {roomId ? 'Session Active' : 'Listen Together'}
          </h3>
          {roomId && (
            <div 
              onClick={() => {
                navigator.clipboard.writeText(roomId);
                toast.success("Room ID Copied!", { 
                  icon: <Copy size={18} />,
                  style: { background: '#0b141a', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }
                });
              }}
              style={{ 
                marginLeft: 'auto', 
                background: 'rgba(0, 255, 136, 0.15)', 
                color: '#00ff88', 
                padding: '6px 12px', 
                borderRadius: '12px', 
                fontSize: '0.8rem', 
                fontWeight: 900,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                border: '1px solid rgba(0, 255, 136, 0.2)'
              }}
            >
              <Copy size={12} />
              {roomId}
            </div>
          )}
        </div>

        {roomId ? (
            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                onClick={onShareSession}
                style={{ 
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '14px', 
                  borderRadius: '16px', 
                  background: 'var(--brand-primary)', 
                  color: '#0b141a',
                  border: 'none',
                  fontWeight: 800,
                  fontSize: '0.9rem',
                  cursor: 'pointer'
                }}
              >
                <Send size={18} />
                Share to Chat
              </button>
              <button 
                onClick={() => leaveRoom()}
                style={{ 
                  padding: '14px 20px', 
                  borderRadius: '16px', 
                  background: 'rgba(255, 75, 75, 0.1)', 
                  color: '#ff4b4b',
                  border: '1px solid rgba(255, 75, 75, 0.2)',
                  fontWeight: 800,
                  fontSize: '0.9rem',
                  cursor: 'pointer'
                }}
              >
                End
              </button>
            </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button 
              onClick={() => joinRoom(null, true)}
              style={{ 
                padding: '16px', 
                borderRadius: '16px', 
                background: 'rgba(0, 255, 136, 0.15)', 
                color: '#00ff88',
                border: '1px solid rgba(0, 255, 136, 0.3)',
                fontWeight: 800,
                fontSize: '0.9rem',
                cursor: 'pointer'
              }}
            >
              Create New Room
            </button>
            
            <div style={{ display: 'flex', gap: '8px' }}>
              <input 
                id="room-join-input"
                type="text" 
                placeholder="Enter Room ID..."
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  borderRadius: '14px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#fff',
                  fontSize: '0.85rem',
                  outline: 'none'
                }}
              />
              <button 
                onClick={() => {
                  const id = document.getElementById('room-join-input').value.trim();
                  if (id) joinRoom(id, false);
                }}
                style={{ 
                  padding: '12px 20px', 
                  borderRadius: '14px', 
                  background: 'var(--brand-primary)', 
                  color: '#0b141a',
                  border: 'none',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                Join
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Quick Picks - Refined (3-Column Discovery Grid) */}
      <section style={{ marginBottom: '40px' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', fontWeight: 800 }}>Explore by Category</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
          {[
            { id: 'Trending', label: 'Charts', icon: TrendingUp, color: '#3b82f6', gradient: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)' },
            { id: 'Hindi', label: 'Hindi', icon: Sparkles, color: '#00a884', gradient: 'linear-gradient(135deg, #064e3b 0%, #00a884 100%)' },
            { id: 'Punjabi', label: 'Punjabi', icon: Disc, color: '#c2410c', gradient: 'linear-gradient(135deg, #7c2d12 0%, #ea580c 100%)' },
            { id: 'Haryanvi', label: 'Haryanvi', icon: Zap, color: '#10b981', gradient: 'linear-gradient(135deg, #052e16 0%, #10b981 100%)' },
            { id: 'Bhojpuri', label: 'Bhojpuri', icon: Music, color: '#dc2626', gradient: 'linear-gradient(135deg, #450a0a 0%, #dc2626 100%)' },
            { id: 'South', label: 'South', icon: Radio, color: '#0891b2', gradient: 'linear-gradient(135deg, #083344 0%, #0891b2 100%)' },
            { id: 'Romantic', label: 'Love', icon: Heart, color: '#db2777', gradient: 'linear-gradient(135deg, #500724 0%, #db2777 100%)' },
            { id: '90s', label: '90s', icon: Mic2, color: '#0284c7', gradient: 'linear-gradient(135deg, #0c4a6e 0%, #0284c7 100%)' },
            { id: 'Party', label: 'Party', icon: Music, color: '#ca8a04', gradient: 'linear-gradient(135deg, #422006 0%, #ca8a04 100%)' },
            { id: 'Lofi', label: 'Lofi', icon: Clock, color: '#0d9488', gradient: 'linear-gradient(135deg, #134e4a 0%, #0d9488 100%)' },
            { id: 'Global', label: 'Global', icon: Users, color: '#16a34a', gradient: 'linear-gradient(135deg, #064e3b 0%, #16a34a 100%)' },
            { id: 'Devotional', label: 'Bhakti', icon: Sparkles, color: '#ea580c', gradient: 'linear-gradient(135deg, #431407 0%, #ea580c 100%)' }
          ].map((cat) => (
            <motion.div 
              key={cat.id}
              whileTap={{ scale: 0.96 }}
              whileHover={{ y: -4 }}
              onClick={() => { 
                if (onSelectCategory) {
                  onSelectCategory(cat);
                } else {
                  setSearchQuery(""); 
                  setActiveTab(cat.id); 
                  setActiveSection('search'); 
                }
              }}
              className="music-category-card"
            >
              <div 
                className="category-icon-box"
                style={{ 
                  background: cat.gradient, 
                  boxShadow: `0 8px 15px ${cat.color}22`,
                }}
              >
                <cat.icon size={24} style={{ position: 'relative', zIndex: 1 }} />
              </div>
              <h4 className="category-label">{cat.label}</h4>
            </motion.div>
          ))}
        </div>
      </section>

      <style>{`
        .horizontal-scroll-container::-webkit-scrollbar { display: none; }
        .carousel-play-overlay {
          position: absolute;
          inset: 0;
          background: rgba(0,0,0,0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 16px;
          opacity: 0;
          transition: opacity 0.2s ease;
        }
        div:hover .carousel-play-overlay { opacity: 1; }
        .text-brand { color: var(--brand-primary); }
      `}</style>
    </div>
  );
};

export default MusicHome;
