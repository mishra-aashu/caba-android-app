import React, { useState, useEffect } from 'react';
import { useSupabase } from './SupabaseContext';
import useUserStore from '../store/userStore';
import { EmojiStyleContext } from './EmojiStyleContext';

// Emoji Style Provider Component
export const EmojiStyleProvider = ({ children }) => {
  // Default emoji style is 'apple' as requested
  const [emojiStyle, setEmojiStyle] = useState('apple');
  const [preferredEmojis, setPreferredEmojis] = useState(['❤️', '👍', '😂', '🔥', '😍', '😢', '🙏', '👏', '✔️', '😱', '🙄', '😡', '😭', '🎉', '🤩', '🤔', '💯', '🤝', '🎂', '⚡', '🌈', '✨', '🎈', '🥇', '⚽', '🍕', '🚗', '💡', '📍', '🔒', '✅', '❌', '❓', '❗', '💤', '👋', '🙌', '💪', '😎', '😜']);
  const [loading, setLoading] = useState(true);
  const [emojiMap, setEmojiMap] = useState(null);
  const [mapLoading, setMapLoading] = useState(true);
  const [remoteAssets, setRemoteAssets] = useState({});
  const { supabase } = useSupabase();

  const baseUrl = import.meta.env.BASE_URL || '/';

  // Load emoji style from database
  const loadEmojiStyle = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const userData = await useUserStore.getState().fetchUserIfNeeded(user.id);

      if (userData?.emojiStyle) {
        setEmojiStyle(userData.emojiStyle);
      }
      if (userData?.preferredEmojis) {
        setPreferredEmojis(userData.preferredEmojis);
      }
    } catch (error) {
      console.error('Error loading emoji style:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load emoji mapping JSON from public assets
  const loadEmojiMap = async () => {
    try {
      // Fetchiamcal standardized data
      const response = await fetch(`${baseUrl}assets/emojis/emoji-data.json`);
      if (!response.ok) throw new Error('Failed to load emoji map');
      const data = await response.json();
      
      // Transform array into a faster lookup map (organized by unified hex)
      // We'll also keep categories for the picker
      const mapping = {};
      data.forEach(item => {
        mapping[item.unified.toLowerCase()] = {
          x: item.sheet_x,
          y: item.sheet_y,
          has_apple: item.has_img_apple,
          has_google: item.has_img_google,
          has_twitter: item.has_img_twitter,
          has_facebook: item.has_img_facebook
        };
      });

      setEmojiMap({
        mapping,
        raw: data, // Keep raw for picker categories
        sheets: {
          apple: 'sheet_apple_64.png',
          google: 'sheet_google_64.png',
          twitter: 'sheet_twitter_64.png',
          facebook: 'sheet_facebook_64.png'
        }
      });
    } catch (error) {
      console.error('Error loading emoji map:', error);
    } finally {
      setMapLoading(false);
    }
  };

  // Load remote asset URLs from Supabase table with LocalStorage caching
  const loadRemoteAssets = async () => {
    const CACHE_KEY = 'emoji_assets_cache';
    const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

    try {
      // 1. Check local cache first
      const cachedData = localStorage.getItem(CACHE_KEY);
      if (cachedData) {
        const { mapping, timestamp } = JSON.parse(cachedData);
        if (Date.now() - timestamp < CACHE_EXPIRY) {
          setRemoteAssets(mapping);
          console.log('Emoji Service: Using cached asset mappings.');
          return;
        }
      }

      // 2. If no cache or expired, fetch from Supabase
      console.log('Emoji Service: Fetching fresh asset mappings from Supabase...');
      const { data, error } = await supabase
        .from('emoji_assets')
        .select('vendor, url');
      
      if (error) throw error;

      if (data) {
        const mapping = {};
        data.forEach(item => {
          mapping[item.vendor] = item.url;
        });
        
        setRemoteAssets(mapping);
        
        // Save to cache
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          mapping,
          timestamp: Date.now()
        }));
      }
    } catch (error) {
      console.error('Emoji Service: Failed to load remote emoji assets:', error);
    }
  };

  // Save emoji style to database
  const updateEmojiStyle = async (newStyle) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        // Fallback for local-only state if not logged in
        setEmojiStyle(newStyle);
        return true;
      }

      const { error } = await supabase
        .from('users')
        .update({ emoji_style: newStyle })
        .eq('id', user.id);

      if (error) {
        console.error('Error saving emoji style:', error);
        return false;
      }

      setEmojiStyle(newStyle);
      return true;
    } catch (error) {
      console.error('Error saving emoji style:', error);
      return false;
    }
  };

  const updatePreferredEmojis = async (newEmojis) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setPreferredEmojis(newEmojis);
        return true;
      }

      const { error } = await supabase
        .from('users')
        .update({ preferred_emojis: newEmojis })
        .eq('id', user.id);

      if (error) {
        console.error('Error saving preferred emojis:', error);
        return false;
      }

      setPreferredEmojis(newEmojis);
      return true;
    } catch (error) {
      console.error('Error saving preferred emojis:', error);
      return false;
    }
  };

  // Initialize on mount
  useEffect(() => {
    loadEmojiStyle();
    loadEmojiMap();
    loadRemoteAssets();
  }, []);

  // Context value
  const value = {
    emojiStyle,
    updateEmojiStyle,
    preferredEmojis,
    updatePreferredEmojis,
    loading,
    isNative: emojiStyle === 'native',
    isTwitter: emojiStyle === 'twitter',
    isGoogle: emojiStyle === 'google',
    isApple: emojiStyle === 'apple',
    isFacebook: emojiStyle === 'facebook',
    emojiMap,
    mapLoading,
    remoteAssets
  };

  return (
    <EmojiStyleContext.Provider value={value}>
      {children}
    </EmojiStyleContext.Provider>
  );
};