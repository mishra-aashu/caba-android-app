import React, { useState, useEffect } from 'react';
import useAuthStore from '../../store/authStore';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import ArrowLeft from 'lucide-react/dist/esm/icons/arrow-left';
import CheckCircle from 'lucide-react/dist/esm/icons/check-circle';
import Info from 'lucide-react/dist/esm/icons/info';

const GoogleIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);
import styles from '../../styles/LoginPage.module.css'; // Correctly import the dedicated CSS module
import AppName from '../common/AppName';

const Login = () => {
  const { signInWithGoogle, isServerUnreachable, clearServerError } = useAuthStore();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [agreed, setAgreed] = useState(true); // Default to checked as in UI

  const handleGoogleLogin = async () => {
    if (!agreed) {
      setError('Please agree to the terms and conditions.');
      return;
    }
    try {
      clearServerError();
      setLoading(true);
      setError('');
      const result = await signInWithGoogle();
      if (!result.success) {
        setError(result.error || 'Google sign in failed');
      }
    } catch (error) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleTermsClick = (e) => {
    e.preventDefault();
    navigate('/terms');
  };

  const handlePrivacyClick = (e) => {
    e.preventDefault();
    navigate('/privacy');
  };

  const handleAboutClick = (e) => {
    e.preventDefault();
    navigate('/admin-about');
  };

  const handleBackToLanding = (e) => {
    e.preventDefault();
    navigate('/');
  };

  return (
    <div className={`${styles['art-login-container']} ${styles['gpu-max']}`}>

      {/* Back Button - Top Left (Web Only) */}
      {!Capacitor.isNativePlatform() && (
        <button className={styles['back-btn-top-left']} onClick={handleBackToLanding} title="Back to Home">
          <ArrowLeft size={24} />
        </button>
      )}

      {/* About Button - Top Right */}
      <button className={styles['about-btn-top-right']} onClick={handleAboutClick} title="About">
        <Info size={24} />
      </button>

      {/* Background Ambience (Painting Effects) - GPU Accelerated */}
      <div className={`${styles['ambient-glow']} ${styles['glow-1']} ${styles['gpu-accelerated']}`}></div>
      <div className={`${styles['ambient-glow']} ${styles['glow-2']} ${styles['gpu-accelerated']}`}></div>
      <div className={`${styles['noise-overlay']} ${styles['gpu-accelerated']}`}></div>

      <div className={styles['art-content']}>

        {/* --- LEFT SIDE: The Art/Story --- */}
        <div className={`${styles['art-hero-section']} ${styles['gpu-accelerated']}`}>
          <AppName className={styles['brand-badge']} />
          <h1 className={`${styles['art-hero-headline']} ${styles['gpu-accelerated']}`}>
            The Art of <br />
            <span className={`${styles['italic-text']} ${styles['gpu-accelerated']}`}>Conversation.</span>
          </h1>
          <p className={`${styles['art-desc']} ${styles['gpu-accelerated']}`}>
            Experience messaging that feels as authentic as a handwritten letter.
            Secure, simple, and beautifully designed for you.
          </p>

          <div className={`${styles['art-features']} ${styles['gpu-accelerated']}`}>
            <div className={`${styles['feat-item']} ${styles['gpu-accelerated']}`}><CheckCircle size={18} /> Private by default</div>
            <div className={`${styles['feat-item']} ${styles['gpu-accelerated']}`}><CheckCircle size={18} /> Infinite history</div>
          </div>
        </div>

        {/* --- RIGHT SIDE: The Login Paper --- */}
        <div className={`${styles['login-wrapper']} ${styles['gpu-accelerated']}`}>
          <div className={`${styles['paper-card']} ${styles['gpu-accelerated']}`}>
            <div className={styles['card-texture']}></div> {/* Paper Grain */}

            <div className={styles['card-header']}>
              <h2>Welcome Back</h2>
              <p>Sign in to continue your story</p>
            </div>

            {isServerUnreachable && (
              <div className={`${styles['error-message']} ${styles['server-error-banner']}`}>
                <Info size={16} /> facing some issue with the server, try after sometime!!!
              </div>
            )}

            {error && <div className={styles['error-message']}>{error}</div>}

            <button className={`${styles['google-art-btn']} ${styles['gpu-accelerated']}`} onClick={handleGoogleLogin} disabled={loading || !agreed}>
              {loading ? (
                <div className={styles.spinner}></div>
              ) : (
                <>
                  <GoogleIcon className="icon" />
                  <span>Sign in with Google</span>
                </>
              )}
            </button>

            <div className={styles['card-footer']}>
              <label className={styles['checkbox-container']}>
                <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
                <span className={styles.checkmark}></span>
                I accept the <a href="/terms" onClick={handleTermsClick} className={styles.link}>Terms</a> & <a href="/privacy" onClick={handlePrivacyClick} className={styles.link}>Privacy</a>
              </label>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Login;
