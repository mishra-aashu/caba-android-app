import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import { useEmojiStyle } from '../../contexts/EmojiStyleContext';
import toast from 'react-hot-toast';
import '../../styles/settings.css';

// Helper function to convert emoji to hex code
const toHex = (emoji) => {
  return emoji.codePointAt(0).toString(16);
};

// Preview emojis for demonstration
const PREVIEW_EMOJIS = ["😍", "🎉", "❤️", "🚀"];

// Emoji Preview Row Component
const EmojiPreviewRow = ({ styleName, styleKey, isSelected, onSelect }) => {

  // Image Source Generators
  const getImageUrl = (emoji, type) => {
    const hex = toHex(emoji);

    if (type === 'twitter') {
      // Twitter (Twemoji) CDN
      return `https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/${hex}.png`;
    }
    else if (type === 'google') {
      // Google (Noto) CDN
      return `https://fonts.gstatic.com/s/e/notoemoji/latest/${hex}/512.png`;
    }
    return null;
  };

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
        {PREVIEW_EMOJIS.map((emoji, index) => (
          <div key={index} className="emoji-wrapper">

            {/* Logic: Agar 'native' hai to Text, warna Image */}
            {styleKey === 'native' ? (
              <span className="native-emoji">{emoji}</span>
            ) : (
              <img
                src={getImageUrl(emoji, styleKey)}
                alt={emoji}
                className="custom-emoji-img"
                onError={(e) => {
                   e.target.style.display='none'; // Agar load na ho to chup jaye
                   e.target.nextSibling.style.display='block'; // Fallback text dikhaye
                }}
              />
            )}

            {/* Fallback for safety (Hidden by default) */}
            <span className="fallback-emoji" style={{display: 'none'}}>{emoji}</span>

          </div>
        ))}
      </div>

      <p className="style-desc">
        {styleKey === 'native' ? "Uses your device's default emojis" : `Open-source ${styleName} style`}
      </p>
    </div>
  );
};

const EmojiSettings = () => {
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
      <div className="settings-screen">
        <div className="loading">Loading emoji settings...</div>
      </div>
    );
  }

  return (
    <div className="settings-screen">
      {/* Header */}
      <header className="settings-header">
        <button className="back-btn" onClick={() => navigate(-1)}>
          <i className="fas fa-arrow-left"></i>
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
              Select how emojis appear in your chats. This affects both the emoji picker and how emojis are displayed in messages.
            </p>
          </div>

          {/* Style Selector */}
          <div className="options-list">

            {/* 1. System Default */}
            <EmojiPreviewRow
              styleName="System Default"
              styleKey="native"
              isSelected={emojiStyle === 'native'}
              onSelect={handleStyleChange}
            />

            {/* 2. Twitter */}
            <EmojiPreviewRow
              styleName="Twitter (Twemoji)"
              styleKey="twitter"
              isSelected={emojiStyle === 'twitter'}
              onSelect={handleStyleChange}
            />

            {/* 3. Google */}
            <EmojiPreviewRow
              styleName="Google (Noto)"
              styleKey="google"
              isSelected={emojiStyle === 'google'}
              onSelect={handleStyleChange}
            />

          </div>



          {/* Note */}
          <div className="emoji-note">
            <div className="note-icon">
              <i className="fas fa-info-circle"></i>
            </div>
            <div className="note-content">
              <h4>Note:</h4>
              <p>
                System Default uses your device's built-in emojis. Twitter and Google styles render emojis as images in chat messages for consistent appearance across devices.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmojiSettings;