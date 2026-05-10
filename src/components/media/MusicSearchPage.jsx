import React, { useState, useEffect } from 'react';
import { Search, Loader2, X, Clock, ArrowRight } from 'lucide-react';
import MusicSearch from './MusicSearch';
import useMusicStore from '../../store/useMusicStore';

const MusicSearchPage = () => {
  const searchQuery = useMusicStore(state => state.searchQuery);
  const setSearchQuery = useMusicStore(state => state.setSearchQuery);
  const recentSearches = useMusicStore(state => state.recentSearches);
  const addToRecentSearches = useMusicStore(state => state.addToRecentSearches);
  const clearRecentSearches = useMusicStore(state => state.clearRecentSearches);
  const isSearchLoading = useMusicStore(state => state.isSearchLoading);
  
  const [localQuery, setLocalQuery] = useState(searchQuery);
  
  // Sync local query with store query (e.g. when cleared from MusicHome)
  useEffect(() => {
    if (searchQuery !== localQuery) {
      setLocalQuery(searchQuery);
    }
  }, [searchQuery]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(localQuery);
      if (localQuery.trim()) {
        addToRecentSearches(localQuery.trim());
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [localQuery]);

  return (
    <div className="music-search-page-fade-in" style={{ padding: '20px 0 120px 0' }}>
      {/* Prominent Search Bar */}
      <div className="sticky-search-wrapper" style={{ top: '0', background: 'transparent' }}>
        <div className="brand-header">
          <div className="brand-dot" />
          <span className="brand-name">ELEVENgram Search</span>
        </div>
        <div className="search-input-wrapper">
          <Search className="search-icon" size={18} />
          <input 
            type="text" 
            placeholder="Search songs, artists, podcasts..." 
            value={localQuery}
            onChange={(e) => setLocalQuery(e.target.value)}
            autoFocus
          />
          {localQuery && (
            <X 
              size={18} 
              className="search-clear-icon" 
              onClick={() => { setLocalQuery(''); setSearchQuery(''); }} 
            />
          )}
          {isSearchLoading && <Loader2 className="loading-spinner-icon animate-spin" size={18} />}
        </div>
      </div>

      {/* Suggestions Section (When not searching) */}
      {!localQuery.trim() && (
        <div style={{ marginTop: '24px' }}>
          {recentSearches.length > 0 && (
            <div className="recent-searches-container" style={{ marginBottom: '32px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Recent Searches</h3>
                <button 
                  onClick={clearRecentSearches}
                  style={{ background: 'transparent', border: 'none', color: 'var(--brand-primary)', fontSize: '0.8rem', fontWeight: 700 }}
                >
                  Clear All
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {recentSearches.slice(0, 3).map((q, i) => (
                  <div 
                    key={i} 
                    onClick={() => { setLocalQuery(q); }}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '12px', 
                      padding: '12px', 
                      borderRadius: '12px', 
                      background: 'rgba(255,255,255,0.02)',
                      cursor: 'pointer'
                    }}
                  >
                    <Clock size={16} style={{ opacity: 0.3 }} />
                    <span style={{ flex: 1 }}>{q}</span>
                    <ArrowRight size={14} style={{ opacity: 0.2 }} />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="trending-suggestions">
            <h3 style={{ 
              margin: '0 0 20px 0', 
              fontSize: '1.2rem', 
              fontWeight: 900, 
              display: 'flex', 
              alignItems: 'center', 
              gap: '12px',
              letterSpacing: '-0.02em'
            }}>
              <div style={{ 
                width: '10px', 
                height: '10px', 
                borderRadius: '50%', 
                background: '#00ff88',
                boxShadow: '0 0 12px #00ff88' 
              }} />
              Trending Now
            </h3>
            <MusicSearch hideHeader={true} />
          </div>
        </div>
      )}

      {/* Search Results (When searching) */}
      {localQuery.trim() && (
        <div style={{ marginTop: '16px' }}>
          <MusicSearch hideHeader={true} />
        </div>
      )}
    </div>
  );
};

export default MusicSearchPage;
