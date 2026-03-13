import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../config/supabase';
import useAuthStore from '../store/authStore';
import { useQueryClient } from '@tanstack/react-query';
import { ChatThemeContext, chatThemes, chatPatterns } from './ChatThemeContext';
import { useTheme } from './ThemeContext';


// ─── Pure function: applies theme vars to DOM — NO React state dependency ───
// Takes all values explicitly so it's always called with fresh, correct data.
function applyThemeToDom({
  themeKey,
  wallpaperUrl,   // null = no wallpaper, undefined = don't touch wallpaper slot
  patternId,      // null = no pattern, undefined = don't touch pattern slot
}) {
  const root = document.documentElement;
  const theme = chatThemes[themeKey] || chatThemes.classic_purple;

  const setProp = (name, value) => {
    if (value != null && value !== '') root.style.setProperty(name, value);
    else root.style.removeProperty(name);
  };

  // ─── 1. data-attribute (drives CSS selectors in enhanced-themes.css) ───
  const chatThemeAttr = themeKey.replace(/_/g, '-');
  document.documentElement.setAttribute('data-chat-theme', chatThemeAttr);
  document.body.setAttribute('data-chat-theme', chatThemeAttr);

  const isDarkMode = root.getAttribute('data-theme') === 'dark';

  // ─── 2. Wallpaper (only touch if explicitly passed — not undefined) ───
  if (wallpaperUrl !== undefined) {
    if (wallpaperUrl) {
      setProp('--chat-bg-image', `url("${wallpaperUrl}")`);
    } else {
      root.style.removeProperty('--chat-bg-image');
    }
  }

  // ─── 3. Theme background/colors ───
  if (theme.cssOnly) {
    // Let enhanced-themes.css drive everything — clear manual overrides
    [
      '--chat-bg-gradient', '--chat-bg-base',
      '--sent-message-bg', '--sent-message-text', '--sent-message-border', '--sent-message-shadow',
      '--received-message-bg', '--received-message-text', '--received-message-border', '--received-message-shadow',
      '--chat-header-bg', '--chat-header-text', '--chat-header-icon-color', '--chat-header-border',
      '--chat-input-bg', '--chat-input-text', '--chat-input-placeholder', '--chat-input-icon-color', '--chat-input-border',
      '--chat-composer-bg', '--chat-composer-border',
      '--chat-send-btn-bg', '--chat-send-btn-color',
    ].forEach(prop => root.style.removeProperty(prop));
  } else {
    // Full variable sync for "Premium" JS themes
    setProp('--chat-bg-gradient', theme.background);
    setProp('--chat-bg-base', theme.backgroundBase || (isDarkMode ? '#0b141a' : '#e5ddd5'));

    // Helper to map message sub-objects (handles both 'bg' and 'background' keys)
    const mapSubProps = (prefix, obj) => {
      if (!obj) return;
      setProp(`${prefix}-bg`, obj.background || obj.bg);
      setProp(`${prefix}-text`, obj.text);
      setProp(`${prefix}-border`, obj.border);
      setProp(`${prefix}-shadow`, obj.shadow);
    };

    mapSubProps('--sent-message', theme.sentMessage);
    mapSubProps('--received-message', theme.receivedMessage);

    // Map other slots if defined in the theme object
    if (theme.header) {
      setProp('--chat-header-bg', theme.header.background);
      setProp('--chat-header-text', theme.header.text);
      setProp('--chat-header-icon-color', theme.header.iconColor);
    }

    if (theme.input) {
      setProp('--chat-input-bg', theme.input.background);
      setProp('--chat-input-text', theme.input.text);
      setProp('--chat-input-icon-color', theme.input.iconColor);
    }
  }

  // ─── 4. Pattern (only touch if explicitly passed — not undefined) ───
  if (patternId !== undefined) {
    if (patternId) {
      const patternPath = `/assets/${patternId}.svg`;
      setProp('--pattern-url', `url("${patternPath}")`);

      let patternColor = theme.receivedMessage?.text;
      if (!patternColor) {
        patternColor = isDarkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.12)';
      }
      setProp('--chat-pattern-color', patternColor);
      setProp('--chat-pattern-opacity', wallpaperUrl ? '0.04' : (theme.is_pattern ? '0.12' : '0.08'));
      setProp('--chat-pattern-blend', theme.chat_pattern_blend || 'overlay');
      setProp('--chat-pattern-size', theme.chat_pattern_size || '420px');
    } else {
      root.style.removeProperty('--pattern-url');
      root.style.removeProperty('--chat-pattern-opacity');
      root.style.removeProperty('--chat-pattern-color');
      root.style.removeProperty('--chat-pattern-blend');
      root.style.removeProperty('--chat-pattern-size');
    }
  }
}

