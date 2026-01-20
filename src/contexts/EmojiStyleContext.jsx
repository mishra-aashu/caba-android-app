import React, { createContext, useContext, useState, useEffect } from 'react';
import { useSupabase } from './SupabaseContext';

// Create the Emoji Style Context
const EmojiStyleContext = createContext();

// Emoji Style Provider Component
export const EmojiStyleProvider = ({ children }) => {
  // Default emoji style is 'native' (device emojis)
  const [emojiStyle, setEmojiStyle] = useState('native');
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

      const { data, error } = await supabase
        .from('users')
        .select('emoji_style')
        .eq('id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
        console.error('Error loading emoji style:', error);
      } else if (data?.emoji_style) {
        setEmojiStyle(data.emoji_style);
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
      if (!user) return false;

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
    isGoogle: emojiStyle === 'google'
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