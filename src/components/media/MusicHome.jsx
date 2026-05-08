import React from 'react';
import { motion } from 'framer-motion';
import { Play, Clock, TrendingUp, Sparkles, Heart, Users, Music, Disc, Mic2, Zap, Radio, Copy, Send } from 'lucide-react';
import { toast } from 'react-hot-toast';
import useMusicStore from '../../store/useMusicStore';
import useAuthStore from '../../store/authStore';
import './MusicHome.css';

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
    <div className="music-home-container">
      {/* Personalized Header - Premium Overhaul */}
      <header className="music-home-header">
        <h1>
          {greeting()}, <br/>
          <span className="greeting-name">
            {user?.display_name || user?.full_name?.split(' ')[0] || 'there'}
          </span>
        </h1>
        <p>What's your vibe today?</p>
      </header>


      {/* Session Management - Integrated */}
      <section className="music-session-section">
        <div className="session-header">
          <Users size={20} className="text-brand" />
          <h3>{roomId ? 'Session Active' : 'Listen Together'}</h3>
          {roomId && (
            <div 
              onClick={() => {
                navigator.clipboard.writeText(roomId);
                toast.success("Room ID Copied!", { 
                  icon: <Copy size={18} />,
                  style: { background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }
                });
              }}
              className="room-id-badge"
            >
              <Copy size={12} />
              {roomId}
            </div>
          )}
        </div>

        {roomId ? (
            <div className="session-actions">
              <button onClick={onShareSession} className="session-btn-primary">
                <Send size={18} />
                Share to Chat
              </button>
              <button onClick={() => leaveRoom()} className="session-btn-secondary">
                End
              </button>
            </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button onClick={() => joinRoom(null, true)} className="session-btn-primary">
              Create New Room
            </button>
            
            <div className="session-join-input-group">
              <input 
                id="room-join-input"
                type="text" 
                placeholder="Enter Room ID..."
                className="session-join-input"
              />
              <button 
                onClick={() => {
                  const id = document.getElementById('room-join-input').value.trim();
                  if (id) joinRoom(id, false);
                }}
                className="session-join-btn"
              >
                Join
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Quick Picks - Refined (3-Column Discovery Grid) */}
      <section style={{ marginBottom: '40px' }}>
        <h3 className="category-section-title">Explore by Category</h3>
        <div className="category-grid">
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
        .session-btn-primary:hover { opacity: 0.9; }
        .text-brand { color: var(--brand-primary); }
      `}</style>
    </div>
  );
};

export default MusicHome;
