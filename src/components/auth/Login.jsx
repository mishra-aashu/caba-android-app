import React, { useState, useEffect } from 'react';
import useAuthStore from '../../store/authStore';
import { useNavigate } from 'react-router-dom';
import { FaGoogle, FaCheckCircle, FaInfoCircle } from 'react-icons/fa';
import styles from '../../styles/LoginPage.module.css'; // Correctly import the dedicated CSS module

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

  return (
    <div className={`${styles['art-login-container']} ${styles['gpu-max']}`}>

      {/* About Button - Top Right */}
      <button className={styles['about-btn-top-right']} onClick={handleAboutClick} title="About">
        <FaInfoCircle />
      </button>

      {/* Background Ambience (Painting Effects) - GPU Accelerated */}
      <div className={`${styles['ambient-glow']} ${styles['glow-1']} ${styles['gpu-accelerated']}`}></div>
      <div className={`${styles['ambient-glow']} ${styles['glow-2']} ${styles['gpu-accelerated']}`}></div>
      <div className={`${styles['noise-overlay']} ${styles['gpu-accelerated']}`}></div>

      <div className={styles['art-content']}>

        {/* --- LEFT SIDE: The Art/Story --- */}
        <div className={`${styles['art-hero-section']} ${styles['gpu-accelerated']}`}>
          <div className={`${styles['brand-badge']} ${styles['gpu-accelerated']}`}>Elevengram</div>
          <h1 className={`${styles['art-hero-headline']} ${styles['gpu-accelerated']}`}>
            The Art of <br />
            <span className={`${styles['italic-text']} ${styles['gpu-accelerated']}`}>Conversation.</span>
          </h1>
          <p className={`${styles['art-desc']} ${styles['gpu-accelerated']}`}>
            Experience messaging that feels as authentic as a handwritten letter.
            Secure, simple, and beautifully designed for you.
          </p>

          <div className={`${styles['art-features']} ${styles['gpu-accelerated']}`}>
            <div className={`${styles['feat-item']} ${styles['gpu-accelerated']}`}><FaCheckCircle /> Private by default</div>
            <div className={`${styles['feat-item']} ${styles['gpu-accelerated']}`}><FaCheckCircle /> Infinite history</div>
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
                <FaInfoCircle /> facing some issue with the server, try after sometime!!!
              </div>
            )}

            {error && <div className={styles['error-message']}>{error}</div>}

            <button className={`${styles['google-art-btn']} ${styles['gpu-accelerated']}`} onClick={handleGoogleLogin} disabled={loading || !agreed}>
              {loading ? (
                <div className={styles.spinner}></div>
              ) : (
                <>
                  <FaGoogle className="icon" />
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
