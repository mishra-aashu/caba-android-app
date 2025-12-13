import React, { useState, useEffect } from 'react';
import { useSupabase } from '../../contexts/SupabaseContext';
import { X } from 'lucide-react';
import BottomNavigation from '../common/BottomNavigation';
import './News.css';

const News = () => {
  const { supabase } = useSupabase();
  const [currentUser, setCurrentUser] = useState(null);
  const [myStatuses, setMyStatuses] = useState([]);
  const [recentStatuses, setRecentStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    initializeNews();
  }, []);

  const initializeNews = async () => {
    try {
      // Get current user from localStorage
      const userStr = localStorage.getItem('currentUser');
      if (!userStr) {
        setError('No user logged in');
        setLoading(false);
        return;
      }
      let user;
      try {
        user = JSON.parse(userStr);
        if (!user || !user.id) {
          setError('Invalid user data');
          setLoading(false);
          return;
        }
      } catch {
        setError('Invalid user data');
        setLoading(false);
        return;
      }
      setCurrentUser(user);

      // Load statuses
      await loadMyStatus(user);
      await loadRecentStatuses(user);

      setLoading(false);
    } catch (error) {
      console.error('Error initializing news:', error);
      setError('Failed to load news');
      setLoading(false);
    }
  };

  const loadMyStatus = async (user) => {
    try {
      const { data: statuses, error } = await supabase
        .from('statuses')
        .select('*')
        .eq('user_id', user.id)
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMyStatuses(statuses || []);
    } catch (error) {
      console.error('Error loading my status:', error);
    }
  };

  const loadRecentStatuses = async (user) => {
    try {
      const cacheKey = `digidad_statuses_${user.id}`;
      let cachedStatuses = null;

      // Try to load from cache
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          cachedStatuses = JSON.parse(cached);
          setRecentStatuses(cachedStatuses);
        }
      } catch (e) {
        console.warn('Error loading cached statuses:', e);
      }

      // Fetch fresh data
      const { data: statuses, error } = await supabase
        .from('statuses')
        .select(`
          *,
          user:users(*)
        `)
        .neq('user_id', user.id)
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Group statuses by user
      const statusesByUser = {};
      if (statuses && statuses.length > 0) {
        statuses.forEach(status => {
          if (!statusesByUser[status.user_id]) {
            statusesByUser[status.user_id] = {
              user: status.user,
              statuses: []
            };
          }
          statusesByUser[status.user_id].statuses.push(status);
        });
      }

      const statusData = Object.values(statusesByUser);

      // Cache the fresh data
      try {
        localStorage.setItem(cacheKey, JSON.stringify(statusData));
      } catch (e) {
        console.warn('Error caching statuses:', e);
      }

      // Update state
      setRecentStatuses(statusData);
    } catch (error) {
      console.error('Error loading recent statuses:', error);
      // If network fails and no cache, show error
      if (!recentStatuses.length) {
        setError('Failed to load recent updates');
      }
    }
  };

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
    alert('Status feature coming soon');
  };

  const handleViewStatus = (user, statuses) => {
    alert(`Viewing ${user.name}'s status`);
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