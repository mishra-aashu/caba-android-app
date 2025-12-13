
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSupabase } from '../../contexts/SupabaseContext';
import '../../styles/auth.css';

const ForgotPassword = () => {
  const { supabase } = useSupabase();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  const formatPhone = (phone) => {
    if (!phone) return '';
    if (phone.startsWith('+')) return phone;
    const cleaned = phone.replace(/\D/g, '');
    return '+' + cleaned;
  };

  const validatePhone = (phone) => {
    if (!phone) return false;
    const phoneRegex = /^(\+)?\d{1,15}$/;
    return phoneRegex.test(phone);
  };

  const getUserByPhone = async (phone) => {
    try {
      // Normalize phone number (remove + if present for database lookup)
      const normalizedPhone = phone.startsWith('+') ? phone.substring(1) : phone;
      
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('phone', normalizedPhone)
        .single();

      if (error) {
        console.error('Error getting user by phone:', error);
        return null;
      }

      return data || null;
    } catch (error) {
      console.error('Error in getUserByPhone:', error);
      return null;
    }
  };

  const maskEmail = (email) => {
    if (!email) return '';

    const [local, domain] = email.split('@');
    if (local.length <= 2) return email;

    const maskedLocal = local[0] + '*'.repeat(local.length - 2) + local[local.length - 1];
    return maskedLocal + '@' + domain;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const formattedPhone = formatPhone(phone.trim());

    // Validation
    if (!validatePhone(formattedPhone)) {
      setMessage({ text: 'Invalid phone number', type: 'error' });
      return;
    }

    setLoading(true);
    setMessage({ text: '', type: '' });

    try {
      // Get user info by phone
      const user = await getUserByPhone(formattedPhone);

      if (!user) {
        setMessage({ text: 'Phone number not registered', type: 'error' });
        setLoading(false);
        return;
      }

      if (!user.email) {
        setMessage({ text: 'No email found. Please contact support.', type: 'error' });
        setLoading(false);
        return;
      }

      // Send password reset email to REAL EMAIL
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/CaBa/reset-password`
      });

      if (error) throw error;

      // Show success with masked email
      setMessage({
        text: `✅ Password reset link sent to ${maskEmail(user.email)}. Check your email inbox!`,
        type: 'success'
      });

      setPhone(''); // Clear form

    } catch (error) {
      console.error('Forgot password error:', error);
      setMessage({ text: error.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="card">
        <div className="logo">
          <div className="logo-icon">lock</div>
          <h1>DigiDad</h1>
        </div>

        <h2>Forgot Password</h2>
        <p className="subtitle">Enter your phone number</p>

        <form id="forgotPasswordForm" onSubmit={handleSubmit}>
          <div className="input-group">
            <label htmlFor="phone">
              <span className="icon">phone</span>
              Phone Number
            </label>
            <input
              type="tel"
              id="phone"
              placeholder="+911234567890"
              required
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <small>We'll send a reset link to your registered email</small>
          </div>

          <button type="submit" id="submitBtn" className="btn-primary" disabled={loading}>
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>

          <div id="message" className="message" style={{ display: message.text ? 'block' : 'none' }}>
            {message.text}
          </div>
        </form>

        <div className="footer">
          <Link to="/login">← Back to Login</Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;