import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { FaGoogle, FaCheckCircle } from 'react-icons/fa';
import '../../styles/LoginPage.css'; // Correctly import the dedicated CSS file

const Login = () => {
  const { signInWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [agreed, setAgreed] = useState(true); // Default to checked as in UI

  const handleGoogleLogin = async () => {
    if (!agreed) {
      setError('Please agree to the terms and conditions.');
      return;
    }
    try {
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

  return (
    <div className="art-login-container">
      
      {/* Background Ambience (Painting Effects) */}
      <div className="ambient-glow glow-1"></div>
      <div className="ambient-glow glow-2"></div>
      <div className="noise-overlay"></div>

      <div className="art-content">
        
        {/* --- LEFT SIDE: The Art/Story --- */}
        <div className="art-hero-section">
          <div className="brand-badge">CaBa Messenger</div>
          <h1 className="art-hero-headline">
            The Art of <br />
            <span className="italic-text">Conversation.</span>
          </h1>
          <p className="art-desc">
            Experience messaging that feels as authentic as a handwritten letter. 
            Secure, simple, and beautifully designed for you.
          </p>
          
          <div className="art-features">
            <div className="feat-item"><FaCheckCircle /> Private by default</div>
            <div className="feat-item"><FaCheckCircle /> Infinite history</div>
          </div>
        </div>

        {/* --- RIGHT SIDE: The Login Paper --- */}
        <div className="login-wrapper">
          <div className="paper-card">
            <div className="card-texture"></div> {/* Paper Grain */}
            
            <div className="card-header">
              <h2>Welcome Back</h2>
              <p>Sign in to continue your story</p>
            </div>
            
            {error && <div className="error-message">{error}</div>}

            <button className="google-art-btn" onClick={handleGoogleLogin} disabled={loading || !agreed}>
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
                I accept the <span className="link">Terms</span> & <span className="link">Privacy</span>
              </label>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Login;