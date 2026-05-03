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
    <div className="about-container premium-theme">
      {/* Decorative Background Elements */}
      <div className="about-bg-blob blob-1"></div>
      <div className="about-bg-blob blob-2"></div>
      <div className="about-bg-blob blob-3"></div>

      <header className="about-header glass-header">
        <button className="back-btn-premium" onClick={() => navigate(-1)}>
          <ArrowLeft size={22} />
        </button>
        <h1>About <AppName size="small" /></h1>
      </header>

      <div className="about-content">
        {/* Hero Section */}
        <div className="about-hero-premium">
          <div className="hero-logo-wrapper">
            <AppName size="large" />
          </div>
          <div className="version-badge-container">
            <p className="version-text">Version {localVersion}</p>
            {!isUpdateAvailable ? (
              <span className="version-status-premium latest">Latest Updated</span>
            ) : (
              <span className="version-status-premium update">Update Available</span>
            )}
          </div>
          <p className="tagline-premium">Connect • Communicate • Care</p>
        </div>

        {/* Purpose Section */}
        <div className="about-section-premium animate-on-scroll">
          <div className="section-icon-premium">
            <div className="icon-pulse-wrapper">
              <Heart size={32} />
              <div className="pulse-ring"></div>
            </div>
          </div>
          <h3>Our Purpose</h3>
          <p className="purpose-description">
            Elevengram is designed to bring people closer together through secure, private, and reliable communication.
            Whether you're chatting with friends, family, or colleagues, Elevengram ensures your conversations remain
            private and your connections stay strong.
          </p>
          <div className="purpose-features-grid">
            <div className="feature-item-premium">
              <MessageCircle size={20} />
              <span>Instant Messaging</span>
            </div>
            <div className="feature-item-premium">
              <Phone size={20} />
              <span>Voice & Video Calls</span>
            </div>
            <div className="feature-item-premium">
              <Users size={20} />
              <span>Group Chats</span>
            </div>
            <div className="feature-item-premium">
              <Shield size={20} />
              <span>End-to-End Encryption</span>
            </div>
          </div>
        </div>

        {/* Developer Section */}
        <div className="about-section-premium visionary-section animate-on-scroll">
          <div className="visionary-badge">FOUNDER & ARCHITECT</div>
          <div className="section-icon-premium">
            <Users size={32} />
          </div>
          <h3>The Visionary Behind Elevengram</h3>
          <p>
            I'm <strong>Aashutosh Mishra</strong>, an innovator and engineer at <strong>IIT Madras</strong>. 
            My journey began with a simple question: <em>How can we reclaim our digital sovereignty?</em> 
            Elevengram is the answer—a culmination of rigorous engineering and a deep-seated 
            belief that privacy is not a luxury, but a fundamental human right.
          </p>
          <div className="developer-badge-premium">
            <Heart size={16} fill="#ff4b2b" color="#ff4b2b" />
            <span>Crafted with Passion at IIT Madras</span>
          </div>
        </div>

        {/* Security Suite */}
        <div className="about-section-premium security-suite animate-on-scroll">
          <div className="section-icon-premium">
            <Lock size={32} />
          </div>
          <h3>Integrated Security Suite</h3>
          <p className="section-subtitle-premium">
            Engineered with a <strong>Security-First</strong> mindset. Version 3.5 introduces 
            enhanced <strong>2E (End-to-End)</strong> protocols for absolute privacy.
          </p>
          <div className="security-grid-premium">
            <div className="security-card">
              <Shield size={24} className="card-icon" />
              <h4>AES-256 Protocol</h4>
              <p>Military-grade encryption for all media and messages, locked on-device.</p>
            </div>
            <div className="security-card">
              <Lock size={24} className="card-icon" />
              <h4>SHA-256 Derivation</h4>
              <p>Deterministic keys ensure your identity remains private and untraceable.</p>
            </div>
            <div className="security-card">
              <Eye size={24} className="card-icon" />
              <h4>Server-Blind</h4>
              <p>Our infrastructure is architected to be completely blind to your data.</p>
            </div>
          </div>
        </div>

        <div className="about-footer-premium">
          <div className="footer-divider"></div>
          <p>Thank you for choosing Elevengram</p>
          <p className="copyright-premium">© 2026 Aashutosh Mishra | IIT Madras</p>
        </div>
      </div>
    </div>
  );

};

export default About;