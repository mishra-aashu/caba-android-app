import React, { useState, useEffect } from 'react';
import { useSupabase } from './SupabaseContext';
import useUserStore from '../store/userStore';
import { EmojiStyleContext } from './EmojiStyleContext';

// Emoji Style Provider Component
export const EmojiStyleProvider = ({ children }) => {
  // Default emoji style is 'apple' as requested
  const [emojiStyle, setEmojiStyle] = useState('apple');
  const [preferredEmojis, setPreferredEmojis] = useState(['❤️', '👍', '🔥', '😂', '😮', '😢', '🙏']);
  const [loading, setLoading] = useState(true);
  const [emojiMap, setEmojiMap] = useState(null);
  const [mapLoading, setMapLoading] = useState(true);
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
      const response = await fetch(`${baseUrl}assets/emojis/emoji-map.json`);
      if (!response.ok) throw new Error('Failed to load emoji map');
      const data = await response.json();
      setEmojiMap(data);
    } catch (error) {
      console.error('Error loading emoji map:', error);
    } finally {
      setMapLoading(false);
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
    mapLoading
  };

  return (
    <EmojiStyleContext.Provider value={value}>
      {children}
    </EmojiStyleContext.Provider>
  );
};