import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../config/supabase';
import useAuthStore from '../store/authStore';
import { useQueryClient } from '@tanstack/react-query';
import { ChatThemeContext, chatThemes, chatPatterns } from './ChatThemeContext';
import { useTheme } from './ThemeContext';
import { colorizeSVG } from '../utils/svgColorizer';

// ─── DOM application (synchronous path, no debounce on first call) ──────────

/**
 * Returns the AVERAGE perceptual luminance (0 = black, 1 = white) of every
 * hex colour found inside a CSS colour/gradient string.
 * Handles both 3-digit (#abc) and 6-digit (#aabbcc) hex values.
 * Falls back to 0.5 (neutral) if no hex colours are found.
 */
function getAverageLuminance(cssColorString) {
    if (!cssColorString) return 0.5;
    // Match every #rrggbb or #rgb token in the string (covers gradient stops)
    const hexTokens = cssColorString.match(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g);
    if (!hexTokens || hexTokens.length === 0) return 0.5;

    const luminances = hexTokens.map((hex) => {
        const raw = hex.slice(1);
        const full = raw.length === 3
            ? raw.split('').map(c => c + c).join('')
            : raw;
        const r = parseInt(full.slice(0, 2), 16);
        const g = parseInt(full.slice(2, 4), 16);
        const b = parseInt(full.slice(4, 6), 16);
        // Standard perceptual luminance (ITU-R BT.601)
        return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    });

    return luminances.reduce((sum, l) => sum + l, 0) / luminances.length;
}

function applyThemeToDom({ themeKey, wallpaperUrl, patternId }) {
    const root = document.documentElement;
    const theme = chatThemes[themeKey] || chatThemes['classic-purple'];

    // Set the theme ID attribute so CSS can react to it
    root.setAttribute('data-chat-theme', themeKey);

    const setProp = (name, value) => {
        if (value != null && value !== '') root.style.setProperty(name, value);
        else root.style.removeProperty(name);
    };

    // ── Wallpaper photo ──────────────────────────────────────────────────
    // When set, it sits on top of the CSS-defined gradient
    if (wallpaperUrl) {
        setProp('--chat-bg-image', `url("${wallpaperUrl}")`);
    } else {
        root.style.removeProperty('--chat-bg-image');
    }

    // ── SVG pattern overlay ─────────────────────────────────────────────────
    if (patternId) {
        // ── Pattern colour: contrast with gradient background ──────────────
        // We average the luminance of ALL colour stops in the gradient, not just
        // the first one. This correctly handles multi-stop gradients like:
        //   spring-vibes  (#ecfdf5 → #fef3c7)  avg ≈ 0.93 → LIGHT → dark pattern ✅
        //   classic-purple (#1e1b4b → #2e1065) avg ≈ 0.07 → DARK  → white pattern ✅
        //   pattern_overlay (#6366f1 → #a855f7) avg ≈ 0.35 → DARK  → white pattern ✅
        const effectivelyDark = (() => {
            // 1. Explicit theme category override
            if (theme.category === 'Dark') return true;
            // 2. Global system theme
            const isSystemDark = root.getAttribute('data-theme') === 'dark';
            if (isSystemDark) return true;
            // 3. Fallback for professional/seasonal themes
            return false;
        })();

        // Pattern colour: pure black (#000000) for light themes to ensure
        // maximum visibility, and white (#ffffff) for dark themes.
        const patternColor = effectivelyDark ? '#ffffff' : '#000000';

        // ── Opacity & Blend Mode tuning ──────────────────────────────────────
        // We need MAXIMUM visibility as requested by the user.
        //
        // Light backgrounds (e.g. Minimal Slate, Spring Vibes):
        //   - Dark pattern (#000000) at 0.70 opacity.
        //   - Blend mode 'multiply' for a strong, sharp black ink effect.
        //
        // Dark backgrounds (e.g. Blue/Purple themes):
        //   - White pattern (#ffffff) at 0.35 opacity.
        //   - Blend mode 'screen' to make the white "pop" and glow against dark.
        const opacity = effectivelyDark
            ? (wallpaperUrl ? '0.15' : '0.35')  // dark bg  → white pattern
            : (wallpaperUrl ? '0.10' : '0.15'); // light bg → black pattern (subtle & premium)

        const blendMode = effectivelyDark ? 'screen' : 'multiply';

        setProp('--chat-pattern-color', patternColor);
        setProp('--chat-pattern-opacity', opacity);
        setProp('--chat-pattern-blend', blendMode);
        setProp('--chat-pattern-size', '420px');

        // Async SVG fetch — sets CSS var when ready; component repaints automatically
        (async () => {
            try {
                const response = await fetch(`/assets/${patternId}.svg`);
                if (!response.ok) throw new Error(`Pattern fetch failed: ${response.status}`);
                const svgText = await response.text();
                const dataUri = colorizeSVG(svgText, patternColor);
                setProp('--pattern-url', `url("${dataUri}")`);
            } catch (error) {
                console.error('[ChatTheme] Pattern error:', error);
                root.style.removeProperty('--pattern-url');
            }
        })();
    } else {
        // No pattern — clean up all pattern variables
        [
            '--pattern-url',
            '--chat-pattern-opacity',
            '--chat-pattern-color',
            '--chat-pattern-blend',
            '--chat-pattern-size',
        ].forEach(p => root.style.removeProperty(p));
    }
}

