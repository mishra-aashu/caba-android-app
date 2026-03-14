import React, { useState, useEffect } from 'react';
import { useSupabase } from '../../contexts/SupabaseContext';
import useAuthStore from '../../store/authStore';
import { ArrowLeft } from 'lucide-react';
import { useDialog } from '../../contexts/DialogContext';
import './Blocked.css';

const Blocked = ({ onBack, isSidebar = false }) => {
  const navigate = useNavigate();
  const { supabase } = useSupabase();
  const currentUser = useAuthStore((state) => state.dbUser);
  const { showAlert, showConfirm } = useDialog();
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentUser) {
      loadBlockedUsers(currentUser).then(() => setLoading(false));
    }
  }, [currentUser]);

  const loadBlockedUsers = async (user) => {
    try {
      const { data, error } = await supabase
        .from('blocked_users')
        .select(`
          *,
          blocked_user:users!blocked_users_blocked_id_fkey(
            id,
            name,
            avatar,
            is_online,
            last_seen
          )
        `)
        .eq('blocker_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBlockedUsers(data || []);
    } catch (error) {
      console.error('Error loading blocked users:', error);
      showAlert('Failed to load blocked users');
    }
  };

  const handleUnblock = async (blockId, userName) => {
    const confirmed = await showConfirm(`Are you sure you want to unblock ${userName}?`, 'Unblock User');
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('blocked_users')
        .delete()
        .eq('id', blockId);

      if (error) throw error;

      await loadBlockedUsers(currentUser);
      showAlert('User unblocked successfully');
    } catch (error) {
      console.error('Error unblocking user:', error);
      showAlert('Failed to unblock user');
    }
  };

  const getInitials = (name) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (loading) {
    return (
      <div className="blocked-loading">
        <div className="loading-spinner"></div>
        <p>Loading blocked users...</p>
      </div>
    );
  }

  return (
    <div className={`blocked-container ${isSidebar ? 'is-sidebar' : ''}`}>
      <header className="app-header">
        <div className="header-left">
          <button className="back-btn" onClick={isSidebar ? () => navigate('/settings') : onBack}>
            <ArrowLeft size={20} />
          </button>
        </div>
        <div className="header-center">
          <h1>Blocked Users</h1>
        </div>
        <div className="header-right">
          {/* Empty for balance */}
        </div>
      </header>

      <div className="blocked-content">
        {blockedUsers.length > 0 ? (
          <div className="blocked-users-list">
            {blockedUsers.map(block => {
              const user = block.blocked_user;
              if (!user) return null;

              return (
                <div key={block.id} className="blocked-user-item">
                  <div className="blocked-user-avatar">
                    {user.avatar ? (
                      <img src={user.avatar} alt={user.name} />
                    ) : (
                      getInitials(user.name)
                    )}
                  </div>
                  <div className="blocked-user-info">
                    <div className="blocked-user-name">{user.name}</div>
                    <div className="blocked-user-phone">{user.phone}</div>
                  </div>
                  <div className="blocked-user-actions">
                    <button
                      className="unblock-btn"
                      onClick={() => handleUnblock(block.id, user.name)}
                    >
                      Unblock
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">🚫</div>
            <h3>No blocked users</h3>
            <p>You haven't blocked any users yet.</p>
          </div>
        )}
      </div>

      {/* Modal removed in favor of GlobalDialog */}
    </div>
  );
};

export default Blocked;