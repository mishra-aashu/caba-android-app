import React, { useEffect, useState, useRef, useCallback } from 'react';
import '../styles/intro.css';

// ═══════════════════════════════════════════════════════
// Lightweight particle config (no heavy computation)
// ═══════════════════════════════════════════════════════
const PARTICLE_COUNT = 25;
const LINE_DISTANCE = 120;

const Intro = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState('loading'); // loading → reveal → fadeout → done
  const canvasRef = useRef(null);
  const particlesRef = useRef([]);
  const animRef = useRef(null);
  const mountedRef = useRef(true);
  const progressRef = useRef(0);

  // ─── Initialize particles ─────────────────────────────
  const initParticles = useCallback((w, h) => {
    const particles = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.6,
        vy: (Math.random() - 0.5) * 0.6,
        r: Math.random() * 2 + 1,
        opacity: Math.random() * 0.5 + 0.2
      });
    }
    particlesRef.current = particles;
  }, []);

  // ─── Canvas animation (lightweight) ────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.scale(dpr, dpr);
      initParticles(w, h);
    };

    resize();
    window.addEventListener('resize', resize);

    const isDark = !document.documentElement.getAttribute('data-theme') ||
                   document.documentElement.getAttribute('data-theme') === 'dark';

    const dotColor = isDark ? '255,255,255' : '100,80,200';
    const lineColor = isDark ? '255,255,255' : '124,58,237';

    const animate = () => {
      if (!mountedRef.current) return;

      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      ctx.clearRect(0, 0, w, h);

      const particles = particlesRef.current;
      const prog = progressRef.current / 100;

      // Update & draw particles
      particles.forEach((p, i) => {
        // Move
        p.x += p.vx;
        p.y += p.vy;

        // Bounce off edges
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;

        // Keep in bounds
        p.x = Math.max(0, Math.min(w, p.x));
        p.y = Math.max(0, Math.min(h, p.y));

        // Draw connections (only nearby particles)
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < LINE_DISTANCE) {
            const alpha = (1 - dist / LINE_DISTANCE) * 0.15 * prog;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(${lineColor},${alpha})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }

        // Draw dot
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * prog, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${dotColor},${p.opacity * prog})`;
        ctx.fill();
      });

      // Center glow (subtle)
      const glowRadius = Math.min(w, h) * 0.3 * prog;
      const glow = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, glowRadius);
      glow.addColorStop(0, `rgba(124, 58, 237, ${0.06 * prog})`);
      glow.addColorStop(1, 'rgba(124, 58, 237, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      animRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resize);
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [initParticles]);

  // ─── Progress timer ────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;

    const duration = 2200;
    const interval = 16;
    const step = 100 / (duration / interval);

    const timer = setInterval(() => {
      setProgress(prev => {
        const next = Math.min(prev + step, 100);
        progressRef.current = next;

        if (next >= 100) {
          clearInterval(timer);
        }
        return next;
      });
    }, interval);

    return () => {
      mountedRef.current = false;
      clearInterval(timer);
    };
  }, []);

  // ─── Phase transitions ────────────────────────────────
  useEffect(() => {
    if (progress >= 100 && phase === 'loading') {
      // Brief pause at 100% to show completion
      const t1 = setTimeout(() => setPhase('reveal'), 300);
      return () => clearTimeout(t1);
    }

    if (phase === 'reveal') {
      const t2 = setTimeout(() => setPhase('fadeout'), 600);
      return () => clearTimeout(t2);
    }

    if (phase === 'fadeout') {
      const t3 = setTimeout(() => {
        setPhase('done');
        onComplete?.();
      }, 600);
      return () => clearTimeout(t3);
    }
  }, [progress, phase, onComplete]);

  if (phase === 'done') return null;

  const progressClamped = Math.min(progress, 100);
  const progressInt = Math.floor(progressClamped);

  return (
    <div className={`intro-overlay ${phase}`} aria-hidden="true">
      {/* Background mesh canvas */}
      <canvas ref={canvasRef} className="intro-canvas" />

      {/* Radial gradient overlay */}
      <div className="intro-gradient" />

      {/* Main content */}
      <div className="intro-content">
        {/* Animated Logo Mark */}
        <div className="intro-logo-wrap">
          <div className="intro-logo">
            <div className="logo-ring ring-1" />
            <div className="logo-ring ring-2" />
            <div className="logo-ring ring-3" />
            <div className="logo-icon">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M21 11.5C21.0034 12.8199 20.6951 14.1219 20.1 15.3C19.3944 16.7118 18.3098 17.8992 16.9674 18.7293C15.6251 19.5594 14.0782 19.9994 12.5 20C11.1801 20.0035 9.87812 19.6951 8.7 19.1L3 21L4.9 15.3C4.30493 14.1219 3.99656 12.8199 4 11.5C4.00061 9.92179 4.44061 8.37488 5.27072 7.03258C6.10083 5.69028 7.28825 4.6056 8.7 3.90003C9.87812 3.30496 11.1801 2.99659 12.5 3.00003H13C15.0843 3.11502 17.053 3.99479 18.5291 5.47089C20.0052 6.94699 20.885 8.91568 21 11V11.5Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>
          {/* Pulse ripple */}
          <div className="logo-pulse" />
        </div>

        {/* App Name */}
        <div className="intro-title">
          <span className="title-char" style={{ animationDelay: '0.1s' }}>C</span>
          <span className="title-char" style={{ animationDelay: '0.15s' }}>h</span>
          <span className="title-char" style={{ animationDelay: '0.2s' }}>a</span>
          <span className="title-char" style={{ animationDelay: '0.25s' }}>t</span>
          <span className="title-char space" style={{ animationDelay: '0.3s' }}>&nbsp;</span>
          <span className="title-char" style={{ animationDelay: '0.35s' }}>A</span>
          <span className="title-char" style={{ animationDelay: '0.4s' }}>p</span>
          <span className="title-char" style={{ animationDelay: '0.45s' }}>p</span>
        </div>

        {/* Tagline */}
        <div className="intro-tagline">connecting people, everywhere</div>

        {/* Progress Section */}
        <div className="intro-progress-section">
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{ width: `${progressClamped}%` }}
            />
            <div
              className="progress-glow"
              style={{ left: `${progressClamped}%` }}
            />
          </div>
          <div className="progress-info">
            <span className="progress-text">
              {progressInt < 100 ? 'Initializing...' : 'Ready!'}
            </span>
            <span className="progress-percent">{progressInt}%</span>
          </div>
        </div>

        {/* Dots animation */}
        <div className="intro-dots">
          <span className="dot" />
          <span className="dot" />
          <span className="dot" />
        </div>
      </div>

      {/* Bottom branding */}
      <div className="intro-footer">
        <span>Secured & Encrypted</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
};

export default Intro;