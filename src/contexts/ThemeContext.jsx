import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useSupabase } from './SupabaseContext';

// Create the Theme Context
const ThemeContext = createContext();

// Theme Provider Component
export const ThemeProvider = ({ children }) => {
  const { user } = useAuth();
  const { supabase } = useSupabase();

  // Get initial theme from localStorage or default to 'light'
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    return savedTheme || 'light';
  });

  // Sync theme from DB on mount/login
  useEffect(() => {
    const fetchUserTheme = async () => {
      if (!user?.id) return;

      try {
        const { data, error } = await supabase
          .from('user_themes')
          .select('theme_id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) throw error;

        if (data?.theme_id && data.theme_id !== theme) {
          setTheme(data.theme_id);
          localStorage.setItem('theme', data.theme_id);
        }
      } catch (err) {
        console.error('Error fetching user theme:', err);
      }
    };

    fetchUserTheme();
  }, [user?.id, supabase]);

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

// Custom hook to use the Theme Context
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export default ThemeContext;