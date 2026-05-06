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
    <div className="music-home-fade-in">
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
            { id: 'Hindi', label: 'Hindi', icon: Sparkles, color: '#f59e0b', gradient: 'linear-gradient(135deg, #78350f 0%, #f59e0b 100%)' },
            { id: 'Punjabi', label: 'Punjabi', icon: Disc, color: '#a855f7', gradient: 'linear-gradient(135deg, #581c87 0%, #a855f7 100%)' },
            { id: 'Haryanvi', label: 'Haryanvi', icon: Zap, color: '#10b981', gradient: 'linear-gradient(135deg, #064e3b 0%, #10b981 100%)' },
            { id: 'Bhojpuri', label: 'Bhojpuri', icon: Music, color: '#f43f5e', gradient: 'linear-gradient(135deg, #881337 0%, #f43f5e 100%)' },
            { id: 'South', label: 'South', icon: Radio, color: '#0ea5e9', gradient: 'linear-gradient(135deg, #0c4a6e 0%, #0ea5e9 100%)' },
            { id: 'Romantic', label: 'Love', icon: Heart, color: '#ec4899', gradient: 'linear-gradient(135deg, #831843 0%, #ec4899 100%)' },
            { id: '90s', label: '90s', icon: Mic2, color: '#06b6d4', gradient: 'linear-gradient(135deg, #164e63 0%, #06b6d4 100%)' },
            { id: 'Party', label: 'Party', icon: Music, color: '#eab308', gradient: 'linear-gradient(135deg, #713f12 0%, #eab308 100%)' },
            { id: 'Lofi', label: 'Lofi', icon: Clock, color: '#6366f1', gradient: 'linear-gradient(135deg, #312e81 0%, #6366f1 100%)' },
            { id: 'Global', label: 'Global', icon: Users, color: '#8b5cf6', gradient: 'linear-gradient(135deg, #4c1d95 0%, #8b5cf6 100%)' },
            { id: 'Devotional', label: 'Bhakti', icon: Sparkles, color: '#f97316', gradient: 'linear-gradient(135deg, #7c2d12 0%, #f97316 100%)' }
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
              style={{ 
                padding: '22px 10px', 
                borderRadius: '26px', 
                background: 'rgba(255, 255, 255, 0.03)', 
                cursor: 'pointer',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), background 0.2s ease',
                textAlign: 'center',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
              }}
            >
              <div style={{ 
                width: '50px', 
                height: '50px', 
                borderRadius: '18px', 
                background: cat.gradient, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: '#fff',
                boxShadow: `0 8px 15px ${cat.color}22`,
                position: 'relative',
                overflow: 'hidden'
              }}>
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 100%)' }} />
                <cat.icon size={24} style={{ position: 'relative', zIndex: 1 }} />
              </div>
              <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 800, color: '#fff', opacity: 0.85, letterSpacing: '0.01em' }}>{cat.label}</h4>
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
