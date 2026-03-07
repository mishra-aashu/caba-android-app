import React from 'react';
import styles from '../../styles/chat.module.css';

const TypingIndicator = ({ isVisible }) => {
  if (!isVisible) return null;

  return (
    <div className={styles['typing-indicator']}>
      <span className={styles['typing-dots']}>
        <span></span>
        <span></span>
        <span></span>
      </span>
      <span className={styles['typing-text']}>typing...</span>
    </div>
  );
};

export default TypingIndicator;