// ─── Helpers ───
const LOCAL_THEME_KEY = (id) => `digidad_chat_theme_${id}`;
const LOCAL_WALLPAPER_KEY = (id) => `digidad_chat_wallpaper_${id}`;
const LOCAL_PATTERN_KEY = (id) => `digidad_chat_pattern_${id}`;

function readCache(chatId, isDark) {
  const rawTheme = localStorage.getItem(LOCAL_THEME_KEY(chatId));
  const rawWallpaper = localStorage.getItem(LOCAL_WALLPAPER_KEY(chatId));
  const rawPattern = localStorage.getItem(LOCAL_PATTERN_KEY(chatId));

  const standardDefault = isDark ? 'cherry_blossom' : 'spring_vibes';
  const themeKey = (rawTheme && chatThemes[rawTheme]) ? rawTheme : standardDefault;

  // wallpaper slot may contain "pattern:xxx" for legacy saves
  let wallpaper = null;
  let pattern = rawPattern || 'pattern';

  if (rawWallpaper) {
    if (rawWallpaper.startsWith('pattern:')) {
      pattern = rawWallpaper.replace('pattern:', '');
      wallpaper = null;
    } else {
      wallpaper = rawWallpaper;
    }
  }

  return { themeKey, wallpaper, pattern };
}

