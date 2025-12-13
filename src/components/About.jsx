import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, Lock, Eye, MessageCircle, Phone, Users, Heart, Trash2, FileText } from 'lucide-react';
import './about/About.css';

const About = () => {
  const navigate = useNavigate();

  return (
    <div className="about-container">
      <header className="about-header">
        <button className="back-btn" onClick={() => navigate('/')}>
          <ArrowLeft size={24} />
        </button>
        <h1>About CaBa</h1>
      </header>

      <div className="about-content">
        {/* Hero Section */}
        <div className="about-hero">
          <div className="app-logo-large">
            <span className="logo-text">CB</span>
          </div>
          <h2>CaBa Messaging App</h2>
          <p className="version">Version 1.0.0</p>
          <p className="tagline">Connect, Communicate, Care</p>
        </div>

        {/* Purpose Section */}
        <div className="about-section">
          <div className="section-icon">
            <Heart size={32} />
          </div>
          <h3>Our Purpose</h3>
          <p>
            CaBa is designed to bring people closer together through secure, private, and reliable communication.
            Whether you're chatting with friends, family, or colleagues, CaBa ensures your conversations remain
            private and your connections stay strong.
          </p>
          <div className="purpose-features">
            <div className="feature-item">
              <MessageCircle size={20} />
              <span>Instant Messaging</span>
            </div>
            <div className="feature-item">
              <Phone size={20} />
              <span>Voice & Video Calls</span>
            </div>
            <div className="feature-item">
              <Users size={20} />
              <span>Group Chats</span>
            </div>
            <div className="feature-item">
              <Shield size={20} />
              <span>End-to-End Encryption</span>
            </div>
          </div>
        </div>

        {/* Security Section */}
        <div className="about-section">
          <div className="section-icon">
            <Shield size={32} />
          </div>
          <h3>How We Keep Your Chats & Calls Safe</h3>
          <div className="security-grid">
            <div className="security-item">
              <Lock size={24} />
              <h4>End-to-End Encryption</h4>
              <p>
                All your messages, calls, and media are encrypted from the moment they leave your device
                until they reach the intended recipient. Only you and the person you're communicating with
                can read or listen to them.
              </p>
            </div>
            <div className="security-item">
              <Shield size={24} />
              <h4>Secure Servers</h4>
              <p>
                Our servers use industry-standard security protocols and are regularly audited for vulnerabilities.
                Your data is stored securely and never shared with third parties without your consent.
              </p>
            </div>
            <div className="security-item">
              <Eye size={24} />
              <h4>Privacy First</h4>
              <p>
                We don't track your location, read your messages, or analyze your behavior for advertising.
                Your privacy is our top priority, and we only collect the minimum data necessary to provide our service.
              </p>
            </div>
          </div>
        </div>

        {/* Privacy Section */}
        <div className="about-section">
          <div className="section-icon">
            <Eye size={32} />
          </div>
          <h3>Your Privacy Matters</h3>
          <div className="privacy-points">
            <div className="privacy-point">
              <div className="privacy-icon">
                <Lock size={20} />
              </div>
              <div>
                <h4>Data Encryption</h4>
                <p>Your messages are encrypted in transit and at rest using AES-256 encryption.</p>
              </div>
            </div>
            <div className="privacy-point">
              <div className="privacy-icon">
                <Shield size={20} />
              </div>
              <div>
                <h4>No Tracking</h4>
                <p>We don't track your location or monitor your online activity.</p>
              </div>
            </div>
            <div className="privacy-point">
              <div className="privacy-icon">
                <Eye size={20} />
              </div>
              <div>
                <h4>Device Control</h4>
                <p>You control who can contact you and what information is shared.</p>
              </div>
            </div>
            <div className="privacy-point">
              <div className="privacy-icon">
                <Trash2 size={20} />
              </div>
              <div>
                <h4>Data Deletion</h4>
                <p>You can delete your account and all associated data at any time.</p>
              </div>
            </div>
            <div className="privacy-point">
              <div className="privacy-icon">
                <Shield size={20} />
              </div>
              <div>
                <h4>Secure Authentication</h4>
                <p>Multi-factor authentication and secure login methods protect your account.</p>
              </div>
            </div>
            <div className="privacy-point">
              <div className="privacy-icon">
                <FileText size={20} />
              </div>
              <div>
                <h4>Minimal Data Collection</h4>
                <p>We only collect what's necessary: your name, phone number, and profile information.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Features Section */}
        <div className="about-section">
          <h3>Key Features</h3>
          <div className="features-grid">
            <div className="feature-card">
              <MessageCircle size={24} />
              <h4>Real-time Messaging</h4>
              <p>Send and receive messages instantly with read receipts and typing indicators.</p>
            </div>
            <div className="feature-card">
              <Phone size={24} />
              <h4>HD Voice & Video Calls</h4>
              <p>Crystal clear voice calls and high-definition video calls with screen sharing.</p>
            </div>
            <div className="feature-card">
              <Users size={24} />
              <h4>Group Conversations</h4>
              <p>Create groups for family, friends, or work with up to 1000 members.</p>
            </div>
            <div className="feature-card">
              <Shield size={24} />
              <h4>Advanced Security</h4>
              <p>Self-destructing messages, two-factor authentication, and biometric login.</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="about-footer">
          <p>Thank you for choosing CaBa for your communication needs.</p>
          <p className="copyright">© 2024 CaBa Messaging App. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
};

export default About;