// ─── LocalStorage keys ───────────────────────────────────────────────────────

const LOCAL_THEME_KEY   = (id) => `digidad_chat_theme_${id}`;
const LOCAL_WALLPAPER_KEY = (id) => `digidad_chat_wallpaper_${id}`;
const LOCAL_PATTERN_KEY = (id) => `digidad_chat_pattern_${id}`;

/**
 * readCache — Read persisted theme/wallpaper from localStorage.
 *
 * Storage contract:
 *   LOCAL_THEME_KEY    → themeKey string
 *   LOCAL_WALLPAPER_KEY → photo URL   (mutually exclusive with pattern)
 *   LOCAL_PATTERN_KEY  → pattern id   (mutually exclusive with wallpaper)
 *
 * If neither wallpaper nor pattern key is stored we default to the pattern
 * so the background doesn't look empty on first open.
 */
function readCache(chatId, isDark) {
    const rawTheme    = localStorage.getItem(LOCAL_THEME_KEY(chatId));
    const rawWallpaper = localStorage.getItem(LOCAL_WALLPAPER_KEY(chatId));
    const rawPattern  = localStorage.getItem(LOCAL_PATTERN_KEY(chatId));

    const standardDefault = isDark ? 'cherry-blossom' : 'spring-vibes';
    const themeKey = (rawTheme && chatThemes[rawTheme]) ? rawTheme : standardDefault;

    let wallpaperUrl = null;
    let patternId    = null; // null = no pattern; string = show pattern

    if (rawWallpaper) {
        // Legacy: some old sessions saved "pattern:xxx" into the wallpaper key
        if (rawWallpaper.startsWith('pattern:')) {
            patternId = rawWallpaper.replace('pattern:', '') || 'pattern';
            // Migrate: move to dedicated key and clean up
            localStorage.setItem(LOCAL_PATTERN_KEY(chatId), patternId);
            localStorage.removeItem(LOCAL_WALLPAPER_KEY(chatId));
        } else {
            wallpaperUrl = rawWallpaper;
            // wallpaper is set → no pattern
        }
    } else if (rawPattern) {
        patternId = rawPattern;
    } else {
        // Neither stored → show default pattern so the background isn't blank
        patternId = 'pattern';
    }

    return { themeKey, wallpaperUrl, patternId };
}

// ─── Provider ────────────────────────────────────────────────────────────────

