import React, { useEffect, useState } from 'react';
import '../styles/intro.css';

const Intro = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    const duration = 2500; // 2.5 seconds total
    const interval = 20; // Update every 20ms
    const step = 100 / (duration / interval);

    const timer = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(timer);
          return 100;
        }
        return prev + step;
      });
    }, interval);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (progress >= 100) {
      // Small delay before starting fade out
      const fadeTimer = setTimeout(() => {
        setIsFadingOut(true);
        // Wait for fade animation to finish
        const completeTimer = setTimeout(() => {
          if (onComplete) onComplete();
        }, 500);
        return () => clearTimeout(completeTimer);
      }, 200);
      return () => clearTimeout(fadeTimer);
    }
  }, [progress, onComplete]);

  return (
    <div className={`intro-overlay ${isFadingOut ? 'fade-out' : ''}`}>
      <div className="intro-content">
        <div className="intro-text">App is loading...</div>
        <div className="progress-container">
          <div
            className="progress-bar"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default Intro;