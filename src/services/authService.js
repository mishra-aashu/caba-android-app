import SessionManager from './sessionManager';

class AuthService {
  constructor(supabase) {
    this.supabase = supabase;
    this.sessionManager = new SessionManager(supabase);
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      await this.sessionManager.initialize();
      this.initialized = true;
      console.log('Auth service initialized');
    } catch (error) {
      console.error('Auth service initialization failed:', error);
    }
  }

  async authenticateWithPhone(phone, password) {
    return await this.sessionManager.signInWithPhonePassword(phone, password);
  }

  async signUpWithPhone(phone, password, name) {
    return await this.sessionManager.signUpWithPhonePassword(phone, password, name);
  }

  async signOut() {
    return await this.sessionManager.signOut();
  }

  getUser() {
    return this.sessionManager.getUser();
  }

  isAuthenticated() {
    return this.sessionManager.isAuthenticated();
  }

  onAuthStateChange(callback) {
    return this.sessionManager.addListener(callback);
  }
}

export default AuthService;
