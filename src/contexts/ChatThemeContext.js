import { createContext, useContext } from 'react';

// ✨ Polished & Premium Chat Themes
// ⚠️ STYLES ARE NOW DEFINED IN enhanced-themes.css using [data-chat-theme]
export const chatThemes = {
    'emerald-default': {
        name: 'Emerald (Default)',
        category: 'Professional',
        background: 'linear-gradient(135deg, #00a884, #00876a)',
        is_pattern: true,
        cssOnly: true
    },
    'classic-purple': {
        name: 'Classic Purple',
        category: 'Default',
        background: 'linear-gradient(135deg, #6366f1, #a855f7)',
        is_pattern: true,
        cssOnly: true
    },
    'midnight-amoled': {
        name: 'Midnight AMOLED',
        category: 'Dark',
        background: '#000000',
        cssOnly: true
    },
    'electric-dreams': {
        name: 'Electric Dreams',
        category: 'Futuristic',
        background: 'linear-gradient(135deg, #00f2fe, #4facfe)',
        cssOnly: true
    },
    'ocean-depths': {
        name: 'Ocean Depths',
        category: 'Nature',
        background: 'linear-gradient(135deg, #00c6fb, #005bea)',
        cssOnly: true
    },
    'sunset-glow': {
        name: 'Sunset Glow',
        category: 'Colorful',
        background: 'linear-gradient(135deg, #ff9a9e, #fecfef)',
        cssOnly: true
    },
    'forest-mist': {
        name: 'Forest Mist',
        category: 'Nature',
        background: 'linear-gradient(135deg, #43e97b, #38f9d7)',
        cssOnly: true
    },
    'cyberpunk-neon': {
        name: 'Cyberpunk Neon',
        category: 'Dark',
        background: 'linear-gradient(135deg, #f093fb, #f5576c)',
        cssOnly: true
    },
    'telegram-blue': {
        name: 'Telegram Blue',
        category: 'Professional',
        background: 'linear-gradient(135deg, #2481cc, #40a7e3)',
        cssOnly: true
    },
    'rose-gold': {
        name: 'Rose Gold',
        category: 'Elegant',
        background: 'linear-gradient(135deg, #fdfcfb, #e2d1c3)',
        cssOnly: true
    },
    'minimal-slate': {
        name: 'Minimal Slate',
        category: 'Professional',
        background: 'linear-gradient(135deg, #cfd9df, #e2ebf0)',
        cssOnly: true
    },
    'spring-vibes': {
        name: 'Spring Vibes',
        category: 'Seasonal',
        background: 'linear-gradient(135deg, #ecfdf5, #fef3c7)',
        is_pattern: true,
        cssOnly: true
    },
    'winter-calm': {
        name: 'Winter Calm',
        category: 'Seasonal',
        background: 'linear-gradient(135deg, #e0f2fe, #f0f9ff)',
        is_pattern: true,
        cssOnly: true
    },
    'cherry-blossom': {
        name: 'Cherry Blossom',
        category: 'Seasonal',
        background: 'linear-gradient(135deg, #fff1f2, #fff5f5)',
        is_pattern: true,
        cssOnly: true
    },
    'desert-dunes': {
        name: 'Desert Dunes',
        category: 'Nature',
        background: 'linear-gradient(135deg, #fff7ed, #ffedd5)',
        is_pattern: true,
        cssOnly: true
    },
    'pattern-overlay': {
        name: 'Pattern Overlay',
        category: 'Premium',
        background: 'rgba(0, 168, 132, 0.1)',
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
