import { useState, useEffect, useCallback } from 'react';
import { useSupabase } from '../contexts/SupabaseContext';

/**
 * Fixed Authentication hook - handles both localStorage and Supabase session
 */
export const useAuth = () => {
  const { supabase } = useSupabase();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authType, setAuthType] = useState('phone'); // 'phone' or 'google'
  const [supabaseSession, setSupabaseSession] = useState(null);

  const checkAuth = useCallback(async () => {
    try {
      console.log('🔐 [AUTH FIXED] Starting authentication check...');
      
      // Get current Supabase session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.log('❌ [AUTH FIXED] Session error:', sessionError.message);
      } else if (session) {
        console.log('✅ [AUTH FIXED] Found Supabase session for:', session.user?.email);
        setSupabaseSession(session);
      } else {
        console.log('❌ [AUTH FIXED] No Supabase session found');
        setSupabaseSession(null);
      }

      // Check localStorage for user data (for phone login users)
      const currentUser = localStorage.getItem('currentUser');
      const authTypeStored = localStorage.getItem('authType');
      
      console.log('🔐 [AUTH FIXED] localStorage check:', {
        currentUser: !!currentUser,
        authType: authTypeStored
      });
      
      if (currentUser) {
        try {
          const userData = JSON.parse(currentUser);
          if (userData && userData.id) {
            console.log('✅ [AUTH FIXED] Found user in localStorage:', userData.name);
            
            // Update user's online status
            await supabase
              .from('users')
              .update({ 
                is_online: true, 
                last_seen: new Date().toISOString() 
              })
              .eq('id', userData.id);
            
            setUser(userData);
            setIsAuthenticated(true);
            setAuthType(authTypeStored || 'phone');
            setLoading(false);
            return;
          }
        } catch (parseError) {
          console.error('❌ [AUTH FIXED] Error parsing localStorage user:', parseError);
        }
      }
      
      // If we have a Supabase session but no localStorage user, create one
      if (session && session.user) {
        console.log('🔐 [AUTH FIXED] Creating user from Supabase session...');
        
        try {
          // Check if user exists in database
          const { data: existingUser, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single();
          
          let userData;
          
          if (userError || !existingUser) {
            // Create new user
            userData = {
              id: session.user.id,
              name: session.user.user_metadata?.name || 'User',
              email: session.user.email,
              phone: session.user.user_metadata?.phone || '',
              avatar: session.user.user_metadata?.avatar || null,
              about: 'New user',
              is_admin: false,
              is_online: true,
              created_at: new Date().toISOString(),
              last_seen: new Date().toISOString()
            };
            
            const { error: insertError } = await supabase
              .from('users')
              .insert([userData]);
            
            if (insertError) {
              console.error('❌ [AUTH FIXED] Error creating user:', insertError);
            }
          } else {
            // Update existing user
            userData = {
              ...existingUser,
              is_online: true,
              last_seen: new Date().toISOString(),
              avatar: session.user.user_metadata?.avatar || existingUser.avatar
            };
            
            await supabase
              .from('users')
              .update({ 
                is_online: true, 
                last_seen: new Date().toISOString(),
                avatar: session.user.user_metadata?.avatar || existingUser.avatar
              })
              .eq('id', existingUser.id);
          }
          
          // Store in localStorage for consistency
          localStorage.setItem('currentUser', JSON.stringify(userData));
          localStorage.setItem('authType', 'google');
          
          console.log('✅ [AUTH FIXED] Created/updated user from Supabase session');
          
          setUser(userData);
          setIsAuthenticated(true);
          setAuthType('google');
          setLoading(false);
          return;
          
        } catch (dbError) {
          console.error('❌ [AUTH FIXED] Database error:', dbError);
        }
      }
      
      console.log('❌ [AUTH FIXED] No valid authentication found');
      setUser(null);
      setIsAuthenticated(false);
      setAuthType('phone');
      setSupabaseSession(null);
      
    } catch (error) {
      console.error('❌ [AUTH FIXED] Error in auth check:', error);
      setUser(null);
      setIsAuthenticated(false);
      setAuthType('phone');
      setSupabaseSession(null);
    }
    
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    checkAuth();

    // Listen for Supabase auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔐 [AUTH FIXED] Supabase auth state changed:', event, session?.user?.email);
      
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setSupabaseSession(session);
        await checkAuth();
      } else if (event === 'SIGNED_OUT') {
        setSupabaseSession(null);
        localStorage.removeItem('currentUser');
        localStorage.removeItem('authType');
        setUser(null);
        setIsAuthenticated(false);
        setAuthType('phone');
      }
    });

    // Listen for storage changes (for multi-tab support)
    const handleStorageChange = (e) => {
      if (e.key === 'currentUser') {
        console.log('🔐 [AUTH FIXED] localStorage changed, rechecking auth');
        checkAuth();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      subscription.unsubscribe();
    };
  }, [checkAuth, supabase]);

  /**
   * Logout function
   */
  const logout = async () => {
    try {
      console.log('🔐 [AUTH FIXED] Logging out...');
      
      const currentUser = localStorage.getItem('currentUser');
      if (currentUser) {
        const userData = JSON.parse(currentUser);
        
        // Update offline status
        await supabase
          .from('users')
          .update({ 
            is_online: false, 
            last_seen: new Date().toISOString() 
          })
          .eq('id', userData.id);
      }
      
      // Sign out from Supabase if it's a Google user
      const authTypeStored = localStorage.getItem('authType');
      if (authTypeStored === 'google') {
        await supabase.auth.signOut();
      }
      
      localStorage.removeItem('currentUser');
      localStorage.removeItem('authType');
      setUser(null);
      setIsAuthenticated(false);
      setAuthType('phone');
      setSupabaseSession(null);
      
    } catch (error) {
      console.error('❌ [AUTH FIXED] Logout error:', error);
    }
  };

  /**
   * Check if user has admin privileges
   */
  const isAdmin = () => {
    return user?.is_admin || false;
  };

  return {
    user,
    loading,
    isAuthenticated,
    authType,
    supabaseSession,
    logout,
    isAdmin
  };
};

/**
 * Higher-order component for protecting routes
 */
export const withAuth = (Component) => {
  return function AuthenticatedComponent(props) {
    const { user, loading, isAuthenticated } = useAuth();
    
    if (loading) {
      return (
        <div className="auth-loading">
          <div className="loading-spinner"></div>
          <p>Loading...</p>
        </div>
      );
    }
    
    if (!isAuthenticated) {
      window.location.href = '/login';
      return null;
    }
    
    return <Component {...props} user={user} />;
  };
};

/**
 * Hook for getting current user
 */
export const useCurrentUser = () => {
  const { user, loading, isAuthenticated } = useAuth();
  
  return {
    user,
    loading,
    isAuthenticated,
    currentUser: user
  };
};