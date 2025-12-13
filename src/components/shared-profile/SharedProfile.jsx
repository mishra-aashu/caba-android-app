import React, { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabase';
import { dpOptions } from '../../utils/dpOptions';
import { X } from 'lucide-react';
import './SharedProfile.css';

const SharedProfile = ({ userId, onBack }) => {
  const [user, setUser] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initializeSharedProfile();
  }, [userId]);

  const initializeSharedProfile = async () => {
    try {
      // Check if user is logged in
      const userStr = localStorage.getItem('currentUser');
      if (userStr) {
        setCurrentUser(JSON.parse(userStr));
      }

      await loadSharedProfile(userId);
      setLoading(false);
    } catch (error) {
      console.error('Error initializing shared profile:', error);
      setLoading(false);
    }
  };

  const loadSharedProfile = async (id) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, phone, avatar, about, created_at')
        .eq('id', id)
        .single();

      if (error) throw error;
      setUser(data);
    } catch (error) {
      console.error('Error loading shared profile:', error);
      alert('Profile not found');
    }
  };

  const handleAddToContacts = () => {
    alert('Add to contacts - feature not implemented');
  };

  const handleChat = () => {
    alert('Start chat - feature not implemented');
  };

  const getInitials = (name) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (loading) {
    return (
      <div className="shared-profile-loading">
        <div className="loading-spinner"></div>
        <p>Loading profile...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="shared-profile-error">
        <p><X size={16} /> Profile not found</p>
        <button onClick={onBack}>Go Back</button>
      </div>
    );
  }

  return (
    <div className="shared-profile-container">
      <header className="app-header">
        <div className="header-left">
          <button className="back-btn" onClick={onBack}>
            <i className="fas fa-arrow-left"></i>
          </button>
        </div>
        <div className="header-center">
          <h1>Profile</h1>
        </div>
        <div className="header-right">
          {!currentUser && (
            <div className="auth-actions">
              <button className="btn-primary" onClick={() => alert('Login - feature not implemented')}>
                <i className="fas fa-sign-in-alt"></i> Login
              </button>
              <button className="btn-secondary" onClick={() => alert('Sign up - feature not implemented')}>
                <i className="fas fa-user-plus"></i> Sign Up
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Profile Content */}
      <div className="profile-content">
        {/* Profile Picture Section */}
        <div className="profile-picture-section">
          <div className="profile-avatar">
            {user.avatar ? (
              parseInt(user.avatar) ? (
                <img src={dpOptions.find(dp => dp.id === parseInt(user.avatar))?.path || user.avatar} alt={user.name} />
              ) : (
                <img src={user.avatar} alt={user.name} />
              )
            ) : (
              <div className="profile-initials">{getInitials(user.name)}</div>
            )}
          </div>
        </div>

        {/* Profile Info */}
        <div className="profile-info-section">
          {/* Name */}
          <div className="info-item">
            <div className="info-label">
              <i className="fas fa-user"></i>
              <span className="label">Name</span>
            </div>
            <div className="info-value">
              <span>{user.name}</span>
            </div>
          </div>

          {/* About */}
          <div className="info-item">
            <div className="info-label">
              <i className="fas fa-info-circle"></i>
              <span className="label">About</span>
            </div>
            <div className="info-value">
              <span>{user.about || 'Hey there! I am using CaBa'}</span>
            </div>
          </div>

          {/* Phone */}
          <div className="info-item">
            <div className="info-label">
              <i className="fas fa-phone"></i>
              <span className="label">Phone</span>
            </div>
            <div className="info-value">
              <span>{user.phone || 'Not provided'}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons (shown only when authenticated) */}
        {currentUser && (
          <div className="profile-actions">
            <button className="action-btn" onClick={handleAddToContacts}>
              <i className="fas fa-user-plus"></i>
              <span className="label">Add to Contacts</span>
            </button>
            <button className="action-btn" onClick={handleChat}>
              <i className="fas fa-comment"></i>
              <span className="label">Chat</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SharedProfile;