class SessionManager {
  constructor(supabase) {
    this.supabase = supabase;
    this.sessionListeners = new Set();
    this.currentUser = null;
  }

  async initialize() {
    try {
      const storedUser = this.getStoredUser();
      if (storedUser) {
        this.currentUser = storedUser;
        this.notifyListeners();
        return storedUser;
      }
      return null;
    } catch (error) {
      console.error('Session manager initialization failed:', error);
      return null;
    }
  }

  storeUser(user) {
    if (user) {
      try {
        sessionStorage.setItem('_auth_user', JSON.stringify(user));
      } catch (error) {
        console.error('Error storing user:', error);
      }
    }
  }

  getStoredUser() {
    try {
      const stored = sessionStorage.getItem('_auth_user');
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('Error retrieving stored user:', error);
      return null;
    }
  }

  clearStoredUser() {
    try {
      sessionStorage.removeItem('_auth_user');
    } catch (error) {
      console.error('Error clearing stored user:', error);
    }
  }

  async signInWithPhonePassword(phone, password) {
    try {
      const { data: userData, error: userError } = await this.supabase
        .from('users')
        .select('*')
        .eq('phone', phone)
        .single();

      if (userError || !userData) {
        return { success: false, error: 'Phone number not registered' };
      }

      if (userData.password !== password) {
        return { success: false, error: 'Invalid password' };
      }

      if (!userData.email_confirmed_at) {
        return { success: false, error: 'Email not confirmed. Please check your email and confirm your account.' };
      }

      this.currentUser = userData;
      this.storeUser(userData);
      this.notifyListeners();

      return { success: true, data: { user: userData } };
    } catch (error) {
      console.error('Phone sign in error:', error);
      return { success: false, error: error.message };
    }
  }

  async signUpWithPhonePassword(phone, password, name, email) {
    try {
      const { data: dbUser, error: dbError } = await this.supabase
        .from('users')
        .insert([{
          phone: phone,
          name: name,
          password: password,
          email: email,
          email_confirmed_at: new Date().toISOString(),
          is_online: true,
          created_at: new Date().toISOString(),
          last_seen: new Date().toISOString()
        }])
        .select()
        .single();

      if (dbError) throw dbError;

      this.currentUser = dbUser;
      this.storeUser(dbUser);
      this.notifyListeners();

      return { success: true, data: { user: dbUser } };
    } catch (error) {
      console.error('Phone sign up error:', error);
      return { success: false, error: error.message };
    }
  }

  async signInWithGoogle() {
    try {
      const { data, error } = await this.supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/CaBa/auth-callback.html`
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
              password: null,
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
        this.storeUser(userData);
        this.notifyListeners();

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
      await this.supabase.auth.signOut();
      this.currentUser = null;
      this.clearStoredUser();
      this.notifyListeners();
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