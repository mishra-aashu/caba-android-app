import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useSupabase } from './SupabaseContext';
import { useUserTheme } from '../hooks/useThemesData';
import { useQueryClient } from '@tanstack/react-query';
import { ThemeContext } from './ThemeContext';

// Theme Provider Component
export const ThemeProvider = ({ children }) => {
  const { user } = useAuth();
  const { supabase } = useSupabase();

  // Get initial theme from localStorage or default to 'light'
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    return savedTheme || 'light';
  });

  const queryClient = useQueryClient();
  const { data: dbTheme } = useUserTheme(user?.id);

  // Sync theme from DB on mount/login
  useEffect(() => {
    if (dbTheme && dbTheme !== theme) {
      setTheme(dbTheme);
      localStorage.setItem('theme', dbTheme);
    }
  }, [dbTheme]);

  // Toggle between light and dark themes
  const toggleTheme = async () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);

    // Save to DB if logged in
    if (user?.id) {
      try {
        const { error } = await supabase
          .from('user_themes')
          .upsert({
            user_id: user.id,
            theme_id: newTheme,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id' });

        if (error) throw error;
        // Invalidate cache directly so next reload pulls the fresh theme
        queryClient.invalidateQueries(['user_themes', user.id]);
      } catch (err) {
        console.error('Error saving user theme:', err);
      }
    }
  };

  // Apply theme to document when theme changes
  useEffect(() => {
    // Set data-theme attribute for CSS variables
    document.documentElement.setAttribute('data-theme', theme);

    // Also set body class for backward compatibility
    if (theme === 'dark') {
      document.body.classList.add('dark-mode');
      document.body.classList.remove('light-mode');
    } else {
      document.body.classList.add('light-mode');
      document.body.classList.remove('dark-mode');
    }

    // Save to localStorage (fast fallback)
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Context value
  const value = {
    theme,
    setTheme,
    toggleTheme,
    isDark: theme === 'dark',
    isLight: theme === 'light'
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};