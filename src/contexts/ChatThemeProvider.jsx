import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../config/supabase';
import useAuthStore from '../store/authStore';
import { useQueryClient } from '@tanstack/react-query';
import { ChatThemeContext, chatThemes, chatPatterns } from './ChatThemeContext';
import { useTheme } from './ThemeContext';
// [FIX #3] Import colorizeSVG properly and use it directly instead of window.colorizeSVG
import { colorizeSVG } from '../utils/svgColorizer';


// ─── Pure function: applies theme vars to DOM ───
function applyThemeToDom({
    themeKey,
    wallpaperUrl,
    patternId,
}) {
    const root = document.documentElement;
    const theme = chatThemes[themeKey] || chatThemes.classic_purple;

    const setProp = (name, value) => {
        if (value != null && value !== '') root.style.setProperty(name, value);
        else root.style.removeProperty(name);
    };

    // 1. Core Data Attribute
    const chatThemeAttr = themeKey.replace(/_/g, '-');
    root.setAttribute('data-chat-theme', chatThemeAttr);
    document.body.setAttribute('data-chat-theme', chatThemeAttr);

    const isDarkMode = root.getAttribute('data-theme') === 'dark';

    // 2. Wallpaper & Base Background
    if (wallpaperUrl) {
        setProp('--chat-bg-image', `url("${wallpaperUrl}")`);
    } else {
        root.style.removeProperty('--chat-bg-image');
    }

    setProp('--chat-bg-gradient', theme.background);
    setProp('--chat-bg-base', theme.backgroundBase || (isDarkMode ? '#0b141a' : '#e5ddd5'));

    // 3. Message Bubble Styles
    const mapSubProps = (prefix, obj) => {
        if (!obj) return;
        setProp(`${prefix}-bg`, obj.background || obj.bg);
        setProp(`${prefix}-text`, obj.text);
        setProp(`${prefix}-border`, obj.border);
        setProp(`${prefix}-shadow`, obj.shadow);
    };

    mapSubProps('--sent-message', theme.sentMessage);
    mapSubProps('--received-message', theme.receivedMessage);

    // Header/Input overrides
    if (theme.header) {
        setProp('--chat-header-bg', theme.header.background);
        setProp('--chat-header-text', theme.header.text);
        setProp('--chat-header-icon-color', theme.header.iconColor);
    } else {
        ['--chat-header-bg', '--chat-header-text', '--chat-header-icon-color'].forEach(p => root.style.removeProperty(p));
    }

    if (theme.input) {
        setProp('--chat-input-bg', theme.input.background);
        setProp('--chat-input-text', theme.input.text);
        setProp('--chat-input-icon-color', theme.input.iconColor);
    } else {
        ['--chat-input-bg', '--chat-input-text', '--chat-input-icon-color'].forEach(p => root.style.removeProperty(p));
    }

    // 4. Pattern Management
    if (patternId) {
        // [FIX #6] Improved dark background detection
        // Previously only checked 6 hardcoded hex values — missed CSS gradients and rgb values
        const isDarkBackground = (bg) => {
            if (!bg) return isDarkMode;
            const lower = bg.toLowerCase();

            // Check for obvious dark keywords
            const darkKeywords = ['#000', '#111', '#222', '#1a1', '#0a0', '#0b1', '#0f1', 'black', 'dark'];
            if (darkKeywords.some(kw => lower.includes(kw))) return true;

            // Try to extract first hex color from gradient
            const hexMatch = lower.match(/#([0-9a-f]{6}|[0-9a-f]{3})\b/);
            if (hexMatch) {
                const hex = hexMatch[1];
                const fullHex = hex.length === 3
                    ? hex.split('').map(c => c + c).join('')
                    : hex;
                const r = parseInt(fullHex.substr(0, 2), 16);
                const g = parseInt(fullHex.substr(2, 2), 16);
                const b = parseInt(fullHex.substr(4, 2), 16);
                // Perceived luminance formula
                const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
                return luminance < 0.45;
            }

            // Check for rgb values
            const rgbMatch = lower.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
            if (rgbMatch) {
                const r = parseInt(rgbMatch[1]);
                const g = parseInt(rgbMatch[2]);
                const b = parseInt(rgbMatch[3]);
                const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
                return luminance < 0.45;
            }

            return isDarkMode;
        };

        const effectivelyDark = theme.category === 'Dark' || isDarkBackground(theme.background) || isDarkMode;
        const patternColor = effectivelyDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.12)';

        setProp('--chat-pattern-color', patternColor);
        setProp('--chat-pattern-opacity', wallpaperUrl ? '0.04' : '0.1');
        setProp('--chat-pattern-blend', 'overlay');
        setProp('--chat-pattern-size', '420px');

        // Load and Apply SVG Pattern
        (async () => {
            try {
                const response = await fetch(`/assets/${patternId}.svg`);
                if (!response.ok) {
                    console.warn(`[ChatTheme] Pattern fetch failed: ${response.status}`);
                    setProp('--pattern-url', `url("/assets/${patternId}.svg")`);
                    return;
                }

                const svgText = await response.text();
                let dataUri;

                // [FIX #3] Use imported colorizeSVG directly instead of checking window.colorizeSVG
                if (typeof colorizeSVG === 'function') {
                    dataUri = colorizeSVG(svgText, patternColor);
                } else {
                    // Fallback: manual SVG colorization
                    const colorizedSvg = svgText.includes('<style')
                        ? svgText.replace(/fill:[^;]*;/g, `fill:${patternColor};`)
                        : svgText.replace('<svg', `<svg fill="${patternColor}"`);

                    const base64Svg = window.btoa(unescape(encodeURIComponent(colorizedSvg)));
                    dataUri = `data:image/svg+xml;base64,${base64Svg}`;
                }

                setProp('--pattern-url', `url("${dataUri}")`);
            } catch (err) {
                console.warn('[ChatTheme] Pattern load failed:', err);
                // Fallback to direct URL
                setProp('--pattern-url', `url("/assets/${patternId}.svg")`);
            }
        })();
    } else {
        ['--pattern-url', '--chat-pattern-opacity', '--chat-pattern-color', '--chat-pattern-blend', '--chat-pattern-size']
            .forEach(p => root.style.removeProperty(p));
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

// ─── Provider ───
export const ChatThemeProvider = ({ children }) => {
    const queryClient = useQueryClient();
    const { isDark } = useTheme();

    const standardDefault = isDark ? 'cherry_blossom' : 'spring_vibes';

    const themeRef = useRef(standardDefault);
    const wallpaperRef = useRef(null);
    const patternRef = useRef('pattern');
    const chatIdRef = useRef(null);

    const [currentChatTheme, _setTheme] = useState(standardDefault);
    const [currentWallpaper, _setWallpaper] = useState(null);
    const [currentPattern, _setPattern] = useState('pattern');
    const [currentChatId, _setChatId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [scrollPercentage, setScrollPercentage] = useState(0);

    const setTheme = useCallback((v) => { themeRef.current = v; _setTheme(v); }, []);
    const setWallpaper = useCallback((v) => { wallpaperRef.current = v; _setWallpaper(v); }, []);
    const setPattern = useCallback((v) => { patternRef.current = v; _setPattern(v); }, []);
    const setChatIdState = useCallback((v) => { chatIdRef.current = v; _setChatId(v); }, []);

    useEffect(() => {
        document.documentElement.style.setProperty('--scroll-percentage', scrollPercentage);
    }, [scrollPercentage]);

    const applyAll = useCallback(({
        themeKey = themeRef.current,
        wallpaper = wallpaperRef.current,
        pattern = patternRef.current,
    } = {}) => {
        applyThemeToDom({
            themeKey,
            wallpaperUrl: wallpaper,
            patternId: pattern,
        });
    }, []);

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

            setTheme(freshTheme);
            setWallpaper(freshWallpaper);
            setPattern(freshPattern);

            applyAll({ themeKey: freshTheme, wallpaper: freshWallpaper, pattern: freshPattern });

        } catch (e) {
            console.warn('[ChatTheme] refreshTheme failed:', e);
        }
    }, [queryClient, applyAll, setTheme, setWallpaper, setPattern]);

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

        // 1. Apply cache SYNCHRONOUSLY — zero blink
        const { themeKey, wallpaper, pattern } = readCache(chatId, isDark);
        setTheme(themeKey);
        setWallpaper(wallpaper);
        setPattern(pattern);
        applyAll({ themeKey, wallpaper, pattern });
        setLoading(false);

        // 2. Refresh from DB in background
        // [FIX #7] Simplified debounce — use ref instead of localStorage
        refreshTheme(chatId);
    }, [applyAll, refreshTheme, setTheme, setWallpaper, setPattern, setChatIdState, isDark, standardDefault]);

    // [FIX #2] TanStack Query v5 requires object syntax for invalidateQueries
    // Previously: queryClient.invalidateQueries(['chat_themes', chatId])
    // v5 syntax: queryClient.invalidateQueries({ queryKey: ['chat_themes', chatId] })

    const selectTheme = useCallback(async (themeKey, chatIdOverride) => {
        if (!chatThemes[themeKey]) return;
        const chatId = chatIdOverride || chatIdRef.current;
        if (!chatId) { console.error('[ChatTheme] No chatId for selectTheme'); return; }

        setTheme(themeKey);
        localStorage.setItem(LOCAL_THEME_KEY(chatId), themeKey);

        applyAll({ themeKey, wallpaper: wallpaperRef.current, pattern: patternRef.current });

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
                // [FIX #2] v5 object syntax
                queryClient.invalidateQueries({ queryKey: ['chat_themes', chatId] });
            }
        } catch (e) { console.error('[ChatTheme] selectTheme save failed', e); }
    }, [applyAll, queryClient, setTheme]);

    const selectWallpaper = useCallback(async (wallpaperId, customUrl = null, wallpaperUrl = null) => {
        const chatId = chatIdRef.current;
        if (!chatId) return;

        let finalWallpaper = null;

        if (wallpaperId === null && !customUrl) {
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
        applyAll({ themeKey: themeRef.current, wallpaper: finalWallpaper, pattern: patternRef.current });

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
            // [FIX #2] v5 object syntax
            queryClient.invalidateQueries({ queryKey: ['chat_wallpapers', chatId] });
        } catch (e) { console.error('[ChatTheme] selectWallpaper save failed', e); }
    }, [applyAll, queryClient, setWallpaper]);

    const selectPattern = useCallback(async (patternId) => {
        const chatId = chatIdRef.current;
        if (!chatId) return;

        setPattern(patternId);
        localStorage.setItem(LOCAL_PATTERN_KEY(chatId), patternId);

        applyAll({ themeKey: themeRef.current, wallpaper: wallpaperRef.current, pattern: patternId });

        try {
            const currentUser = useAuthStore.getState().dbUser;
            if (currentUser) {
                await supabase.from('chat_wallpapers').upsert({
                    chat_id: chatId,
                    set_by: currentUser.id,
                    custom_url: `pattern:${patternId}`,
                    updated_at: new Date().toISOString(),
                }, { onConflict: 'chat_id,set_by' });
                // [FIX #2] v5 object syntax
                queryClient.invalidateQueries({ queryKey: ['chat_wallpapers', chatId, currentUser.id] });
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