// ─── Provider ───────────────────────────────────────────────────────────────
export const ChatThemeProvider = ({ children }) => {
  const queryClient = useQueryClient();
  const { isDark } = useTheme();

  const standardDefault = isDark ? 'cherry_blossom' : 'spring_vibes';

  // Refs hold the authoritative "current" values so async callbacks always
  // read the latest — no stale-closure bugs.
  const themeRef = useRef(standardDefault);
  const wallpaperRef = useRef(null);
  const patternRef = useRef('pattern');
  const chatIdRef = useRef(null);

  // React state drives re-renders (consumer components)
  const [currentChatTheme, _setTheme] = useState(standardDefault);
  const [currentWallpaper, _setWallpaper] = useState(null);
  const [currentPattern, _setPattern] = useState('pattern');
  const [currentChatId, _setChatId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scrollPercentage, setScrollPercentage] = useState(0);

  // Sync helpers: update both ref AND state atomically
  const setTheme = useCallback((v) => { themeRef.current = v; _setTheme(v); }, []);
  const setWallpaper = useCallback((v) => { wallpaperRef.current = v; _setWallpaper(v); }, []);
  const setPattern = useCallback((v) => { patternRef.current = v; _setPattern(v); }, []);
  const setChatIdState = useCallback((v) => { chatIdRef.current = v; _setChatId(v); }, []);

  useEffect(() => {
    document.documentElement.style.setProperty('--scroll-percentage', scrollPercentage);
  }, [scrollPercentage]);

  // ── Core: apply everything to DOM using ref values (always fresh) ──────
  const applyAll = useCallback(({
    themeKey = themeRef.current,
    wallpaper = wallpaperRef.current,  // pass null to clear, undefined to keep current
    pattern = patternRef.current,
  } = {}) => {
    applyThemeToDom({
      themeKey,
      wallpaperUrl: wallpaper,   // always explicit here — refs are fresh
      patternId: pattern,
    });
  }, []);

  // ── Load from DB in background, update state + DOM if changed ──────────
  const refreshTheme = useCallback(async (chatId) => {
    if (!chatId) return;
    const currentUser = useAuthStore.getState().dbUser;
    if (!currentUser) return;

    try {
      const [themeData, wallpaperData] = await Promise.all([
        queryClient.fetchQuery({
          queryKey: ['chat_themes', chatId, currentUser.id],
          queryFn: async () => {
            const { data } = await supabase
              .from('chat_themes')
              .select('theme_name')
              .eq('chat_id', chatId)
              .eq('set_by', currentUser.id)
              .maybeSingle();
            return data?.theme_name || null;
          },
          staleTime: 1000 * 60 * 5,
          gcTime: 1000 * 60 * 60,
        }),
        queryClient.fetchQuery({
          queryKey: ['chat_wallpapers', chatId, currentUser.id],
          queryFn: async () => {
            const { data } = await supabase
              .from('chat_wallpapers')
              .select('custom_url, wallpaper:wallpapers(url)')
              .eq('chat_id', chatId)
              .eq('set_by', currentUser.id)
              .maybeSingle();
            return data?.custom_url || data?.wallpaper?.url || null;
          },
          staleTime: 1000 * 60 * 5,
          gcTime: 1000 * 60 * 60,
        }),
      ]);

      // Only apply if this chatId is still active
      if (chatIdRef.current !== chatId) return;

      const freshTheme = (themeData && chatThemes[themeData]) ? themeData : themeRef.current;

      let freshWallpaper = wallpaperRef.current;
      let freshPattern = patternRef.current;

      if (wallpaperData !== undefined) {
        if (wallpaperData && wallpaperData.startsWith('pattern:')) {
          freshPattern = wallpaperData.replace('pattern:', '');
          freshWallpaper = null;
          localStorage.setItem(LOCAL_PATTERN_KEY(chatId), freshPattern);
          localStorage.removeItem(LOCAL_WALLPAPER_KEY(chatId));
        } else {
          freshWallpaper = wallpaperData || null;
          if (freshWallpaper) {
            localStorage.setItem(LOCAL_WALLPAPER_KEY(chatId), freshWallpaper);
          } else {
            localStorage.removeItem(LOCAL_WALLPAPER_KEY(chatId));
          }
        }
      }

      if (themeData && chatThemes[themeData]) {
        localStorage.setItem(LOCAL_THEME_KEY(chatId), themeData);
      }

      // Update state + refs
      setTheme(freshTheme);
      setWallpaper(freshWallpaper);
      setPattern(freshPattern);

      // Apply all to DOM
      applyAll({ themeKey: freshTheme, wallpaper: freshWallpaper, pattern: freshPattern });

    } catch (e) {
      console.warn('[ChatTheme] refreshTheme failed:', e);
    }
  }, [queryClient, applyAll, setTheme, setWallpaper, setPattern]);

  // ── setChatId: called when user navigates to a chat ────────────────────
  const setChatId = useCallback((chatId) => {
    setChatIdState(chatId);
    chatIdRef.current = chatId;

    if (!chatId) {
      setTheme(standardDefault);
      setWallpaper(null);
      setPattern('pattern');
      applyAll({ themeKey: standardDefault, wallpaper: null, pattern: 'pattern' });
      setLoading(false);
      return;
    }

    // 1. Apply cache SYNCHRONOUSLY — zero blink on navigation
    const { themeKey, wallpaper, pattern } = readCache(chatId, isDark);
    setTheme(themeKey);
    setWallpaper(wallpaper);
    setPattern(pattern);
    applyAll({ themeKey, wallpaper, pattern });
    setLoading(false);

    // 2. Refresh from DB in background (debounced)
    const debounceKey = `digidad_theme_debounce_${chatId}`;
    const now = Date.now();
    const lastCall = parseInt(localStorage.getItem(debounceKey) || '0');
    if (now - lastCall >= 500) {
      localStorage.setItem(debounceKey, now.toString());
      refreshTheme(chatId);
    }
  }, [applyAll, refreshTheme, setTheme, setWallpaper, setPattern, setChatIdState]);

  // ── selectTheme ──────────────────────────────────────────────────────────
  const selectTheme = useCallback(async (themeKey, chatIdOverride) => {
    if (!chatThemes[themeKey]) return;
    const chatId = chatIdOverride || chatIdRef.current;
    if (!chatId) { console.error('[ChatTheme] No chatId for selectTheme'); return; }

    setTheme(themeKey);
    localStorage.setItem(LOCAL_THEME_KEY(chatId), themeKey);

    // Apply with CURRENT wallpaper and pattern (from refs — always fresh)
    applyAll({ themeKey, wallpaper: wallpaperRef.current, pattern: patternRef.current });

    // Persist to DB
    try {
      const currentUser = useAuthStore.getState().dbUser;
      if (currentUser) {
        await supabase.from('chat_themes').upsert({
          chat_id: chatId,
          theme_name: themeKey,
          theme_config: chatThemes[themeKey] || {},
          set_by: currentUser.id,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'chat_id,set_by' });
        queryClient.invalidateQueries(['chat_themes', chatId]);
      }
    } catch (e) { console.error('[ChatTheme] selectTheme save failed', e); }
  }, [applyAll, queryClient, setTheme]);

  // ── selectWallpaper ──────────────────────────────────────────────────────
  const selectWallpaper = useCallback(async (wallpaperId, customUrl = null, wallpaperUrl = null) => {
    const chatId = chatIdRef.current;
    if (!chatId) return;

    let finalWallpaper = null;

    if (wallpaperId === null && !customUrl) {
      // Removing wallpaper
      finalWallpaper = null;
      localStorage.removeItem(LOCAL_WALLPAPER_KEY(chatId));
    } else if (wallpaperUrl) {
      finalWallpaper = wallpaperUrl;
      localStorage.setItem(LOCAL_WALLPAPER_KEY(chatId), wallpaperUrl);
    } else if (customUrl) {
      finalWallpaper = customUrl;
      localStorage.setItem(LOCAL_WALLPAPER_KEY(chatId), customUrl);
    }

    setWallpaper(finalWallpaper);
    // Apply immediately with current theme + pattern from refs
    applyAll({ themeKey: themeRef.current, wallpaper: finalWallpaper, pattern: patternRef.current });

    // Persist
    try {
      const currentUser = useAuthStore.getState().dbUser;
      if (!currentUser) return;

      const upsertData = {
        chat_id: chatId,
        set_by: currentUser.id,
        updated_at: new Date().toISOString(),
      };

      if (customUrl) {
        upsertData.custom_url = customUrl;
        upsertData.wallpaper_id = null;
      } else if (wallpaperId) {
        upsertData.wallpaper_id = wallpaperId;
        upsertData.custom_url = null;
        // Fetch URL if not provided
        if (!wallpaperUrl && !finalWallpaper) {
          const { data } = await supabase.from('wallpapers').select('url').eq('id', wallpaperId).single();
          if (data?.url) {
            setWallpaper(data.url);
            localStorage.setItem(LOCAL_WALLPAPER_KEY(chatId), data.url);
            applyAll({ themeKey: themeRef.current, wallpaper: data.url, pattern: patternRef.current });
          }
        }
      } else {
        upsertData.wallpaper_id = null;
        upsertData.custom_url = null;
      }

      await supabase.from('chat_wallpapers').upsert(upsertData, { onConflict: 'chat_id,set_by' });
      queryClient.invalidateQueries(['chat_wallpapers', chatId]);
    } catch (e) { console.error('[ChatTheme] selectWallpaper save failed', e); }
  }, [applyAll, queryClient, setWallpaper]);

  // ── selectPattern ────────────────────────────────────────────────────────
  const selectPattern = useCallback(async (patternId) => {
    const chatId = chatIdRef.current;
    if (!chatId) return;

    setPattern(patternId);
    localStorage.setItem(LOCAL_PATTERN_KEY(chatId), patternId);

    // Apply with current theme + wallpaper from refs
    applyAll({ themeKey: themeRef.current, wallpaper: wallpaperRef.current, pattern: patternId });

    // Persist (store as "pattern:xxx" in custom_url slot for backwards compat)
    try {
      const currentUser = useAuthStore.getState().dbUser;
      if (currentUser) {
        await supabase.from('chat_wallpapers').upsert({
          chat_id: chatId,
          set_by: currentUser.id,
          custom_url: `pattern:${patternId}`,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'chat_id,set_by' });
        queryClient.invalidateQueries(['chat_wallpapers', chatId, currentUser.id]);
      }
    } catch (e) { console.error('[ChatTheme] selectPattern save failed', e); }
  }, [applyAll, queryClient, setPattern]);

  const value = {
    chatTheme: currentChatTheme,
    chatWallpaper: currentWallpaper,
    chatThemes,
    chatPatterns,
    currentPattern,
    selectTheme,
    selectPattern,
    selectWallpaper,
    setChatId,
    loading,
    currentThemeData: chatThemes[currentChatTheme] || chatThemes.classic_purple,
    refreshTheme,
    setScrollPercentage,
    currentChatId,
  };

  return (
    <ChatThemeContext.Provider value={value}>
      {children}
    </ChatThemeContext.Provider>
  );
};