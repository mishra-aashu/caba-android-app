import React, { useState, useEffect } from 'react';
import useAuthStore from '../../store/authStore';
import { useNavigate } from 'react-router-dom';
import { FaGoogle, FaCheckCircle, FaInfoCircle } from 'react-icons/fa';
import '../../styles/LoginPage.css'; // Correctly import the dedicated CSS file

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
    <div className="art-login-container gpu-max">

      {/* About Button - Top Right */}
      <button className="about-btn-top-right" onClick={handleAboutClick} title="About">
        <FaInfoCircle />
      </button>

      {/* Background Ambience (Painting Effects) - GPU Accelerated */}
      <div className="ambient-glow glow-1 gpu-accelerated"></div>
      <div className="ambient-glow glow-2 gpu-accelerated"></div>
      <div className="noise-overlay gpu-accelerated"></div>

      <div className="art-content">

        {/* --- LEFT SIDE: The Art/Story --- */}
        <div className="art-hero-section gpu-accelerated">
          <div className="brand-badge gpu-accelerated">CaBa Messenger</div>
          <h1 className="art-hero-headline gpu-accelerated">
            The Art of <br />
            <span className="italic-text gpu-accelerated">Conversation.</span>
          </h1>
          <p className="art-desc gpu-accelerated">
            Experience messaging that feels as authentic as a handwritten letter.
            Secure, simple, and beautifully designed for you.
          </p>

          <div className="art-features gpu-accelerated">
            <div className="feat-item gpu-accelerated"><FaCheckCircle /> Private by default</div>
            <div className="feat-item gpu-accelerated"><FaCheckCircle /> Infinite history</div>
          </div>
        </div>

        {/* --- RIGHT SIDE: The Login Paper --- */}
        <div className="login-wrapper gpu-accelerated">
          <div className="paper-card gpu-accelerated">
            <div className="card-texture"></div> {/* Paper Grain */}

            <div className="card-header">
              <h2>Welcome Back</h2>
              <p>Sign in to continue your story</p>
            </div>

            {isServerUnreachable && (
              <div className="error-message server-error-banner">
                <FaInfoCircle /> facing some issue with the server, try after sometime!!!
              </div>
            )}

            {error && <div className="error-message">{error}</div>}

            <button className="google-art-btn gpu-accelerated" onClick={handleGoogleLogin} disabled={loading || !agreed}>
              {loading ? (
                <div className="spinner"></div>
              ) : (
                <>
                  <FaGoogle className="icon" />
                  <span>Sign in with Google</span>
                </>
              )}
            </button>

            <div className="card-footer">
              <label className="checkbox-container">
                <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
                <span className="checkmark"></span>
                I accept the <a href="/terms" onClick={handleTermsClick} className="link">Terms</a> & <a href="/privacy" onClick={handlePrivacyClick} className="link">Privacy</a>
              </label>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Login;
