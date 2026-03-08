import { createContext, useContext } from 'react';

// ✨ Polished & Premium Chat Themes
export const chatThemes = {
    classic_purple: {
        name: 'Classic Purple',
        category: 'Default',
        is_pattern: true,
        cssOnly: true,
        background: 'linear-gradient(180deg, #1e1b4b 0%, #2e1065 100%)',
        sentMessage: { background: '#8b5cf6', text: '#ffffff' },
        receivedMessage: { background: 'rgba(255, 255, 255, 0.1)', text: '#e2e8f0' }
    },

    midnight_amoled: {
        name: 'Midnight AMOLED',
        category: 'Dark',
        cssOnly: true,
        background: '#000000',
        sentMessage: { background: '#222222', text: '#ffffff' },
        receivedMessage: { background: '#0a0a0a', text: '#d4d4d4' }
    },

    electric_dreams: {
        name: 'Electric Dreams',
        category: 'Futuristic',
        cssOnly: true,
        background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
        sentMessage: { background: '#0072ff', text: '#ffffff' },
        receivedMessage: { background: '#ffffff', text: '#0f172a' }
    },

    ocean_depths: {
        name: 'Ocean Depths',
        category: 'Nature',
        cssOnly: true,
        background: 'linear-gradient(to bottom, #0f172a, #0e7490)',
        sentMessage: { background: '#0891b2', text: '#ffffff' },
        receivedMessage: { background: '#ffffff', text: '#164e63' }
    },

    sunset_glow: {
        name: 'Sunset Glow',
        category: 'Colorful',
        cssOnly: true,
        background: 'linear-gradient(180deg, #4c1d95 0%, #be185d 50%, #f59e0b 100%)',
        sentMessage: { background: '#f59e0b', text: '#ffffff' },
        receivedMessage: { background: '#ffffff', text: '#4c1d95' }
    },

    forest_mist: {
        name: 'Forest Mist',
        category: 'Nature',
        cssOnly: true,
        background: 'linear-gradient(to bottom right, #14532d, #166534, #15803d)',
        sentMessage: { background: '#16a34a', text: '#ffffff' },
        receivedMessage: { background: '#ffffff', text: '#14532d' }
    },

    cyberpunk_neon: {
        name: 'Cyberpunk Neon',
        category: 'Dark',
        cssOnly: true,
        background: 'linear-gradient(0deg, #050505 0%, #1a1a1a 100%)',
        sentMessage: { background: '#f000ff', text: '#ffffff' },
        receivedMessage: { background: '#000000', text: '#00ffea' }
    },

    telegram_blue: {
        name: 'Telegram Blue',
        category: 'Professional',
        cssOnly: true,
        background: '#87a7b8',
        sentMessage: { background: '#2b5278', text: '#ffffff' },
        receivedMessage: { background: '#ffffff', text: '#000000' }
    },

    rose_gold: {
        name: 'Rose Gold',
        category: 'Elegant',
        cssOnly: true,
        background: 'linear-gradient(to top, #fff1eb 0%, #ace0f9 100%)',
        sentMessage: { background: '#fda085', text: '#ffffff' },
        receivedMessage: { background: '#ffffff', text: '#4a4a4a' }
    },

    minimal_slate: {
        name: 'Minimal Slate',
        category: 'Professional',
        cssOnly: true,
        background: '#f1f5f9',
        sentMessage: { background: '#334155', text: '#ffffff' },
        receivedMessage: { background: '#ffffff', text: '#0f172a' }
    },

    spring_vibes: {
        name: 'Spring Vibes',
        category: 'Seasonal',
        is_pattern: true,
        cssOnly: true,
        background: 'linear-gradient(160deg, #ecfdf5 0%, #fef3c7 100%)',
        sentMessage: { background: '#059669', text: '#ffffff' },
        receivedMessage: { background: '#ffffff', text: '#065f46' }
    },

    winter_calm: {
        name: 'Winter Calm',
        category: 'Seasonal',
        is_pattern: true,
        cssOnly: true,
        background: 'linear-gradient(160deg, #f0f9ff 0%, #7dd3fc 100%)',
        sentMessage: { background: '#0284c7', text: '#ffffff' },
        receivedMessage: { background: '#ffffff', text: '#0c4a6e' }
    },

    cherry_blossom: {
        name: 'Cherry Blossom',
        category: 'Seasonal',
        is_pattern: true,
        cssOnly: true,
        background: 'linear-gradient(160deg, #fff1f2 0%, #fda4af 100%)',
        sentMessage: { background: '#e11d48', text: '#ffffff' },
        receivedMessage: { background: '#ffffff', text: '#881337' }
    },

    desert_dunes: {
        name: 'Desert Dunes',
        category: 'Nature',
        is_pattern: true,
        cssOnly: true,
        background: 'linear-gradient(160deg, #fffbeb 0%, #fcd34d 100%)',
        sentMessage: { background: '#d97706', text: '#ffffff' },
        receivedMessage: { background: '#ffffff', text: '#78350f' }
    },

    custom_background: {
        name: 'Custom Background',
        category: 'Custom',
        cssOnly: true,
        background: 'linear-gradient(to bottom, #e2e8f0, #cbd5e1)',
        sentMessage: { background: '#475569', text: '#ffffff' },
        receivedMessage: { background: '#ffffff', text: '#1e293b' }
    },

    pattern_overlay: {
        name: 'Pattern Overlay',
        category: 'Premium',
        is_pattern: true,
        cssOnly: false,
        background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
        sentMessage: {
            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
            text: '#ffffff',
            shadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
        },
        receivedMessage: {
            background: 'rgba(255, 255, 255, 0.12)',
            text: '#ffffff',
            border: '1px solid rgba(255, 255, 255, 0.1)'
        },
        header: {
            background: '#4f46e5',
            text: '#ffffff',
            iconColor: '#ffffff'
        },
        input: {
            background: 'rgba(255, 255, 255, 0.1)',
            text: '#ffffff',
            iconColor: '#ffffff'
        },
        buttons: {
            background: '#6366f1',
            text: '#ffffff',
            iconColor: '#ffffff'
        }
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
