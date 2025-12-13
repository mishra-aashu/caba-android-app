import React, { useState, useEffect } from 'react';
import { useSupabase } from '../../contexts/SupabaseContext';
import { useNavigate, Link } from 'react-router-dom';
import '../../styles/auth.css';

const ResetPassword = () => {
  const { supabase } = useSupabase();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [isValidRecovery, setIsValidRecovery] = useState(false);

  useEffect(() => {
    // Check for Supabase auth recovery parameters in URL hash or query params
    const hash = window.location.hash;
    const searchParams = new URLSearchParams(window.location.search);
    const recoveryParam = searchParams.get('recovery');

    console.log('ResetPassword: Current hash:', hash);
    console.log('ResetPassword: Recovery param:', recoveryParam);

    let hashParams;
    let source = '';

    if (hash && hash.includes('access_token')) {
      // Parameters are in hash
      hashParams = new URLSearchParams(hash.substring(1));
      source = 'hash';
    } else if (recoveryParam) {
      // Parameters are encoded in query param
      hashParams = new URLSearchParams(decodeURIComponent(recoveryParam));
      source = 'query';
    }

    if (hashParams) {
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const type = hashParams.get('type');

      console.log(`ResetPassword: Extracted params from ${source}:`, { accessToken: !!accessToken, refreshToken: !!refreshToken, type });

      if (type === 'recovery' && accessToken && refreshToken) {
        console.log('ResetPassword: Setting recovery session...');
        // Set the session with the recovery tokens
        supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        }).then(({ data, error }) => {
          if (error) {
            console.error('Error setting recovery session:', error);
            setMessage({ text: 'Invalid or expired reset link', type: 'error' });
          } else {
            console.log('Recovery session set successfully');
            setIsValidRecovery(true);
            setMessage({ text: 'Please enter your new password', type: 'success' });
            // Clear the query params and hash from URL for security
            window.history.replaceState(null, '', window.location.pathname);
          }
        });
      } else {
        console.log('ResetPassword: Invalid recovery parameters');
        setMessage({ text: 'Invalid reset link. Please request a new password reset.', type: 'error' });
      }
    } else {
      console.log('ResetPassword: No recovery parameters found');
      setMessage({ text: 'Invalid reset link. Please request a new password reset.', type: 'error' });
    }
  }, [supabase.auth]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate passwords
    if (password.length < 6) {
      setMessage({ text: 'Password must be at least 6 characters', type: 'error' });
      return;
    }

    if (password !== confirmPassword) {
      setMessage({ text: 'Passwords do not match', type: 'error' });
      return;
    }

    setLoading(true);
    setMessage({ text: '', type: '' });

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) throw error;

      setMessage({ text: 'Password updated successfully! Redirecting to login...', type: 'success' });

      // Sign out and redirect to login
      setTimeout(async () => {
        await supabase.auth.signOut();
        navigate('/login');
      }, 2000);

    } catch (error) {
      console.error('Error updating password:', error);
      setMessage({ text: error.message || 'Failed to update password. Please try again.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const togglePassword = (inputId) => {
    const input = document.getElementById(inputId);
    const btn = input.nextElementSibling;

    if (input.type === 'password') {
      input.type = 'text';
      if (btn) btn.querySelector('.eye-icon i').className = 'fas fa-eye-slash';
    } else {
      input.type = 'password';
      if (btn) btn.querySelector('.eye-icon i').className = 'fas fa-eye';
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        {/* App Header */}
        <div className="auth-header">
          <div className="app-logo">
            <svg width="80" height="80" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="35" fill="var(--primary-color)" />
              <text x="40" y="52" fontSize="35" fill="white" textAnchor="middle" fontWeight="bold">DD</text>
            </svg>
          </div>
          <h1 className="app-name">DigiDad</h1>
          <p className="app-tagline">Reset your password</p>
        </div>

        {/* Reset Password Form */}
        <form id="resetPasswordForm" className="auth-form" onSubmit={handleSubmit}>
          <h2>Reset Password</h2>
          <p className="form-subtitle">Enter your new password</p>

          <div className="input-group">
            <label htmlFor="password">New Password</label>
            <div className="password-input">
              <input
                type="password"
                id="password"
                placeholder="Enter new password"
                required
                minLength="6"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={!isValidRecovery}
              />
              <button
                type="button"
                className="toggle-password"
                onClick={() => togglePassword('password')}
                disabled={!isValidRecovery}
              >
                <span className="eye-icon"><i className="fas fa-eye"></i></span>
              </button>
            </div>
            <small className="input-hint">At least 6 characters</small>
          </div>

          <div className="input-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <div className="password-input">
              <input
                type="password"
                id="confirmPassword"
                placeholder="Confirm new password"
                required
                minLength="6"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={!isValidRecovery}
              />
              <button
                type="button"
                className="toggle-password"
                onClick={() => togglePassword('confirmPassword')}
                disabled={!isValidRecovery}
              >
                <span className="eye-icon"><i className="fas fa-eye"></i></span>
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={loading || !isValidRecovery}
          >
            <span className="btn-text">{loading ? 'Updating...' : 'Update Password'}</span>
            {loading && <span className="btn-loader" style={{ display: 'inline-block' }}>
              <div className="spinner"></div>
            </span>}
          </button>

          <div id="message" className="message" style={{ display: message.text ? 'block' : 'none' }}>
            {message.text}
          </div>
        </form>

        <div className="auth-switch">
          Remember your password? <Link to="/login">Login</Link>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;