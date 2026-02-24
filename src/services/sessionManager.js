import { logUserActivity } from '../utils/activityLogger';
import { getRedirectUrl } from '../utils/authUtils';

class SessionManager {
  constructor(supabase) {
    this.supabase = supabase;
    this.sessionListeners = new Set();
    this.currentUser = null;
  }

  async initialize() {
    try {
      const { data: { session }, error } = await this.supabase.auth.getSession();
      if (error) throw error;

      if (session?.user) {
        // Fetch full profile from users table
        const { data: userData, error: dbError } = await this.supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (!dbError && userData) {
          this.currentUser = userData;
          this.notifyListeners();
          return userData;
        }
      }
      return null;
    } catch (error) {
      console.error('Session manager initialization failed:', error);
      return null;
    }
  }

  // sessionStorage methods removed to prevent Auth desync.
  // We rely on Supabase session persistence and useAuthStore.

  // Legacy Phone+Password Auth methods were removed for security.
  // We now use pure Google OAuth with phone number linking.


  async signInWithGoogle() {
    try {
      const { data, error } = await this.supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: getRedirectUrl(),
          flowType: 'pkce'
        }
      });

      if (error) {
        console.error('Google sign in error:', error);
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (error) {
      console.error('Google sign in error:', error);
      return { success: false, error: error.message };
    }
  }

  async handleGoogleCallback() {
    try {
      const { data: { user, session }, error } = await this.supabase.auth.getSession();

      if (error) {
        console.error('Google callback error:', error);
        return { success: false, error: error.message };
      }

      if (user && session) {
        const { data: existingUser, error: dbError } = await this.supabase
          .from('users')
          .select('*')
          .eq('email', user.email)
          .single();

        let userData;

        if (dbError && dbError.code === 'PGRST116') {
          const { data: newUser, error: createError } = await this.supabase
            .from('users')
            .insert([{
              id: user.id,
              email: user.email,
              name: user.user_metadata?.full_name || user.email.split('@')[0],

              phone: user.user_metadata?.phone || null,

              email_confirmed_at: new Date().toISOString(),
              is_online: true,
              created_at: new Date().toISOString(),
              last_seen: new Date().toISOString()
            }])
            .select()
            .single();

          if (createError) {
            console.error('Error creating Google user:', createError);
            return { success: false, error: 'Failed to create user account' };
          }

          userData = newUser;
        } else if (existingUser) {
          const { data: updatedUser, error: updateError } = await this.supabase
            .from('users')
            .update({
              is_online: true,
              last_seen: new Date().toISOString()
            })
            .eq('id', existingUser.id)
            .select()
            .single();

          userData = updatedUser || existingUser;
        } else {
          return { success: false, error: 'Database error occurred' };
        }

        this.currentUser = userData;
        this.notifyListeners();

        // Log activity
        logUserActivity(userData.id, 'login', { method: 'google' });

        return { success: true, data: { user: userData, session } };
      }

      return { success: false, error: 'No user session found' };
    } catch (error) {
      console.error('Google callback error:', error);
      return { success: false, error: error.message };
    }
  }

  async signOut() {
    try {
      if (this.currentUser) {
        await this.supabase
          .from('users')
          .update({ is_online: false, last_seen: new Date().toISOString() })
          .eq('id', this.currentUser.id);
      }

      const userId = this.currentUser?.id;
      await this.supabase.auth.signOut();
      this.currentUser = null;
      this.notifyListeners();

      // Log activity
      if (userId) logUserActivity(userId, 'logout');

      return { success: true };
    } catch (error) {
      console.error('Sign out error:', error);
      return { success: false, error: error.message };
    }
  }

  getUser() {
    return this.currentUser;
  }

  isAuthenticated() {
    return !!this.currentUser;
  }

  addListener(callback) {
    this.sessionListeners.add(callback);
    return () => this.sessionListeners.delete(callback);
  }

  notifyListeners() {
    this.sessionListeners.forEach(callback => {
      try {
        callback({
          user: this.currentUser,
          isAuthenticated: this.isAuthenticated()
        });
      } catch (error) {
        console.error('Session listener error:', error);
      }
    });
  }
}

export default SessionManager;