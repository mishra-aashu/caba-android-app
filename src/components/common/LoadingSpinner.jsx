import React from 'react';

const spinnerStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flex: 1,
  padding: '2rem',
};

const dotStyle = {
  width: '8px',
  height: '8px',
  borderRadius: '50%',
  background: 'var(--accent, #6c63ff)',
  margin: '0 4px',
  animation: 'loadingSpinnerBounce 1.2s ease-in-out infinite',
};

// Inject keyframes once
if (typeof document !== 'undefined' && !document.getElementById('loading-spinner-kf')) {
  const style = document.createElement('style');
  style.id = 'loading-spinner-kf';
  style.textContent = `
    @keyframes loadingSpinnerBounce {
      0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
      40%            { transform: scale(1);   opacity: 1;   }
    }
  `;
  document.head.appendChild(style);
}

const LoadingSpinner = ({ size = 'md' }) => {
  const delays = ['0s', '0.16s', '0.32s'];
  const scale = size === 'sm' ? 0.7 : size === 'lg' ? 1.4 : 1;

  return (
    <div style={spinnerStyle} role="status" aria-label="Loading">
      {delays.map((delay, i) => (
        <div
          key={i}
          style={{
            ...dotStyle,
            animationDelay: delay,
            transform: `scale(${scale})`,
            width: `${8 * scale}px`,
            height: `${8 * scale}px`,
          }}
        />
      ))}
    </div>
  );
};

export default LoadingSpinner;
