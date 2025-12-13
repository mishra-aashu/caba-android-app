import React, { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabase';
import './Blocked.css';

const Blocked = ({ onBack }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unblockModal, setUnblockModal] = useState(null);

  useEffect(() => {
    initializeBlocked();
  }, []);

  const initializeBlocked = async () => {
    try {
      const userStr = localStorage.getItem('currentUser');
      if (!userStr) {
        alert('No user logged in');
        setLoading(false);
        return;
      }
      const user = JSON.parse(userStr);
      setCurrentUser(user);

      await loadBlockedUsers(user);
      setLoading(false);
    } catch (error) {
      console.error('Error initializing blocked:', error);
      setLoading(false);
    }
  };

  const loadBlockedUsers = async (user) => {
    try {
      const { data, error } = await supabase
        .from('blocked_users')
        .select(`
          id,
          blocked_id,
          created_at,
          users!blocked_users_blocked_id_fkey (
            id,
            name,
            phone,
            avatar,
            about
          )
        `)
        .eq('blocker_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBlockedUsers(data || []);
    } catch (error) {
      console.error('Error loading blocked users:', error);
      alert('Failed to load blocked users');
    }
  };

  const handleUnblock = (blockId, userName) => {
    setUnblockModal({ blockId, userName });
  };

  const confirmUnblock = async () => {
    if (!unblockModal) return;

    try {
      const { error } = await supabase
        .from('blocked_users')
        .delete()
        .eq('id', unblockModal.blockId);

      if (error) throw error;

      setUnblockModal(null);
      await loadBlockedUsers(currentUser);
      alert('User unblocked successfully');
    } catch (error) {
      console.error('Error unblocking user:', error);
      alert('Failed to unblock user');
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
    <div className="blocked-container">
      <header className="app-header">
        <div className="header-left">
          <button className="back-btn" onClick={onBack}>
            <i className="fas fa-arrow-left"></i>
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
              const user = block.users;
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

      {/* Unblock Modal */}
      {unblockModal && (
        <div className="modal" onClick={() => setUnblockModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Unblock User</h2>
              <button className="close-modal" onClick={() => setUnblockModal(null)}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to unblock <strong>{unblockModal.userName}</strong>?</p>
              <p className="modal-note">You will be able to receive messages and calls from this user again.</p>
              <div className="modal-actions">
                <button className="btn-secondary" onClick={() => setUnblockModal(null)}>
                  Cancel
                </button>
                <button className="btn-danger" onClick={confirmUnblock}>
                  Unblock
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Blocked;