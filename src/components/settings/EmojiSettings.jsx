import React, { useState, useEffect } from 'react';
import { ArrowLeft, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import { useEmojiStyle } from '../../contexts/EmojiStyleContext';
import toast from 'react-hot-toast';
import '../../styles/settings.css';

import EmojiRenderer from '../common/EmojiRenderer';

// Preview emojis for demonstration
const PREVIEW_EMOJIS = ["😍", "🎉", "❤️", "🚀"];

// Emoji Preview Row Component
const EmojiPreviewRow = ({ styleName, styleKey, isSelected, onSelect }) => {
  return (
    <div
      className={`preview-card ${isSelected ? 'selected' : ''}`}
      onClick={() => onSelect(styleKey)}
    >
      <div className="preview-header">
        <span className="style-name">{styleName}</span>
        {isSelected && <span className="check-icon">✓</span>}
      </div>

      <div className="preview-icons-row">
        {PREVIEW_EMOJIS.map((emoji) => (
          <div key={emoji} className="emoji-wrapper">
            <EmojiRenderer
              text={emoji}
              styleOverride={styleKey}
              className={styleKey === 'native' ? 'native-emoji' : 'custom-emoji-img'}
            />
          </div>
        ))}
      </div>

      <p className="style-desc">
        {styleKey === 'native' ? "Uses your device's default emojis" : `Open-source ${styleName} style`}
      </p>
    </div>
  );
};

const EmojiSettings = ({ isSidebar = false }) => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { emojiStyle, updateEmojiStyle, loading } = useEmojiStyle();

  // Handle style selection
  const handleStyleChange = async (newStyle) => {
    const success = await updateEmojiStyle(newStyle);
    if (success) {
      toast.success('Emoji style updated!');
    } else {
      toast.error('Failed to save emoji preference');
    }
  };

  if (loading) {
    return (
      <div className={`settings-screen ${isSidebar ? 'is-sidebar' : ''}`}>
        <div className="loading">Loading emoji settings...</div>
      </div>
    );
  }

  return (
    <div className={`settings-screen ${isSidebar ? 'is-sidebar' : ''}`}>
      {/* Header */}
      <header className="settings-header">
        <button className="back-btn" onClick={() => navigate('/settings')}>
          <ArrowLeft size={20} />
        </button>
        <h1>Emoji Style</h1>
      </header>

      {/* Content */}
      <div className="settings-content">
        <div className="emoji-settings-container">
          {/* Description */}
          <div className="emoji-info-section">
            <h2 className="section-title">🎨 Choose Emoji Style</h2>
            <p className="emoji-description">
              Select how emojis appear in your chats. This affects both the emoji picker and how emojis are displayed in messages. Our app now uses offline-first emoji assets for better performance.
            </p>
          </div>

          {/* Style Selector */}
          <div className="options-list">

            {/* 1. Apple */}
            <EmojiPreviewRow
              styleName="Apple"
              styleKey="apple"
              isSelected={emojiStyle === 'apple'}
              onSelect={handleStyleChange}
            />

            {/* 2. Google */}
            <EmojiPreviewRow
              styleName="Google"
              styleKey="google"
              isSelected={emojiStyle === 'google'}
              onSelect={handleStyleChange}
            />

            {/* 3. Twitter */}
            <EmojiPreviewRow
              styleName="Twitter"
              styleKey="twitter"
              isSelected={emojiStyle === 'twitter'}
              onSelect={handleStyleChange}
            />

            {/* 4. Facebook */}
            <EmojiPreviewRow
              styleName="Facebook"
              styleKey="facebook"
              isSelected={emojiStyle === 'facebook'}
              onSelect={handleStyleChange}
            />

            {/* 5. System Default */}
            <EmojiPreviewRow
              styleName="System Default"
              styleKey="native"
              isSelected={emojiStyle === 'native'}
              onSelect={handleStyleChange}
            />

          </div>

          {/* Note */}
          <div className="emoji-note">
            <div className="note-icon">
              <Info size={18} />
            </div>
            <div className="note-content">
              <h4>Note:</h4>
              <p>
                System Default uses your device's built-in emojis. Apple, Google, Twitter, and Facebook styles use high-quality, offline WebP assets for a consistent experience even without internet.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmojiSettings;