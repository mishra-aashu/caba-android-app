import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../config/supabase';
import useAuthStore from '../store/authStore';

// ✨ Polished & Premium Chat Themes
const chatThemes = {
  classic_purple: {
    name: 'Classic Purple',
    category: 'Default',
    background: `
      radial-gradient(at 0% 0%, hsla(253,16%,7%,1) 0, transparent 50%), 
      radial-gradient(at 50% 0%, hsla(225,39%,30%,1) 0, transparent 50%), 
      radial-gradient(at 100% 0%, hsla(339,49%,30%,1) 0, transparent 50%),
      linear-gradient(180deg, #1e1b4b 0%, #2e1065 100%)
    `,
    sentMessage: {
      background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
      text: '#ffffff',
      shadow: '0 4px 15px rgba(139, 92, 246, 0.4)'
    },
    receivedMessage: {
      background: 'rgba(255, 255, 255, 0.1)', // Glass effect
      text: '#e2e8f0',
      border: '1px solid rgba(255, 255, 255, 0.1)'
    },
    header: {
      background: 'rgba(30, 27, 75, 0.95)',
      text: '#ffffff',
      iconColor: '#a78bfa'
    },
    input: {
      background: 'rgba(30, 27, 75, 0.8)',
      text: '#ffffff',
      iconColor: '#8b5cf6'
    },
    buttons: {
      background: '#8b5cf6',
      text: '#ffffff',
      iconColor: '#ffffff'
    }
  },

  midnight_amoled: {
    name: 'Midnight AMOLED',
    category: 'Dark',
    background: '#000000',
    sentMessage: {
      background: '#222222',
      text: '#ffffff',
      border: '1px solid #333'
    },
    receivedMessage: {
      background: '#0a0a0a',
      text: '#d4d4d4',
      border: '1px solid #222'
    },
    header: {
      background: '#000000',
      text: '#ffffff',
      iconColor: '#ffffff'
    },
    input: {
      background: '#111111',
      text: '#ffffff',
      iconColor: '#ffffff'
    },
    buttons: {
      background: '#333333',
      text: '#ffffff',
      iconColor: '#ffffff'
    }
  },

  electric_dreams: {
    name: 'Electric Dreams',
    category: 'Futuristic',
    background: `
      radial-gradient(circle at top right, #3b82f6, transparent 40%),
      radial-gradient(circle at bottom left, #ec4899, transparent 40%),
      linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)
    `,
    sentMessage: {
      background: 'linear-gradient(135deg, #00c6ff 0%, #0072ff 100%)',
      text: '#ffffff',
      shadow: '0 4px 15px rgba(0, 198, 255, 0.3)'
    },
    receivedMessage: {
      background: 'rgba(255, 255, 255, 0.9)',
      text: '#0f172a'
    },
    header: {
      background: 'linear-gradient(90deg, #00c6ff 0%, #0072ff 100%)',
      text: '#ffffff',
      iconColor: '#ffffff'
    },
    input: {
      background: 'rgba(255, 255, 255, 0.9)',
      text: '#0f172a',
      iconColor: '#0072ff'
    },
    buttons: {
      background: 'linear-gradient(135deg, #00c6ff 0%, #0072ff 100%)',
      text: '#ffffff',
      iconColor: '#ffffff'
    }
  },

  ocean_depths: {
    name: 'Ocean Depths',
    category: 'Nature',
    background: `
      linear-gradient(to bottom, #0f172a, #0e7490)
    `,
    sentMessage: {
      background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
      text: '#ffffff'
    },
    receivedMessage: {
      background: 'rgba(255, 255, 255, 0.85)',
      text: '#164e63'
    },
    header: {
      background: '#0e7490',
      text: '#ffffff',
      iconColor: '#cffafe'
    },
    input: {
      background: '#ffffff',
      text: '#155e75',
      iconColor: '#0891b2'
    },
    buttons: {
      background: '#0891b2',
      text: '#ffffff',
      iconColor: '#ffffff'
    }
  },

  sunset_glow: {
    name: 'Sunset Glow',
    category: 'Colorful',
    background: `
      linear-gradient(180deg, #4c1d95 0%, #be185d 50%, #f59e0b 100%)
    `,
    sentMessage: {
      background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
      text: '#ffffff'
    },
    receivedMessage: {
      background: 'rgba(255, 255, 255, 0.9)',
      text: '#4c1d95'
    },
    header: {
      background: '#4c1d95',
      text: '#ffffff',
      iconColor: '#fbbf24'
    },
    input: {
      background: 'rgba(255, 255, 255, 0.95)',
      text: '#be185d',
      iconColor: '#d97706'
    },
    buttons: {
      background: '#d97706',
      text: '#ffffff',
      iconColor: '#ffffff'
    }
  },

  forest_mist: {
    name: 'Forest Mist',
    category: 'Nature',
    background: `
      linear-gradient(to bottom right, #14532d, #166534, #15803d)
    `,
    sentMessage: {
      background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
      text: '#ffffff'
    },
    receivedMessage: {
      background: '#ffffff',
      text: '#14532d'
    },
    header: {
      background: '#14532d',
      text: '#ffffff',
      iconColor: '#86efac'
    },
    input: {
      background: '#ffffff',
      text: '#14532d',
      iconColor: '#16a34a'
    },
    buttons: {
      background: '#16a34a',
      text: '#ffffff',
      iconColor: '#ffffff'
    }
  },

  cyberpunk_neon: {
    name: 'Cyberpunk Neon',
    category: 'Dark',
    background: `
      linear-gradient(0deg, #050505 0%, #1a1a1a 100%)
    `,
    sentMessage: {
      background: 'linear-gradient(135deg, #f000ff 0%, #d600e3 100%)',
      text: '#ffffff',
      shadow: '0 0 10px rgba(240, 0, 255, 0.5)'
    },
    receivedMessage: {
      background: '#000000',
      text: '#00ffea',
      border: '1px solid #00ffea',
      shadow: '0 0 5px rgba(0, 255, 234, 0.2)'
    },
    header: {
      background: '#000000',
      text: '#f000ff',
      iconColor: '#00ffea',
      border: '1px solid #333'
    },
    input: {
      background: '#0a0a0a',
      text: '#00ffea',
      iconColor: '#f000ff',
      border: '1px solid #333'
    },
    buttons: {
      background: '#f000ff',
      text: '#ffffff',
      iconColor: '#000000'
    }
  },

  telegram_blue: {
    name: 'Telegram Blue',
    category: 'Professional',
    background: '#87a7b8', // Classic Telegram muted background color
    sentMessage: {
      background: '#2b5278',
      text: '#ffffff'
    },
    receivedMessage: {
      background: '#ffffff',
      text: '#000000'
    },
    header: {
      background: '#242f3d',
      text: '#ffffff',
      iconColor: '#ffffff'
    },
    input: {
      background: '#ffffff',
      text: '#000000',
      iconColor: '#2b5278'
    },
    buttons: {
      background: '#2b5278',
      text: '#ffffff',
      iconColor: '#ffffff'
    }
  },

  rose_gold: {
    name: 'Rose Gold',
    category: 'Elegant',
    background: `
      linear-gradient(to top, #fff1eb 0%, #ace0f9 100%)
    `,
    sentMessage: {
      background: 'linear-gradient(120deg, #f6d365 0%, #fda085 100%)',
      text: '#ffffff'
    },
    receivedMessage: {
      background: '#ffffff',
      text: '#4a4a4a',
      shadow: '0 2px 5px rgba(0,0,0,0.05)'
    },
    header: {
      background: '#ffffff',
      text: '#fda085',
      iconColor: '#f6d365'
    },
    input: {
      background: '#ffffff',
      text: '#4a4a4a',
      iconColor: '#fda085'
    },
    buttons: {
      background: 'linear-gradient(120deg, #f6d365 0%, #fda085 100%)',
      text: '#ffffff',
      iconColor: '#ffffff'
    }
  },

  minimal_slate: {
    name: 'Minimal Slate',
    category: 'Professional',
    background: '#f1f5f9',
    sentMessage: {
      background: '#334155',
      text: '#ffffff'
    },
    receivedMessage: {
      background: '#ffffff',
      text: '#0f172a',
      border: '1px solid #e2e8f0'
    },
    header: {
      background: '#ffffff',
      text: '#0f172a',
      iconColor: '#64748b'
    },
    input: {
      background: '#ffffff',
      text: '#0f172a',
      iconColor: '#334155'
    },
    buttons: {
      background: '#334155',
      text: '#ffffff',
      iconColor: '#ffffff'
    }
  },

  custom_background: {
    name: 'Custom Background',
    category: 'Custom',
    background: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E"), linear-gradient(to bottom, #e2e8f0, #cbd5e1)`,
    backgroundColor: '#DFDBE5',
    sentMessage: {
      background: '#475569',
      text: '#ffffff'
    },
    receivedMessage: {
      background: '#ffffff',
      text: '#1e293b'
    },
    header: {
      background: '#1e293b',
      text: '#ffffff',
      iconColor: '#cbd5e1'
    },
    input: {
      background: '#ffffff',
      text: '#1e293b',
      iconColor: '#475569'
    },
    buttons: {
      background: '#475569',
      text: '#ffffff',
      iconColor: '#ffffff'
    }
  }
};