export const ChatThemeProvider = ({ children }) => {
    const queryClient = useQueryClient();
    const { isDark } = useTheme();
    const standardDefault = useMemo(
        () => (isDark ? 'cherry-blossom' : 'spring-vibes'),
        [isDark],
    );

    const [state, setState] = useState({
        chatId:      null,
        themeKey:    standardDefault,
        wallpaperUrl: null,
        patternId:   'pattern',  // Show default pattern on startup
        loading:     true,
    });

    const [scrollPercentage, setScrollPercentage] = useState(0);

    // ── Sync scroll percentage CSS var ──────────────────────────────────────
    useEffect(() => {
        document.documentElement.style.setProperty(
            '--scroll-percentage', scrollPercentage,
        );
    }, [scrollPercentage]);

    // ── Apply theme to DOM whenever state changes ────────────────────────────
    // NOTE: This is intentionally NOT debounced on first call.
    // Debouncing was previously causing the initial render to show the
    // default theme for 100ms before the saved theme applied.
    useEffect(() => {
        applyThemeToDom({
            themeKey:    state.themeKey,
            wallpaperUrl: state.wallpaperUrl,
            patternId:   state.patternId,
        });
    }, [state.themeKey, state.wallpaperUrl, state.patternId]);

    // ── Load theme/wallpaper for a chat ─────────────────────────────────────
    const setChatId = useCallback((chatId) => {
        if (!chatId) {
            setState({
                chatId:      null,
                themeKey:    standardDefault,
                wallpaperUrl: null,
                patternId:   'pattern',
                loading:     false,
            });
            return;
        }

        // 1. Apply cache immediately (synchronous) so the UI isn't blank
        const cached = readCache(chatId, isDark);
        setState({ chatId, ...cached, loading: false });

        // 2. Refresh from DB in the background
        refreshTheme(chatId);
    }, [isDark, standardDefault]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Refresh from Supabase ────────────────────────────────────────────────
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
                }),
            ]);

            setState(prevState => {
                // Guard: ignore if user navigated away
                if (prevState.chatId !== chatId) return prevState;

                const freshTheme = (themeData && chatThemes[themeData])
                    ? themeData
                    : prevState.themeKey;

                let freshWallpaper = prevState.wallpaperUrl;
                let freshPattern   = prevState.patternId;

                if (wallpaperData !== undefined) {
                    if (wallpaperData && wallpaperData.startsWith('pattern:')) {
                        // Pattern stored as "pattern:xxx" in custom_url
                        freshPattern   = wallpaperData.replace('pattern:', '') || 'pattern';
                        freshWallpaper = null;
                        localStorage.setItem(LOCAL_PATTERN_KEY(chatId), freshPattern);
                        localStorage.removeItem(LOCAL_WALLPAPER_KEY(chatId));
                    } else if (wallpaperData) {
                        // Real photo URL
                        freshWallpaper = wallpaperData;
                        freshPattern   = null;  // ← key fix: clear pattern when wallpaper loads
                        localStorage.setItem(LOCAL_WALLPAPER_KEY(chatId), freshWallpaper);
                        localStorage.removeItem(LOCAL_PATTERN_KEY(chatId));
                    } else {
                        // Explicitly cleared in DB → fall back to pattern
                        freshWallpaper = null;
                        freshPattern   = prevState.patternId || 'pattern';
                        localStorage.removeItem(LOCAL_WALLPAPER_KEY(chatId));
                    }
                }

                if (themeData && chatThemes[themeData]) {
                    localStorage.setItem(LOCAL_THEME_KEY(chatId), themeData);
                }

                return {
                    ...prevState,
                    themeKey:    freshTheme,
                    wallpaperUrl: freshWallpaper,
                    patternId:   freshPattern,
                };
            });
        } catch (e) {
            console.warn('[ChatTheme] refreshTheme failed:', e);
        }
    }, [queryClient]);

    // ── Select theme ─────────────────────────────────────────────────────────
    const selectTheme = useCallback(async (themeKey) => {
        if (!chatThemes[themeKey] || !state.chatId) return;

        // Apply immediately — don't wait for the DB round-trip
        setState(prev => ({ ...prev, themeKey }));
        localStorage.setItem(LOCAL_THEME_KEY(state.chatId), themeKey);

        try {
            const currentUser = useAuthStore.getState().dbUser;
            if (currentUser) {
                await supabase.from('chat_themes').upsert(
                    { chat_id: state.chatId, theme_name: themeKey, set_by: currentUser.id },
                    { onConflict: 'chat_id,set_by' },
                );
                queryClient.invalidateQueries({ queryKey: ['chat_themes', state.chatId] });
            }
        } catch (e) {
            console.error('[ChatTheme] selectTheme save failed', e);
        }
    }, [state.chatId, queryClient]);

    // ── Select photo wallpaper ───────────────────────────────────────────────
    const selectWallpaper = useCallback(async (wallpaperId, customUrl = null, wallpaperUrl = null) => {
        if (!state.chatId) return;

        const finalWallpaper = customUrl || wallpaperUrl || null;

        // Clear pattern when a wallpaper is set — they are mutually exclusive
        setState(prev => ({ ...prev, wallpaperUrl: finalWallpaper, patternId: null }));

        if (finalWallpaper) {
            localStorage.setItem(LOCAL_WALLPAPER_KEY(state.chatId), finalWallpaper);
        } else {
            localStorage.removeItem(LOCAL_WALLPAPER_KEY(state.chatId));
        }
        // Always clear pattern key when switching to photo
        localStorage.removeItem(LOCAL_PATTERN_KEY(state.chatId));

        try {
            const currentUser = useAuthStore.getState().dbUser;
            if (!currentUser) return;

            await supabase.from('chat_wallpapers').upsert(
                {
                    chat_id:     state.chatId,
                    set_by:      currentUser.id,
                    custom_url:  customUrl,
                    wallpaper_id: wallpaperId,
                },
                { onConflict: 'chat_id,set_by' },
            );
            queryClient.invalidateQueries({ queryKey: ['chat_wallpapers', state.chatId] });
        } catch (e) {
            console.error('[ChatTheme] selectWallpaper save failed', e);
        }
    }, [state.chatId, queryClient]);

    // ── Select SVG pattern ───────────────────────────────────────────────────
    const selectPattern = useCallback(async (patternId) => {
        if (!state.chatId) return;

        // Clear wallpaper when a pattern is set — they are mutually exclusive
        setState(prev => ({ ...prev, patternId, wallpaperUrl: null }));
        localStorage.setItem(LOCAL_PATTERN_KEY(state.chatId), patternId);
        // Always clear wallpaper key when switching to pattern
        localStorage.removeItem(LOCAL_WALLPAPER_KEY(state.chatId));

        try {
            const currentUser = useAuthStore.getState().dbUser;
            if (currentUser) {
                await supabase.from('chat_wallpapers').upsert(
                    {
                        chat_id:    state.chatId,
                        set_by:     currentUser.id,
                        custom_url: `pattern:${patternId}`,
                    },
                    { onConflict: 'chat_id,set_by' },
                );
                queryClient.invalidateQueries({ queryKey: ['chat_wallpapers', state.chatId] });
            }
        } catch (e) {
            console.error('[ChatTheme] selectPattern save failed', e);
        }
    }, [state.chatId, queryClient]);

    // ── Context value ────────────────────────────────────────────────────────
    const value = {
        chatTheme:       state.themeKey,
        chatWallpaper:   state.wallpaperUrl,
        currentPattern:  state.patternId,
        loading:         state.loading,
        currentChatId:   state.chatId,
        chatThemes,
        chatPatterns,
        selectTheme,
        selectPattern,
        selectWallpaper,
        setChatId,
        refreshTheme,
        setScrollPercentage,
        currentThemeData: chatThemes[state.themeKey] || chatThemes['classic-purple'],
    };

    return (
        <ChatThemeContext.Provider value={value}>
            {children}
        </ChatThemeContext.Provider>
    );
};
