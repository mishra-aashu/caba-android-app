import React, { createContext, useContext, useState, useEffect } from 'react';
import { useSupabase } from './SupabaseContext';
import useUserStore from '../store/userStore';

// Create the Emoji Style Context
const EmojiStyleContext = createContext();

// Emoji Style Provider Component
export const EmojiStyleProvider = ({ children }) => {
  // Default emoji style is 'apple' as requested
  const [emojiStyle, setEmojiStyle] = useState('apple');
  const [loading, setLoading] = useState(true);
  const { supabase } = useSupabase();

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
    } catch (error) {
      console.error('Error loading emoji style:', error);
    } finally {
      setLoading(false);
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

  // Initialize on mount
  useEffect(() => {
    loadEmojiStyle();
  }, []);

  // Context value
  const value = {
    emojiStyle,
    updateEmojiStyle,
    loading,
    isNative: emojiStyle === 'native',
    isTwitter: emojiStyle === 'twitter',
    isGoogle: emojiStyle === 'google',
    isApple: emojiStyle === 'apple',
    isFacebook: emojiStyle === 'facebook'
  };

  return (
    <EmojiStyleContext.Provider value={value}>
      {children}
    </EmojiStyleContext.Provider>
  );
};

// Custom hook to use the Emoji Style Context
export const useEmojiStyle = () => {
  const context = useContext(EmojiStyleContext);
  if (!context) {
    throw new Error('useEmojiStyle must be used within an EmojiStyleProvider');
  }
  return context;
};

export default EmojiStyleContext;