import React, { useState, useEffect } from 'react';
import { supabase } from '../config/supabase';
import useAuthStore from '../store/authStore';
import { useQueryClient } from '@tanstack/react-query';
import { ChatThemeContext, chatThemes, chatPatterns } from './ChatThemeContext';

// Chat Theme Provider Component
export const ChatThemeProvider = ({ children }) => {
  const queryClient = useQueryClient();
  // State
  const [currentChatTheme, setCurrentChatTheme] = useState('classic_purple');
  const [currentWallpaper, setCurrentWallpaper] = useState(null);
  const [currentPattern, setCurrentPattern] = useState('pattern');
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
    const cachedPattern = localStorage.getItem(`digidad_chat_pattern_${chatId}`) || 'pattern';

    const themeToApply = (cachedTheme && chatThemes[cachedTheme]) ? cachedTheme : 'classic_purple';
    const wallpaperToApply = cachedWallpaper || null;

    // Apply immediately — this is synchronous, fires before any async work
    setCurrentChatTheme(themeToApply);
    setCurrentWallpaper(wallpaperToApply);
    setCurrentPattern(cachedPattern);
    applyTheme(themeToApply, wallpaperToApply, cachedPattern);

    // ── STEP 2: DB refresh is DEFERRED until refreshTheme() is called ─────────
    // This eliminates redundant network requests on every chat page load.
    setLoading(false);
  };

  // Explicitly fetch from DB when user enters theme/settings UI
  const refreshTheme = async (chatId) => {
    if (!chatId) return;
    try {
      const themeName = await queryClient.fetchQuery({
        queryKey: ['chat_themes', chatId],
        queryFn: async () => {
          const { data } = await supabase
            .from('chat_themes')
            .select('theme_name')
            .eq('chat_id', chatId)
            .maybeSingle();
          return data?.theme_name || null;
        },
        staleTime: Infinity,
        gcTime: 1000 * 60 * 60 * 24,
      });

      if (themeName && chatThemes[themeName]) {
        setCurrentChatTheme(themeName);
        localStorage.setItem(`digidad_chat_theme_${chatId}`, themeName);
        applyTheme(themeName, currentWallpaper);
      }

      const wallpaperUrl = await queryClient.fetchQuery({
        queryKey: ['chat_wallpapers', chatId],
        queryFn: async () => {
          const { data } = await supabase
            .from('chat_wallpapers')
            .select(`custom_url, wallpaper:wallpapers(url)`)
            .eq('chat_id', chatId)
            .maybeSingle();
          return data?.custom_url || data?.wallpaper?.url || null;
        },
        staleTime: Infinity,
        gcTime: 1000 * 60 * 60 * 24,
      });

      if (wallpaperUrl !== undefined) {
        setCurrentWallpaper(wallpaperUrl || null);
        if (wallpaperUrl) localStorage.setItem(`digidad_chat_wallpaper_${chatId}`, wallpaperUrl);
        else localStorage.removeItem(`digidad_chat_wallpaper_${chatId}`);
        applyTheme(currentChatTheme, wallpaperUrl || null);
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

        queryClient.invalidateQueries(['chat_themes', chatId]);
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

      queryClient.invalidateQueries(['chat_wallpapers', chatId]);
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

  const applyTheme = (themeKey, wallpaperUrl, patternId = 'pattern') => {
    const theme = chatThemes[themeKey] || chatThemes.classic_purple;

    const root = document.documentElement;
    const setProp = (name, value) => {
      if (value !== undefined) root.style.setProperty(name, value);
    };

    // Standardize on data-chat-theme attribute for CSS targeting
    const chatThemeAttr = themeKey.replace(/_/g, '-');
    document.body.setAttribute('data-chat-theme', chatThemeAttr);

    // If it's a CSS-only theme, we DO NOT set --chat-bg-gradient as an inline style.
    // This allows enhanced-themes.css to switch between Light/Dark variants.
    if (theme.cssOnly) {
      if (wallpaperUrl) {
        setProp('--chat-bg-image', `url("${wallpaperUrl}")`);
        setProp('--chat-bg-gradient', 'none');
        setProp('--chat-pattern-opacity', '0');
      } else {
        setProp('--chat-bg-image', 'none');
        // Clear manual property to let CSS take over (supports light/dark switching)
        root.style.removeProperty('--chat-bg-gradient');
      }
    } else {
      // For themes not in enhanced-themes.css, apply all styles manually
      setProp('--chat-bg-gradient', theme.background);

      const sent = theme.sentMessage || {};
      setProp('--sent-message-bg', sent.background);
      setProp('--sent-message-text', sent.text);
      setProp('--sent-message-shadow', sent.shadow || 'none');
      setProp('--sent-message-border', sent.border || 'none');

      const received = theme.receivedMessage || {};
      setProp('--received-message-bg', received.background);
      setProp('--received-message-text', received.text);
      setProp('--received-message-shadow', received.shadow || 'none');
      setProp('--received-message-border', received.border || 'none');

      if (theme.header) {
        setProp('--chat-header-bg', theme.header.background);
        setProp('--chat-header-text', theme.header.text);
        setProp('--chat-header-icon-color', theme.header.iconColor);
        setProp('--chat-header-border', theme.header.border || 'none');
      }

      if (theme.input) {
        setProp('--chat-input-bg', theme.input.background);
        setProp('--chat-input-text', theme.input.text);
        setProp('--chat-input-icon-color', theme.input.iconColor);
        setProp('--chat-input-border', theme.input.border || 'none');
      }

      if (theme.buttons) {
        setProp('--chat-buttons-bg', theme.buttons.background);
        setProp('--chat-buttons-text', theme.buttons.text);
        setProp('--chat-buttons-icon-color', theme.buttons.iconColor);
      }
    }

    // Apply specific pattern if requested
    if (patternId) {
      const patternPath = `/assets/${patternId}.svg`;
      setProp('--pattern-url', `url("${patternPath}")`);
    }
  };

  const selectPattern = async (patternId) => {
    if (!currentChatId) return;

    // Set locally for instant feedback
    const root = document.documentElement;
    const patternPath = `/assets/${patternId}.svg`;
    root.style.setProperty('--pattern-url', `url("${patternPath}")`);
    localStorage.setItem(`digidad_chat_pattern_${currentChatId}`, patternId);
    setCurrentPattern(patternId);

    // Persistence logic using chat_wallpapers table
    try {
      await supabase
        .from('chat_wallpapers')
        .upsert({
          chat_id: currentChatId,
          set_by: (await supabase.auth.getUser()).data.user?.id,
          custom_url: `pattern:${patternId}`,
          updated_at: new Date().toISOString()
        }, { onConflict: 'chat_id,set_by' });
    } catch (e) {
      console.error('Failed to save pattern preference', e);
    }
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
    chatPatterns, // Exporting patterns
    currentPattern,
    selectTheme,
    selectPattern, // Exporting selection function
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