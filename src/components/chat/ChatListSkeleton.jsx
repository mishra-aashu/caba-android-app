import React from 'react';
import styles from './ChatListSkeleton.module.css';

const ChatListSkeleton = ({ count = 10 }) => {
  return (
    <div className={styles['skeleton-container']}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={styles['skeleton-item']}>
          <div className={styles['skeleton-avatar']} />
          <div className={styles['skeleton-content']}>
            <div className={styles['skeleton-header']}>
              <div className={styles['skeleton-name']} />
              <div className={styles['skeleton-time']} />
            </div>
            <div className={styles['skeleton-message']} />
          </div>
        </div>
      ))}
    </div>
  );
};

export default ChatListSkeleton;
