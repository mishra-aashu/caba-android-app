import React, { useState, useEffect } from 'react';
import { useSupabase } from '../../contexts/SupabaseContext';
import { useAuth } from '../../hooks/useAuth';
import { QRCodeGenerator, QRCodeScanner } from '../qr';
import { dpOptions } from '../../utils/dpOptions';
import '../../styles/profile.css';
import '../qr/QRCodeGenerator.css';
import '../qr/QRCodeScanner.css';
import FullscreenImageModal from './FullscreenImageModal';

const Profile = () => {
  const { supabase } = useSupabase();
  const { user: authUser, loading: authLoading } = useAuth();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ chats: 0, calls: 0, contacts: 0 });
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDpModal, setShowDpModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showScanQrModal, setShowScanQrModal] = useState(false);
  const [showUserFoundModal, setShowUserFoundModal] = useState(false);
  const [foundUser, setFoundUser] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', about: '', email: '' });
  const [showFullscreenImage, setShowFullscreenImage] = useState(false);
  const [fullscreenImageUrl, setFullscreenImageUrl] = useState('');

  useEffect(() => {
    if (!authLoading) {
      loadProfileData();
    }
  }, [authUser, authLoading]);

  const loadProfileData = async () => {
    try {
      if (!authUser) return;

      const cachedProfile = localStorage.getItem(`digidad_profile_${authUser.id}`);
      if (cachedProfile) {
        const profile = JSON.parse(cachedProfile);
        setUser(profile);
        loadProfileStats();
      }

      const { data: userProfile, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single();

      let currentUser;
      if (error && error.code === 'PGRST116') {
        const { data: newProfile, error: createError } = await supabase
          .from('users')
          .insert([{
            id: authUser.id,
            name: authUser.name || 'User',
            phone: authUser.phone || '',
            email: authUser.email,
            avatar: authUser.avatar || null,
            about: 'Hey there! I am using CaBa',
            is_online: false,
            last_seen: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }])
          .select()
          .single();

        if (createError) throw createError;
        currentUser = newProfile;
      } else if (error) {
        throw error;
      } else {
        currentUser = userProfile;
      }

      localStorage.setItem(`digidad_profile_${authUser.id}`, JSON.stringify(currentUser));
      setUser(currentUser);
      loadProfileStats();

    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProfileStats = () => {
    const contacts = JSON.parse(localStorage.getItem('CaBa_contacts') || '[]');
    setStats({
      chats: contacts.length || 0,
      calls: 0,
      contacts: contacts.length || 0
    });
  };

  const getInitials = (name) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleEditProfile = () => {
    setEditForm({
      name: user.name,
      about: user.about || '',
      email: user.email || ''
    });
    setShowEditModal(true);
  };

  const saveProfileChanges = async () => {
    try {
      const { name, about, email } = editForm;

      if (name.length < 3) {
        alert('Name must be at least 3 characters');
        return;
      }

      const { error } = await supabase
        .from('users')
        .update({ name, about, email: email || null })
        .eq('id', authUser.id);

      if (error) throw error;

      const updatedUser = { ...user, name, about, email };
      setUser(updatedUser);
      localStorage.setItem(`digidad_profile_${authUser.id}`, JSON.stringify(updatedUser));
      localStorage.setItem('currentUser', JSON.stringify(updatedUser));

      setShowEditModal(false);
      alert('Profile updated successfully');

    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile');
    }
  };

  const selectDp = async (dpId) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ avatar: dpId.toString() })
        .eq('id', authUser.id);

      if (error) throw error;

      const updatedUser = { ...user, avatar: dpId.toString() };
      setUser(updatedUser);
      localStorage.setItem(`digidad_profile_${authUser.id}`, JSON.stringify(updatedUser));
      localStorage.setItem('currentUser', JSON.stringify(updatedUser));

      setShowDpModal(false);
      alert('Profile picture updated');

    } catch (error) {
      console.error('Error selecting DP:', error);
      alert('Failed to update profile picture');
    }
  };

  const handleQrScan = (scannedData) => {
    setShowScanQrModal(false);
    
    try {
      const userData = JSON.parse(scannedData);
      if (userData.id && userData.name) {
        setFoundUser(userData);
        setShowUserFoundModal(true);
      }
    } catch (error) {
      alert('Invalid QR code format');
    }
  };

  const addToContacts = () => {
    let contacts = JSON.parse(localStorage.getItem('CaBa_contacts') || '[]');
    if (!contacts.some(c => c.id === foundUser.id)) {
      contacts.push({
        id: foundUser.id,
        name: foundUser.name,
        phone: foundUser.phone,
        about: foundUser.about,
        addedAt: new Date().toISOString()
      });
      localStorage.setItem('CaBa_contacts', JSON.stringify(contacts));
      alert(`${foundUser.name} added to contacts`);
      loadProfileStats();
    } else {
      alert('User already in contacts');
    }
    setShowUserFoundModal(false);
  };

  if (loading) {
    return (
      <div className="profile-screen">
        <div className="profile-loading-message">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="profile-screen">
        <div className="profile-no-user-message">Please log in to view profile</div>
      </div>
    );
  }

  return (
    <div className="profile-screen">
      <header className="profile-header">
        <button className="back-btn" onClick={() => window.history.back()}>
          <span className="icon">←</span>
        </button>
        <h1>Profile</h1>
        <button className="icon-btn" onClick={handleEditProfile}>
          <i className="fas fa-edit"></i>
        </button>
      </header>

      <div className="profile-content">
        <div className="profile-picture-section">
          <div className="profile-avatar" onClick={() => {
            if (user.avatar) {
              setFullscreenImageUrl(parseInt(user.avatar) ? dpOptions.find(dp => dp.id === parseInt(user.avatar))?.path : user.avatar);
              setShowFullscreenImage(true);
            }
          }}>
            {user.avatar ? (
              <img
                src={parseInt(user.avatar) ?
                  dpOptions.find(dp => dp.id === parseInt(user.avatar))?.path :
                  user.avatar}
                alt="Profile Picture"
              />
            ) : (
              <div className="profile-initials">{getInitials(user.name)}</div>
            )}
          </div>
          <button className="edit-dp-btn" onClick={() => setShowDpModal(true)}>
            <i className="fas fa-camera"></i>
          </button>
        </div>
        {showFullscreenImage && (
        <FullscreenImageModal
          src={fullscreenImageUrl}
          onClose={() => setShowFullscreenImage(false)}
        />
      )}



        <div className="profile-info-section">
          <div className="info-item">
            <div className="info-label">
              <i className="fas fa-user"></i>
              <span className="label">Name</span>
            </div>
            <div className="info-value">
              <span>{user.name}</span>
            </div>
          </div>

          <div className="info-item">
            <div className="info-label">
              <i className="fas fa-info-circle"></i>
              <span className="label">About</span>
            </div>
            <div className="info-value">
              <span>{user.about || 'Hey there! I am using CaBa'}</span>
            </div>
          </div>

          <div className="info-item">
            <div className="info-label">
              <i className="fas fa-phone"></i>
              <span className="label">Phone</span>
            </div>
            <div className="info-value">
              <span>{user.phone}</span>
            </div>
          </div>

          <div className="info-item">
            <div className="info-label">
              <i className="fas fa-envelope"></i>
              <span className="label">Email</span>
            </div>
            <div className="info-value">
              <span>{user.email || 'Not set'}</span>
            </div>
          </div>
        </div>

        <div className="profile-stats">
          <div className="stat-item">
            <h3>{stats.chats}</h3>
            <p>Chats</p>
          </div>
          <div className="stat-item">
            <h3>{stats.calls}</h3>
            <p>Calls</p>
          </div>
          <div className="stat-item">
            <h3>{stats.contacts}</h3>
            <p>Contacts</p>
          </div>
        </div>

        <div className="profile-actions">
          <button className="action-btn" onClick={() => setShowQrModal(true)}>
            <i className="fas fa-qrcode"></i>
            <span className="label">My QR Code</span>
          </button>
          <button className="action-btn" onClick={() => setShowScanQrModal(true)}>
            <i className="fas fa-camera"></i>
            <span className="label">Scan QR Code</span>
          </button>
        </div>
      </div>

      {/* Edit Profile Modal */}
      {showEditModal && (
        <div className="modal">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Edit Profile</h2>
              <button className="close-modal" onClick={() => setShowEditModal(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body">
              <form onSubmit={(e) => { e.preventDefault(); saveProfileChanges(); }}>
                <div className="input-group">
                  <label htmlFor="editName">Full Name</label>
                  <input
                    type="text"
                    id="editName"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    required
                    minLength="3"
                  />
                </div>
                <div className="input-group">
                  <label htmlFor="editAbout">About</label>
                  <textarea
                    id="editAbout"
                    rows="3"
                    maxLength="150"
                    value={editForm.about}
                    onChange={(e) => setEditForm({ ...editForm, about: e.target.value })}
                  />
                </div>
                <div className="input-group">
                  <label htmlFor="editEmail">Email</label>
                  <input
                    type="email"
                    id="editEmail"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  />
                </div>
                <button type="submit" className="btn-primary">Save Changes</button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Choose DP Modal */}
      {showDpModal && (
        <div className="modal">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Choose Profile Picture</h2>
              <button className="close-modal" onClick={() => setShowDpModal(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body">
              <div className="dp-options-grid">
                {dpOptions.map(option => (
                  <img
                    key={option.id}
                    src={option.path}
                    alt={`DP ${option.id}`}

                    onClick={() => selectDp(option.id)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQrModal && user && (
        <QRCodeGenerator
          userId={user.id}
          userName={user.name}
          userPhone={user.phone}
          onClose={() => setShowQrModal(false)}
        />
      )}

      {/* Scan QR Modal */}
      {showScanQrModal && (
        <QRCodeScanner
          onScan={handleQrScan}
          onClose={() => setShowScanQrModal(false)}
        />
      )}

      {/* User Found Modal */}
      {showUserFoundModal && foundUser && (
        <div className="modal">
          <div className="modal-content">
            <div className="modal-header">
              <h2>User Found</h2>
              <button className="close-modal" onClick={() => setShowUserFoundModal(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="user-found-body-content">
              <div className="user-found-info-container">
                <div className="user-found-details-row">
                  <div className="avatar-circle-small">
                    {getInitials(foundUser.name)}
                  </div>
                  <div className="user-found-info">
                    <h3>{foundUser.name}</h3>
                    <p>{foundUser.phone}</p>
                        <p>{foundUser.about}</p>
                  </div>
                </div>
              </div>
              <div className="action-buttons">
                <button className="btn-primary" onClick={addToContacts}>
                  <i className="fas fa-user-plus"></i>
                  Add to Contacts
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;
