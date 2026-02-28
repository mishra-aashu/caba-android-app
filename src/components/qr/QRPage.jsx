import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useSupabase } from '../../contexts/SupabaseContext';
import { useQueryClient } from '@tanstack/react-query';
import { UserQRCode, QRScanner } from './index';
import { useDialog } from '../../contexts/DialogContext';
import BottomNavigation from '../common/BottomNavigation';
import './QRPage.css';

const QRPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { supabase } = useSupabase();
  const queryClient = useQueryClient();
  const { showAlert } = useDialog();
  const [showGenerator, setShowGenerator] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scannedUser, setScannedUser] = useState(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleScan = async (scannedData) => {
    setShowScanner(false);

    if (scannedData.type === 'url') {
      // Handle URL QR codes
      window.open(scannedData.url, '_blank');
    } else if (scannedData.id && scannedData.type === 'caba-user') {
      // Handle user data QR codes - fetch latest data from database
      setLoading(true);
      try {
        const { data: userData, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', scannedData.id)
          .single();

        if (error) throw error;

        if (userData) {
          setScannedUser(userData);
          setShowUserModal(true);
        } else {
          showAlert('User not found');
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        showAlert('Failed to load user information');
      } finally {
        setLoading(false);
      }
    } else {
      alert('Invalid QR code format');
    }
  };

  const addToContacts = async () => {
    if (!scannedUser || !user) return;

    setLoading(true);
    try {
      // Check if already in contacts
      const { data: existing, error: checkError } = await supabase
        .from('contacts')
        .select('id')
        .eq('user_id', user.id)
        .eq('contact_user_id', scannedUser.id)
        .single();

      if (existing) {
        showAlert('User already in contacts');
        return;
      }

      // Add to contacts
      const { data, error } = await supabase
        .from('contacts')
        .insert([{
          user_id: user.id,
          contact_user_id: scannedUser.id,
          contact_name: scannedUser.name
        }])
        .select();

      if (error) throw error;

      showAlert(`${scannedUser.name} added to contacts!`);
      queryClient.invalidateQueries({ queryKey: ['contacts', user.id] });
      setShowUserModal(false);
      setScannedUser(null);
    } catch (error) {
      console.error('Error adding to contacts:', error);
      showAlert('Failed to add contact');
    } finally {
      setLoading(false);
    }
  };

  const startChat = async () => {
    if (!scannedUser || !user) return;

    setLoading(true);
    try {
      // Check if chat already exists
      const { data: existingChat, error: chatError } = await supabase
        .from('chats')
        .select('id')
        .or(`and(user1_id.eq.${user.id},user2_id.eq.${scannedUser.id}),and(user1_id.eq.${scannedUser.id},user2_id.eq.${user.id})`)
        .single();

      if (existingChat) {
        queryClient.invalidateQueries({ queryKey: ['chats', user.id] });
        navigate(`/chat/${existingChat.id}/${scannedUser.id}`);
      } else {
        // Create new chat
        const { data: newChat, error: newChatError } = await supabase
          .from('chats')
          .insert([{ user1_id: user.id, user2_id: scannedUser.id }])
          .select()
          .single();

        if (newChatError) throw newChatError;

        queryClient.invalidateQueries({ queryKey: ['chats', user.id] });
        navigate(`/chat/${newChat.id}/${scannedUser.id}`);
      }

      setShowUserModal(false);
      setScannedUser(null);
    } catch (error) {
      console.error('Error starting chat:', error);
      showAlert('Failed to start chat');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="qr-page">
        <div className="qr-page-header">
          <button className="back-btn" onClick={() => navigate('/')}>
            <i className="fas fa-arrow-left"></i>
          </button>
          <h1>QR Code</h1>
        </div>
        <div className="qr-page-content">
          <p>Please log in to use QR code features</p>
        </div>
      </div>
    );
  }

  // Debug: Log user object to console
  console.log('QR Page - User object:', user);

  // Ensure user has required properties with fallbacks
  const userData = {
    id: user.id || '',
    name: user.name || user.user_metadata?.full_name || user.user_metadata?.name || 'User',
    phone: user.phone || user.user_metadata?.phone || '',
    email: user.email || ''
  };

  return (
    <div className="qr-page">
      <div className="qr-page-header">
        <button className="back-btn" onClick={() => navigate('/')}>
          <i className="fas fa-arrow-left"></i>
        </button>
        <h1>QR Code</h1>
      </div>

      <div className="qr-page-content">
        <div className="qr-options">
          <div className="qr-option-card" onClick={() => setShowGenerator(true)}>
            <div className="qr-option-icon">
              <i className="fas fa-qrcode"></i>
            </div>
            <h3>My QR Code</h3>
            <p>Generate and share your profile QR code</p>
          </div>

          <div className="qr-option-card" onClick={() => setShowScanner(true)}>
            <div className="qr-option-icon">
              <i className="fas fa-camera"></i>
            </div>
            <h3>Scan QR Code</h3>
            <p>Scan QR codes to add contacts or visit links</p>
          </div>
        </div>

        <div className="qr-info-section">
          <h3>How QR Codes Work</h3>
          <div className="qr-info-grid">
            <div className="info-item">
              <i className="fas fa-user-plus"></i>
              <h4>Add Contacts</h4>
              <p>Scan someone's QR code to instantly add them to your contacts</p>
            </div>
            <div className="info-item">
              <i className="fas fa-share"></i>
              <h4>Share Profile</h4>
              <p>Share your QR code so others can view your profile and start chatting</p>
            </div>
            <div className="info-item">
              <i className="fas fa-mobile-alt"></i>
              <h4>Cross-Platform</h4>
              <p>Works across all devices and platforms</p>
            </div>
            <div className="info-item">
              <i className="fas fa-shield-alt"></i>
              <h4>Secure</h4>
              <p>End-to-end encrypted and secure</p>
            </div>
          </div>
        </div>
      </div>

      {/* QR Code Generator Modal */}
      {showGenerator && user && (
        <div className="modal-overlay" onClick={() => setShowGenerator(false)}>
          <div className="modal-content qr-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>My QR Code</h2>
              <button className="close-btn" onClick={() => setShowGenerator(false)}>&times;</button>
            </div>
            <div className="modal-body centered" style={{ padding: '20px' }}>
              <UserQRCode
                userId={user.id}
                publicKey={user.public_key || 'not-generated-yet'}
                userName={user.name || user.user_metadata?.name || 'User'}
              />
            </div>
          </div>
        </div>
      )}

      {/* QR Code Scanner Modal */}
      {showScanner && (
        <QRScanner
          onClose={() => setShowScanner(false)}
        />
      )}

      {/* Scanned User Modal */}
      {showUserModal && scannedUser && (
        <div className="modal" style={{ display: 'flex' }}>
          <div className="modal-content">
            <div className="modal-header">
              <h2>User Found</h2>
              <button className="close-modal" onClick={() => {
                setShowUserModal(false);
                setScannedUser(null);
              }}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body" style={{ textAlign: 'center' }}>
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '15px' }}>
                  <div style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    background: 'var(--primary-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: '15px',
                    color: 'white',
                    fontSize: '24px'
                  }}>
                    {scannedUser.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <h3 style={{ margin: '0', color: 'var(--text-primary)' }}>{scannedUser.name}</h3>
                    <p style={{ margin: '5px 0', color: 'var(--text-secondary)' }}>{scannedUser.phone}</p>
                    {scannedUser.about && <p style={{ margin: '0', color: 'var(--text-secondary)', fontSize: '14px' }}>{scannedUser.about}</p>}
                  </div>
                </div>
              </div>
              <div className="action-buttons" style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                <button className="btn-primary" onClick={addToContacts} disabled={loading}>
                  <i className="fas fa-user-plus"></i>
                  {loading ? 'Adding...' : 'Add to Contacts'}
                </button>
                <button className="btn-secondary" onClick={startChat} disabled={loading}>
                  <i className="fas fa-comments"></i>
                  {loading ? 'Starting...' : 'Start Chat'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
};

export default QRPage;