// Create the Chat Theme Context
const ChatThemeContext = createContext();

// Chat Theme Provider Component
export const ChatThemeProvider = ({ children }) => {

  // State
  const [currentChatTheme, setCurrentChatTheme] = useState('classic_purple');
  const [currentWallpaper, setCurrentWallpaper] = useState(null);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scrollPercentage, setScrollPercentage] = useState(0);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--scroll-percentage', scrollPercentage);
  }, [scrollPercentage]);

  // Load chat theme logic — check localStorage cache first, then DB
  // CRITICAL: applyTheme is called DIRECTLY here (not via useEffect) so
  // the background is set on the same tick — zero blink / flash.
  const loadChatTheme = async (chatId) => {
    if (!chatId) {
      setCurrentChatTheme('classic_purple');
      setCurrentWallpaper(null);
      setLoading(false);
      applyTheme('classic_purple', null);
      return;
    }

    const debounceKey = `digidad_theme_debounce_${chatId}`;
    const now = Date.now();
    const lastCall = parseInt(localStorage.getItem(debounceKey) || '0');

    if (now - lastCall < 500) {
      setLoading(false);
      return;
    }
    localStorage.setItem(debounceKey, now.toString());

    // ── STEP 1: Apply cached theme SYNCHRONOUSLY (instant, no blink) ─────────
    const cachedTheme = localStorage.getItem(`digidad_chat_theme_${chatId}`);
    const cachedWallpaper = localStorage.getItem(`digidad_chat_wallpaper_${chatId}`);

    const themeToApply = (cachedTheme && chatThemes[cachedTheme]) ? cachedTheme : 'classic_purple';
    const wallpaperToApply = cachedWallpaper || null;

    // Apply immediately — this is synchronous, fires before any async work
    setCurrentChatTheme(themeToApply);
    setCurrentWallpaper(wallpaperToApply);
    applyTheme(themeToApply, wallpaperToApply);

    // ── STEP 2: DB refresh is DEFERRED until refreshTheme() is called ─────────
    // This eliminates redundant network requests on every chat page load.
    setLoading(false);
  };

  // Explicitly fetch from DB when user enters theme/settings UI
  const refreshTheme = async (chatId) => {
    if (!chatId) return;
    try {
      const { data: themeData } = await supabase
        .from('chat_themes')
        .select('theme_name')
        .eq('chat_id', chatId)
        .maybeSingle();

      if (themeData?.theme_name && chatThemes[themeData.theme_name]) {
        setCurrentChatTheme(themeData.theme_name);
        localStorage.setItem(`digidad_chat_theme_${chatId}`, themeData.theme_name);
        applyTheme(themeData.theme_name, currentWallpaper);
      }

      const { data: wallpaperData } = await supabase
        .from('chat_wallpapers')
        .select(`
          custom_url,
          wallpaper:wallpapers(url)
        `)
        .eq('chat_id', chatId)
        .maybeSingle();

      if (wallpaperData) {
        const url = wallpaperData.custom_url || wallpaperData.wallpaper?.url;
        setCurrentWallpaper(url || null);
        if (url) localStorage.setItem(`digidad_chat_wallpaper_${chatId}`, url);
        else localStorage.removeItem(`digidad_chat_wallpaper_${chatId}`);
        applyTheme(currentChatTheme, url || null);
      }
    } catch (e) {
      console.warn('Theme refresh failed:', e);
    }
  };

  const saveChatTheme = async (themeKey, chatId) => {
    if (!chatId) return;
    try {
      // Save to localStorage (fast cache)
      localStorage.setItem(`digidad_chat_theme_${chatId}`, themeKey);

      // Save to DB for cross-device sync
      const currentUser = useAuthStore.getState().dbUser;
      if (currentUser) {
        await supabase
          .from('chat_themes')
          .upsert(
            {
              chat_id: chatId,
              theme_name: themeKey,
              theme_config: chatThemes[themeKey] || {},
              set_by: currentUser.id,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'chat_id,set_by' }
          );
      }
    } catch (e) {
      console.error('Theme save failed', e);
    }
  };

  const saveChatWallpaper = async (wallpaperId, chatId, customUrl = null, knownUrl = null) => {
    if (!chatId) return;
    try {
      const currentUser = useAuthStore.getState().dbUser;
      if (!currentUser) return;

      const upsertData = {
        chat_id: chatId,
        set_by: currentUser.id,
        updated_at: new Date().toISOString()
      };

      if (customUrl) {
        upsertData.custom_url = customUrl;
        upsertData.wallpaper_id = null;
      } else if (wallpaperId) {
        upsertData.wallpaper_id = wallpaperId;
        upsertData.custom_url = null;
      } else {
        // null = removing wallpaper
        upsertData.wallpaper_id = null;
        upsertData.custom_url = null;
      }

      const { error } = await supabase
        .from('chat_wallpapers')
        .upsert(upsertData, { onConflict: 'chat_id,set_by' });

      if (error) throw error;

      // Update local state for the current chat (if not already done optimistically)
      if (chatId === currentChatId) {
        if (wallpaperId === null && !customUrl) {
          // Already handled optimistically in selectWallpaper
        } else if (knownUrl) {
          // Already handled optimistically in selectWallpaper
        } else if (customUrl) {
          setCurrentWallpaper(customUrl);
          localStorage.setItem(`digidad_chat_wallpaper_${chatId}`, customUrl);
        } else if (wallpaperId) {
          // Fallback: fetch URL from DB only if we don't know it
          const { data } = await supabase.from('wallpapers').select('url').eq('id', wallpaperId).single();
          if (data?.url) {
            setCurrentWallpaper(data.url);
            localStorage.setItem(`digidad_chat_wallpaper_${chatId}`, data.url);
          }
        }
      }
    } catch (e) {
      console.error('Wallpaper save failed', e);
    }
  };

  const setChatId = (chatId) => {
    setCurrentChatId(chatId);
    // Apply cached theme IMMEDIATELY before any async work — prevents blink.
    // loadChatTheme will also call applyTheme after reading cache, but calling
    // it here first ensures frame 1 has the correct background.
    const cachedTheme = localStorage.getItem(`digidad_chat_theme_${chatId}`);
    const cachedWallpaper = localStorage.getItem(`digidad_chat_wallpaper_${chatId}`);
    const themeKey = (cachedTheme && chatThemes[cachedTheme]) ? cachedTheme : 'classic_purple';
    applyTheme(themeKey, cachedWallpaper || null);
    loadChatTheme(chatId);
  };

  const selectTheme = async (themeKey, chatIdOverride) => {
    if (!chatThemes[themeKey]) return;
    const chatIdToUse = chatIdOverride || currentChatId;

    if (!chatIdToUse) {
      console.error('No chat ID available for theme selection');
      return;
    }

    setCurrentChatTheme(themeKey);
    await saveChatTheme(themeKey, chatIdToUse);
    applyTheme(themeKey, currentWallpaper);
  };

  const selectWallpaper = async (wallpaperId, customUrl = null, wallpaperUrl = null) => {
    if (!currentChatId) return;

    // Optimistic update: apply the wallpaper URL immediately for instant feedback
    if (wallpaperId === null) {
      // Removing wallpaper
      setCurrentWallpaper(null);
      localStorage.removeItem(`digidad_chat_wallpaper_${currentChatId}`);
    } else if (wallpaperUrl) {
      // We already have the URL — apply instantly
      setCurrentWallpaper(wallpaperUrl);
      localStorage.setItem(`digidad_chat_wallpaper_${currentChatId}`, wallpaperUrl);
    }

    await saveChatWallpaper(wallpaperId, currentChatId, customUrl, wallpaperUrl);
  };

  const applyTheme = (themeKey, wallpaperUrl) => {
    const theme = chatThemes[themeKey];
    if (!theme) return;

    const root = document.documentElement;
    const setProp = (name, value) => {
      if (value !== undefined) root.style.setProperty(name, value);
    };

    setProp('--chat-bg-gradient', theme.background);
    setProp('--chat-bg-image', wallpaperUrl ? `url("${wallpaperUrl}")` : 'none');

    setProp('--sent-message-bg', theme.sentMessage.background);
    setProp('--sent-message-text', theme.sentMessage.text);
    setProp('--sent-message-shadow', theme.sentMessage.shadow || 'none');
    setProp('--sent-message-border', theme.sentMessage.border || 'none');

    setProp('--received-message-bg', theme.receivedMessage.background);
    setProp('--received-message-text', theme.receivedMessage.text);
    setProp('--received-message-shadow', theme.receivedMessage.shadow || 'none');
    setProp('--received-message-border', theme.receivedMessage.border || 'none');

    setProp('--chat-header-bg', theme.header.background);
    setProp('--chat-header-text', theme.header.text);
    setProp('--chat-header-icon-color', theme.header.iconColor);
    setProp('--chat-header-border', theme.header.border || 'none');

    setProp('--chat-input-bg', theme.input.background);
    setProp('--chat-input-text', theme.input.text);
    setProp('--chat-input-icon-color', theme.input.iconColor);
    setProp('--chat-input-border', theme.input.border || 'none');

    setProp('--chat-buttons-bg', theme.buttons.background);
    setProp('--chat-buttons-text', theme.buttons.text);
    setProp('--chat-buttons-icon-color', theme.buttons.iconColor);

    // Standardize on data-chat-theme attribute
    document.body.setAttribute('data-chat-theme', themeKey.replace(/_/g, '-'));
  };

  // NOTE: applyTheme is now called DIRECTLY from setChatId and loadChatTheme
  // (synchronously on the same tick) instead of in this useEffect.
  // Removing the useEffect prevents the async 2-step blink:
  // (loading→theme state updates→useEffect fires→applyTheme runs)
  // The sequence is now: setChatId → applyTheme(cache) immediately → no blink.

  const value = {
    chatTheme: currentChatTheme,
    chatWallpaper: currentWallpaper,
    chatThemes,
    selectTheme,
    selectWallpaper,
    setChatId,
    loading,
    currentThemeData: chatThemes[currentChatTheme] || chatThemes.classic_purple,
    refreshTheme,
    setScrollPercentage,
    currentChatId
  };

  return (
    <ChatThemeContext.Provider value={value}>
      {children}
    </ChatThemeContext.Provider>
  );
};

export const useChatTheme = () => {
  const context = useContext(ChatThemeContext);
  if (!context) {
    throw new Error('useChatTheme must be used within a ChatThemeProvider');
  }
  return context;
};

export default ChatThemeContext;