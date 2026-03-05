import React, { useState, useEffect } from 'react';
import { useSupabase } from '../../contexts/SupabaseContext';
import useAuthStore from '../../store/authStore';
import { X } from 'lucide-react';
import BottomNavigation from '../common/BottomNavigation';
import { realtimeManager } from '../../utils/realtimeManager';
import { useDialog } from '../../contexts/DialogContext';
import './News.css';

const News = () => {
  const { supabase } = useSupabase();
  const currentUser = useAuthStore((state) => state.dbUser);
  const { showAlert } = useDialog();
  const [myStatuses, setMyStatuses] = useState([]);
  const [recentStatuses, setRecentStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);
  const initializeNewsRef = useRef(null);
  const loadMyStatusRef = useRef(null);
  const loadRecentStatusesRef = useRef(null);

  const loadMyStatus = useCallback(async (user) => {
    if (!user || !mountedRef.current) return;
    try {
      const { data: statuses, error } = await supabase
        .from('statuses')
        .select('*')
        .eq('user_id', user.id)
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (mountedRef.current) setMyStatuses(statuses || []);
    } catch (error) {
      console.error('Error loading my status:', error);
    }
  }, [supabase]);

  const loadRecentStatuses = useCallback(async (user) => {
    if (!user || !mountedRef.current) return;
    try {
      const cacheKey = `digidad_statuses_${user.id}`;
      // Fetch fresh data
      const { data: statuses, error } = await supabase
        .from('statuses')
        .select(`*, user:users(*)`)
        .neq('user_id', user.id)
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Group statuses by user
      const statusesByUser = {};
      if (statuses && statuses.length > 0) {
        statuses.forEach(status => {
          if (!statusesByUser[status.user_id]) {
            statusesByUser[status.user_id] = { user: status.user, statuses: [] };
          }
          statusesByUser[status.user_id].statuses.push(status);
        });
      }
      const statusData = Object.values(statusesByUser);

      if (mountedRef.current) {
        setRecentStatuses(statusData);
        try {
          localStorage.setItem(cacheKey, JSON.stringify(statusData));
        } catch (e) {
          console.warn('Error caching statuses:', e);
        }
      }
    } catch (error) {
      console.error('Error loading recent statuses:', error);
    }
  }, [supabase]);

  const initializeNews = useCallback(async (user) => {
    if (!user || !mountedRef.current) return;
    setLoading(true);
    setError(null); // Clear previous errors
    try {
      await Promise.all([loadMyStatus(user), loadRecentStatuses(user)]);
    } catch (err) {
      console.error('Error initializing news:', err);
      if (mountedRef.current) setError('Failed to load news');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [loadMyStatus, loadRecentStatuses]);

  initializeNewsRef.current = initializeNews;
  loadMyStatusRef.current = loadMyStatus;
  loadRecentStatusesRef.current = loadRecentStatuses;

  useEffect(() => {
    mountedRef.current = true;
    if (currentUser) {
      initializeNews(currentUser);
    }
    return () => { mountedRef.current = false; };
  }, [currentUser, initializeNews]);

  // Real-time subscription for statuses
  useEffect(() => {
    if (!currentUser) return;

    const channelName = `news_statuses_${currentUser.id}`;
    realtimeManager.subscribe(
      channelName,
      {},
      {
        postgres_changes: [
          {
            event: '*',
            schema: 'public',
            table: 'statuses',
            handler: () => {
              console.log('[News] Realtime status update');
              loadRecentStatusesRef.current?.(currentUser);
              loadMyStatusRef.current?.(currentUser);
            }
          }
        ],
        onReconnect: () => {
          console.log('[News] Reconnected, refreshing news feed...');
          initializeNewsRef.current?.(currentUser);
        }
      }
    );

    return () => {
      realtimeManager.unsubscribe(channelName);
    };
  }, [currentUser?.id]);

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatTime = (dateString) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'now';
      const now = new Date();
      const diff = now - date;
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(diff / 3600000);
      const days = Math.floor(diff / 86400000);

      if (minutes < 1) return 'now';
      if (minutes < 60) return `${minutes}m`;
      if (hours < 24) return `${hours}h`;
      return `${days}d`;
    } catch {
      return 'now';
    }
  };

  const handleAddStatus = () => {
    showAlert('Status feature coming soon');
  };

  const handleViewStatus = (user, statuses) => {
    showAlert(`Viewing ${user.name}'s status`);
  };

  if (loading) {
    return (
      <div className="news-loading">
        <div className="loading-spinner"></div>
        <p>Loading news...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="news-error">
        <p><X size={16} /> {error}</p>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  return (
    <div className="news-container">
      <header className="news-header">
        <h1><i className="fas fa-newspaper"></i> Latest News Feed</h1>
      </header>

      {/* My Status */}
      <div className="my-status-section">
        <div className="my-status" onClick={myStatuses.length > 0 ? () => handleViewStatus(currentUser, myStatuses) : undefined}>
          <div className="status-avatar">
            <div className="avatar-circle">
              {currentUser?.avatar ? (
                <img src={currentUser.avatar} alt={currentUser?.name || 'User'} />
              ) : (
                getInitials(currentUser?.name || 'User')
              )}
            </div>
          </div>
          <div className="status-info">
            <h3>My Status</h3>
            <p>
              {myStatuses.length > 0
                ? `${myStatuses.length} update${myStatuses.length > 1 ? 's' : ''}`
                : 'Tap to add status'
              }
            </p>
          </div>
          <button className="add-status-btn" onClick={handleAddStatus}>
            <i className="fas fa-plus"></i>
          </button>
        </div>
      </div>

      {/* Recent Statuses */}
      <div className="recent-statuses-section">
        <h2>Recent Updates</h2>
        <div className="recent-status-list">
          {recentStatuses.length > 0 ? (
            recentStatuses.filter(({ user, statuses }) => user && statuses && statuses.length > 0).map(({ user, statuses }) => (
              <div
                key={user.id}
                className="status-item"
                onClick={() => handleViewStatus(user, statuses)}
              >
                <div className="status-avatar">
                  <div className="avatar-circle">
                    {user.avatar ? (
                      <img src={user.avatar} alt={user.name || 'User'} />
                    ) : (
                      getInitials(user.name || 'User')
                    )}
                  </div>
                </div>
                <div className="status-info">
                  <h3>{user.name || 'User'}</h3>
                  <p>{statuses[0]?.created_at ? formatTime(statuses[0].created_at) : 'now'}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state">
              <p>No recent updates</p>
              <small>Check back later</small>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
};

export default News;