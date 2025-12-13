import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { QRCodeGenerator, QRCodeScanner } from './index';
import BottomNavigation from '../common/BottomNavigation';
import './QRPage.css';

const QRPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showGenerator, setShowGenerator] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scannedUser, setScannedUser] = useState(null);
  const [showUserModal, setShowUserModal] = useState(false);

  const handleScan = (scannedData) => {
    setShowScanner(false);

    try {
      const userData = JSON.parse(scannedData);
      if (userData.id && userData.name) {
        setScannedUser(userData);
        setShowUserModal(true);
      } else if (userData.url) {
        // Handle URL QR codes
        window.open(userData.url, '_blank');
      }
    } catch (error) {
      // Handle plain URL QR codes
      if (scannedData.startsWith('http')) {
        window.open(scannedData, '_blank');
      } else {
        alert('Invalid QR code format');
      }
    }
  };

  const addToContacts = () => {
    if (!scannedUser) return;

    let contacts = JSON.parse(localStorage.getItem('CaBa_contacts') || '[]');

    if (!contacts.some(c => c.id === scannedUser.id)) {
      contacts.push({
        id: scannedUser.id,
        name: scannedUser.name,
        phone: scannedUser.phone,
        about: scannedUser.about,
        addedAt: new Date().toISOString()
      });
      localStorage.setItem('CaBa_contacts', JSON.stringify(contacts));
      alert(`${scannedUser.name} added to contacts!`);
    } else {
      alert('User already in contacts');
    }

    setShowUserModal(false);
    setScannedUser(null);
  };

  const startChat = () => {
    if (!scannedUser) return;

    // Navigate to chat with the scanned user
    navigate(`/chat/new/${scannedUser.id}`);
    setShowUserModal(false);
    setScannedUser(null);
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
        <QRCodeGenerator
          userId={userData.id}
          userName={userData.name}
          userPhone={userData.phone}
          onClose={() => setShowGenerator(false)}
        />
      )}

      {/* QR Code Scanner Modal */}
      {showScanner && (
        <QRCodeScanner
          onScan={handleScan}
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
                <button className="btn-primary" onClick={addToContacts}>
                  <i className="fas fa-user-plus"></i>
                  Add to Contacts
                </button>
                <button className="btn-secondary" onClick={startChat}>
                  <i className="fas fa-comments"></i>
                  Start Chat
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