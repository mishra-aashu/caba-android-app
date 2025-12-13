import React from 'react';

const TypingIndicator = ({ isVisible }) => {
  if (!isVisible) return null;

  return (
    <div className="typing-indicator">
      <span className="typing-dots">
        <span></span>
        <span></span>
        <span></span>
      </span>
      <span className="typing-text">typing...</span>
    </div>
  );
};

export default TypingIndicator;