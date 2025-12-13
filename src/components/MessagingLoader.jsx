import React from 'react';
import { useTheme } from '../contexts/ThemeContext';

const MessagingLoader = () => {
  const { isDark } = useTheme();
  const darkMode = isDark;

  return (
    <div className={`messaging-loader-overlay transition-colors duration-300 ${darkMode ? 'bg-slate-900' : 'bg-gray-100'}`}>

      <style>{`
        @keyframes simpleBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        @keyframes floatCloud {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes shadowPulse {
          0%, 100% { transform: scaleX(1); opacity: 0.3; }
          50% { transform: scaleX(0.8); opacity: 0.1; }
        }
        @keyframes signalBlink {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
      `}</style>

      <div className="relative flex flex-col items-center">
        <svg
          width="120"
          height="80"
          viewBox="0 0 120 80"
          className="overflow-visible"
        >
          <g style={{ animation: 'floatCloud 3s ease-in-out infinite' }}>
            <path
              d="M85 20 Q92 15 99 20"
              fill="none"
              stroke={darkMode ? '#3b82f6' : '#2563eb'}
              strokeWidth="2.5"
              strokeLinecap="round"
              style={{ animation: 'signalBlink 2s infinite', animationDelay: '0s' }}
            />
            <path
              d="M88 28 Q92 25 96 28"
              fill="none"
              stroke={darkMode ? '#3b82f6' : '#2563eb'}
              strokeWidth="2.5"
              strokeLinecap="round"
              style={{ animation: 'signalBlink 2s infinite', animationDelay: '0.5s' }}
            />
            <path
              d="M35,55 L85,55 C96.046,55 105,46.046 105,35 C105,23.954 96.046,15 85,15 C82.5,15 80.15,15.5 78,16.5 C74.5,9.5 67.5,5 59,5 C48,5 39,13 37.5,23.5 C36.5,23.2 35.5,23 34.5,23 C21,23 10,34 10,47.5 C10,51.6 13.4,55 17.5,55 L35,55 Z"
              fill={darkMode ? '#1e293b' : '#ffffff'}
              stroke={darkMode ? '#3b82f6' : '#2563eb'}
              strokeWidth="3"
              strokeLinejoin="round"
              className="drop-shadow-lg"
            />
            <circle cx="40" cy="37" r="4" fill={darkMode ? '#60a5fa' : '#3b82f6'} style={{ animation: 'simpleBounce 1s infinite ease-in-out', animationDelay: '0s' }} />
            <circle cx="60" cy="37" r="4" fill={darkMode ? '#60a5fa' : '#3b82f6'} style={{ animation: 'simpleBounce 1s infinite ease-in-out', animationDelay: '0.2s' }} />
            <circle cx="80" cy="37" r="4" fill={darkMode ? '#60a5fa' : '#3b82f6'} style={{ animation: 'simpleBounce 1s infinite ease-in-out', animationDelay: '0.4s' }} />
          </g>
          <ellipse
            cx="60" cy="70" rx="35" ry="4"
            fill={darkMode ? '#0f172a' : '#cbd5e1'}
            style={{ animation: 'shadowPulse 3s ease-in-out infinite' }}
          />
        </svg>
      </div>

      <div className="mt-6 flex flex-col items-center">
        <p className={`text-sm font-bold tracking-[0.2em] ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>
          CONNECTING
        </p>
      </div>

    </div>
  );
};

export default MessagingLoader;