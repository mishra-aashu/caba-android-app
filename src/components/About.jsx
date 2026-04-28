import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppVersions } from '../hooks/useAppVersions';
import { isOlderVersion } from '../utils/versionUtils';
import { ArrowLeft, Shield, Lock, Eye, MessageCircle, Phone, Users, Heart, Trash2, FileText } from 'lucide-react';
import AppName from './common/AppName';
import './about/About.css';

// App's current local version synced with package.json via Vite define
const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.11';

const About = () => {
  const navigate = useNavigate();
  const { data: dbVersionData } = useAppVersions();

  // Local version from package.json
  const localVersion = `v${APP_VERSION}`;

  const isUpdateAvailable = isOlderVersion(APP_VERSION, dbVersionData?.latest_version);

  useEffect(() => {
    console.log('[About] Local Version:', APP_VERSION);
    console.log('[About] DB Version:', dbVersionData?.latest_version);
    console.log('[About] Update Available:', isUpdateAvailable);
  }, [dbVersionData, isUpdateAvailable]);

  return (
    <div className="about-container">
      <header className="about-header">
        <button className="back-btn" onClick={() => navigate(-1)}>
          <ArrowLeft size={24} />
        </button>
        <h1>About <AppName size="small" /></h1>
      </header>

      <div className="about-content">
        {/* Hero Section */}
        <div className="about-hero">
          <AppName size="large" />
          <div className="version-badge-container">
            <p className="version">Version {localVersion}</p>
            {!isUpdateAvailable ? (
              <span className="version-status latest">Latest Updated</span>
            ) : (
              <span className="version-status update">Update Available</span>
            )}
          </div>
          <p className="tagline">Connect, Communicate, Care</p>
        </div>

        {/* Purpose Section */}
        <div className="about-section">
          <div className="section-icon">
            <Heart size={32} />
          </div>
          <h3>Our Purpose</h3>
          <p>
            Elevengram is designed to bring people closer together through secure, private, and reliable communication.
            Whether you're chatting with friends, family, or colleagues, Elevengram ensures your conversations remain
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

        {/* Developer Section */}
        <div className="about-section developer-section">
          <div className="section-icon">
            <Users size={32} />
          </div>
          <h3>The Visionary Behind Elevengram</h3>
          <p>
            I'm <strong>Aashutosh Mishra</strong>, an innovator and engineer at <strong>IIT Madras</strong>. 
            My journey began with a simple question: <em>How can we reclaim our digital sovereignty?</em> 
            Elevengram is the answer—a culmination of rigorous engineering and a deep-seated 
            belief that privacy is not a luxury, but a fundamental human right. 
            By merging cutting-edge cryptography with intuitive design, I've built more than 
            just a chat app—I've built a sanctuary for your conversations.
          </p>
          <div className="developer-badge">
            <Heart size={16} fill="#ff4b2b" color="#ff4b2b" />
            <span>Crafted with Passion</span>
          </div>
        </div>

        {/* Security Section */}
        <div className="about-section">
          <div className="section-icon">
            <Shield size={32} />
          </div>
          <h3>The "2E Integrated" Security Suite</h3>
          <p className="section-subtitle">
            We've spent months perfecting our security architecture. With the release of <strong>Version 3.5</strong>, 
            Elevengram now features official <strong>2E (End-to-End)</strong> integration, 
            providing unmatched privacy that even we cannot bypass.
          </p>
          <div className="security-grid">
            <div className="security-item">
              <Lock size={24} />
              <h4>AES-256 Military Grade</h4>
              <p>
                Every single message and media file is locked with a unique 256-bit key. 
                This is the same standard used by governments to protect top-secret data. 
                Encryption happens <strong>on your device</strong>, not on our servers.
              </p>
            </div>
            <div className="security-item">
              <Shield size={24} />
              <h4>SHA-256 Key Derivation</h4>
              <p>
                We use the SHA-256 hashing algorithm to derive unique, deterministic keys for every chat. 
                This ensures that your keys are never stored, never transmitted, and can only be unlocked by the participants.
              </p>
            </div>
            <div className="security-item">
              <Eye size={24} />
              <h4>Server-Blind Protection</h4>
              <p>
                Our Supabase servers are "blind" to your content. They only see encrypted strings (ciphertext). 
                Even if someone gained access to our database, they would only find gibberish.
                <strong> No one—not even the developers—can read your chats.</strong>
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

        <div className="about-footer">
          <p>Thank you for choosing Elevengram for your communication needs.</p>
          <p className="copyright">© 2026 Aashutosh Mishra | IIT Madras. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
};

export default About;