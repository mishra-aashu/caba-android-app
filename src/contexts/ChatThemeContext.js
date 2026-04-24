import { createContext, useContext } from 'react';

// ✨ Polished & Premium Chat Themes
// ⚠️ STYLES ARE NOW DEFINED IN enhanced-themes.css using [data-chat-theme]
export const chatThemes = {
    'emerald-default': {
        name: 'Emerald (Default)',
        category: 'Professional',
        is_pattern: true,
        cssOnly: true
    },
    'classic-purple': {
        name: 'Classic Purple',
        category: 'Default',
        is_pattern: true,
        cssOnly: true
    },
    'midnight-amoled': {
        name: 'Midnight AMOLED',
        category: 'Dark',
        cssOnly: true
    },
    'electric-dreams': {
        name: 'Electric Dreams',
        category: 'Futuristic',
        cssOnly: true
    },
    'ocean-depths': {
        name: 'Ocean Depths',
        category: 'Nature',
        cssOnly: true
    },
    'sunset-glow': {
        name: 'Sunset Glow',
        category: 'Colorful',
        cssOnly: true
    },
    'forest-mist': {
        name: 'Forest Mist',
        category: 'Nature',
        cssOnly: true
    },
    'cyberpunk-neon': {
        name: 'Cyberpunk Neon',
        category: 'Dark',
        cssOnly: true
    },
    'telegram-blue': {
        name: 'Telegram Blue',
        category: 'Professional',
        cssOnly: true
    },
    'rose-gold': {
        name: 'Rose Gold',
        category: 'Elegant',
        cssOnly: true
    },
    'minimal-slate': {
        name: 'Minimal Slate',
        category: 'Professional',
        cssOnly: true
    },
    'spring-vibes': {
        name: 'Spring Vibes',
        category: 'Seasonal',
        is_pattern: true,
        cssOnly: true
    },
    'winter-calm': {
        name: 'Winter Calm',
        category: 'Seasonal',
        is_pattern: true,
        cssOnly: true
    },
    'cherry-blossom': {
        name: 'Cherry Blossom',
        category: 'Seasonal',
        is_pattern: true,
        cssOnly: true
    },
    'desert-dunes': {
        name: 'Desert Dunes',
        category: 'Nature',
        is_pattern: true,
        cssOnly: true
    },
    'pattern-overlay': {
        name: 'Pattern Overlay',
        category: 'Premium',
        is_pattern: true,
        cssOnly: true
    }
};

export const chatPatterns = [
    { id: 'pattern', name: 'Original WhatsApp' },
    { id: 'pattern-1', name: 'Doodle Mix' },
    { id: 'pattern-3', name: 'Botanical' },
    { id: 'pattern-19', name: 'Micro Dots' },
    { id: 'pattern-22', name: 'Circuit Board' },
    { id: 'pattern-23', name: 'Space' },
    { id: 'pattern-24', name: 'Geometric' },
    { id: 'pattern-28', name: 'Cityscape' },
    { id: 'pattern-29', name: 'Nature' },
    { id: 'pattern-33', name: 'Abstract Lines' }
];

export const ChatThemeContext = createContext();

export const useChatTheme = () => {
    const context = useContext(ChatThemeContext);
    if (!context) {
        throw new Error('useChatTheme must be used within a ChatThemeProvider');
    }
    return context;
};

export default ChatThemeContext;
