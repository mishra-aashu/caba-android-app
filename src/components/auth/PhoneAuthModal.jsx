import React, { useState } from 'react';
import { supabase } from '../../config/supabase';
import { useAuth } from '../../hooks/useAuth';
import '../../styles/PhoneModal.css';

const PhoneAuthModal = ({ isOpen, onClose, onAuthSuccess, mode = 'auth', onCollectSuccess, onBackToLogin = () => {} }) => {
  const { signInWithPhone } = useAuth();
  const [step, setStep] = useState('phone'); // 'phone', 'name'
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isNewUser, setIsNewUser] = useState(false);

  const handlePhoneSubmit = async (e) => {
    e.preventDefault();
    if (!phone.trim() || !/^\d{10}$/.test(phone)) {
      setError('Please enter a valid 10-digit phone number');
      return;
    }

    setLoading(true);
    setError('');

    if (mode === 'collect') {
      // Check if phone is already taken
      const { data: existingUser, error: checkError } = await supabase
        .from('users')
        .select('id')
        .eq('phone', phone)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      if (existingUser) {
        setError('User already exists with this number. Enter a different number.');
        setLoading(false);
        return;
      }

      setStep('name');
      setLoading(false);
      return;
    }

    try {
      // Check if user exists
      const { data: existingUser, error: checkError } = await supabase
        .from('users')
        .select('id, name')
        .eq('phone', phone)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      if (existingUser) {
        // Existing user - login
        setIsNewUser(false);
        await handleLogin(existingUser);
      } else {
        // New user - ask for name
        setIsNewUser(true);
        setStep('name');
      }
    } catch (error) {
      console.error('Error checking user:', error);
      setError('Failed to check user. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleNameSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }

    setLoading(true);
    setError('');

    if (mode === 'collect') {
      onCollectSuccess({ phone, name: name.trim() });
      handleClose();
      setLoading(false);
      return;
    }

    try {
      // Create new user
      const userId = `phone_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert([{
          id: userId,
          phone: phone,
          name: name.trim(),
          email: null,
          avatar: null,
          is_online: true
        }])
        .select()
        .single();

      if (insertError) throw insertError;

      // Auth success
      await signInWithPhone(newUser);
      onAuthSuccess(newUser);
      handleClose();
    } catch (error) {
      console.error('Error creating user:', error);
      setError('Failed to create account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (user) => {
    // Login for existing user
    await signInWithPhone(user);
    onAuthSuccess(user);
    handleClose();
  };

  const handleClose = () => {
    setStep('phone');
    setPhone('');
    setName('');
    setError('');
    setIsNewUser(false);
    onClose();
  };

  if (!isOpen) return null;

  const title = mode === 'collect' ? (step === 'phone' ? 'Enter Your Phone Number' : 'Enter Your Name') : (step === 'phone' ? 'Enter Phone Number' : 'Enter Your Name');

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2 className="phone-auth-title">{title}</h2>
        {error && (
          <div className="error-message" style={{ color: '#ef4444', marginBottom: '16px', fontSize: '0.9rem' }}>
            {error}
          </div>
        )}

        {step === 'phone' ? (
          <form onSubmit={handlePhoneSubmit}>
            <div className="input-wrapper">
              <p className="phone-auth-subtitle">Allows others to search for you</p>
              <label className="input-label">Phone Number</label>
              <input
                className="custom-input"
                type="tel"
                placeholder="10-digit phone number"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                required
                autoFocus
              />
            </div>
            <button className="continue-btn" type="submit" disabled={loading}>
              {loading ? 'Checking...' : 'Continue'}
            </button>
            <p className="back-to-login-link" onClick={onBackToLogin}>Back to Login</p>
          </form>
        ) : (
          <form onSubmit={handleNameSubmit}>
            <div className="input-wrapper">
              <p className="phone-auth-subtitle">Display Name</p>
              <label className="input-label">Your Name</label>
              <input
                className="custom-input"
                type="text"
                placeholder="Enter your full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <button className="continue-btn" type="button" onClick={() => setStep('phone')} style={{ flex: 1, background: '#374151' }}>
                Back
              </button>
              <button className="continue-btn" type="submit" disabled={loading} style={{ flex: 1 }}>
                {loading ? 'Creating Account...' : 'Create Account'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default PhoneAuthModal;