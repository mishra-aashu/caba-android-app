import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';

const Intro = ({ onComplete }) => {
  const navigate = useNavigate();
  const { isDark } = useTheme();

  const darkMode = isDark;

  // WhatsApp-like Brand Colors
  const brandColor = darkMode ? '#25D366' : '#00a884';

  useEffect(() => {
    const timer = setTimeout(() => {
      const urlParams = new URLSearchParams(window.location.search);
      const redirectTo = urlParams.get('redirect');

      if (redirectTo === 'login') {
        navigate('/login');
      } else {
        navigate('/');
      }

      onComplete();
    }, 3000);

    return () => clearTimeout(timer);
  }, [navigate, onComplete]);

  return (
    <div className={`intro-overlay transition-colors duration-500 overflow-hidden
      ${darkMode ? 'bg-[#111b21]' : 'bg-white'}`}>

      <style>{`
        /* 1. BALL ANIMATION */
        @keyframes ballDrop {
          0% { transform: translateY(-80px) scale(1); opacity: 1; }
          30% { transform: translateY(0) scale(1); opacity: 1; }
          35% { transform: translateY(5px) scale(1.4, 0.6); opacity: 1; }
          36% { opacity: 0; }
          90% { opacity: 0; }
          91% { transform: translateY(0) scale(1); opacity: 1; }
          100% { transform: translateY(-80px) scale(1); opacity: 1; }
        }

        /* 2. LOGO REVEAL */
        @keyframes logoCycle {
          0%, 35% { transform: scale(0); opacity: 0; }
          36% { transform: scale(1.2, 0.8); opacity: 1; }
          45% { transform: scale(1); opacity: 1; }
          85% { transform: scale(1); opacity: 1; }
          90% { transform: scale(0); opacity: 0; }
          100% { transform: scale(0); opacity: 0; }
        }

        /* 3. STROKE DRAWING */
        @keyframes drawStroke {
          0%, 35% { stroke-dashoffset: 200; }
          50% { stroke-dashoffset: 0; }
          85% { stroke-dashoffset: 0; }
          90% { stroke-dashoffset: 200; }
        }

        /* 4. TEXT SLIDE */
        @keyframes textSlide {
          0%, 40% { opacity: 0; transform: translateX(-20px); }
          50% { opacity: 1; transform: translateX(0); }
          85% { opacity: 1; transform: translateX(0); }
          90% { opacity: 0; transform: translateX(-10px); }
        }

        /* 5. DOT WAVE (Improved) */
        @keyframes dotWave {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }

        /* 6. SHOCKWAVE RIPPLE (New) */
        @keyframes rippleEffect {
          0%, 30% { width: 0px; height: 0px; opacity: 0; border-width: 0px; }
          31% { width: 10px; height: 5px; opacity: 0.8; border-width: 4px; }
          50% { width: 120px; height: 20px; opacity: 0; border-width: 0px; }
          100% { width: 120px; height: 20px; opacity: 0; border-width: 0px; }
        }

        /* 7. SPLASH PARTICLES (New) */
        @keyframes splashOut {
          0%, 30% { transform: translate(0,0) scale(0); opacity: 0; }
          31% { transform: translate(0,0) scale(1); opacity: 1; }
          45% { opacity: 0; } /* Fade out quickly as they move */
          100% { transform: translate(var(--tx), var(--ty)) scale(0); opacity: 0; }
        }

        @keyframes shadowJump {
          0%, 100% { transform: scale(0.3); opacity: 0.1; }
          35% { transform: scale(1.2); opacity: 0.4; }
          90% { transform: scale(0.3); opacity: 0.1; }
        }
      `}</style>

      <div className="relative flex flex-col items-center h-48 justify-center">

        {/* ELEMENT 1: SPLASH PARTICLES (Behind everything) */}
        {/* These trigger exactly when the ball hits (around 30-35%) */}
        <div className="absolute top-[50%] left-[50%] w-0 h-0 z-0">
           {[...Array(6)].map((_, i) => {
             const angle = (i * 60) * (Math.PI / 180);
             const dist = 40;
             const tx = Math.cos(angle) * dist + 'px';
             const ty = (Math.sin(angle) * dist - 20) + 'px'; // Move slightly up
             return (
               <div key={i}
                 className="absolute w-1.5 h-1.5 rounded-full"
                 style={{
                   backgroundColor: brandColor,
                   '--tx': tx,
                   '--ty': ty,
                   animation: 'splashOut 3s ease-out infinite'
                 }}
               />
             );
           })}
        </div>

        {/* ELEMENT 2: The Dropping Ball */}
        <div
          className="absolute w-5 h-5 rounded-full z-20"
          style={{
            backgroundColor: brandColor,
            animation: 'ballDrop 3s cubic-bezier(0.45, 0, 0.55, 1) infinite'
          }}
        ></div>

        {/* ELEMENT 3: The Main Logo */}
        <div
          className="relative z-10 flex items-center justify-center"
          style={{
            animation: 'logoCycle 3s cubic-bezier(0.175, 0.885, 0.32, 1.275) infinite',
            transformOrigin: 'bottom center'
          }}
        >
          <svg width="180" height="80" viewBox="0 0 180 80" className="overflow-visible">
            <g transform="translate(40, 40)">
              {/* C Stroke */}
              <path
                d="M 25 -15 A 28 28 0 1 0 25 20"
                fill="none"
                stroke={brandColor}
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray="200"
                style={{ animation: 'drawStroke 3s ease-in-out infinite' }}
                transform="rotate(-15)"
              />
              {/* Tail */}
              <path
                d="M -15 22 L -25 35 L -5 27 Z"
                fill={brandColor}
                style={{ animation: 'logoCycle 3s infinite' }}
              />
              {/* Wave Dots */}
              <circle cx="-12" cy="5" r="4.5" fill={brandColor} style={{ animation: 'dotWave 1s ease-in-out infinite', animationDelay: '0s' }} />
              <circle cx="0" cy="5" r="4.5" fill={brandColor} style={{ animation: 'dotWave 1s ease-in-out infinite', animationDelay: '0.15s' }} />
              <circle cx="12" cy="5" r="4.5" fill={brandColor} style={{ animation: 'dotWave 1s ease-in-out infinite', animationDelay: '0.3s' }} />
            </g>

            <text
              x="80"
              y="58"
              fontFamily="Arial, sans-serif"
              fontWeight="bold"
              fontSize="48"
              fill={brandColor}
              style={{ animation: 'textSlide 3s ease-out infinite' }}
            >
              aBa
            </text>
          </svg>
        </div>

        {/* ELEMENT 4: RIPPLE EFFECT (On floor) */}
        <div
          className="absolute bottom-6 rounded-[100%] border-solid box-border z-0"
          style={{
            borderColor: brandColor,
            animation: 'rippleEffect 3s linear infinite'
          }}
        ></div>

        {/* SHADOW */}
        <div
          className={`absolute bottom-6 w-16 h-1.5 rounded-full blur-sm transition-colors duration-500
            ${darkMode ? 'bg-black/40' : 'bg-gray-400/40'}`}
           style={{
             animation: 'shadowJump 3s cubic-bezier(0.45, 0, 0.55, 1) infinite'
           }}
        ></div>

      </div>

      <div className="mt-8 text-center">
         <p className="text-xs font-bold tracking-[0.3em] uppercase transition-colors duration-500"
            style={{ color: brandColor, opacity: 0.8 }}>
          Loading
        </p>
      </div>

    </div>
  );
};

export default Intro;