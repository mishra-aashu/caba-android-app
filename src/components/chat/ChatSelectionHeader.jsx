import React from 'react';
import styles from './ChatSelectionHeader.module.css';

const ChatSelectionHeader = ({ selectedCount, onClear, onDelete }) => {
  return (
    <div className={styles.header}>
      <div className={styles.left}>
        <button className={styles.iconBtn} onClick={onClear}>
          ✕
        </button>
        <span className={styles.count}>{selectedCount} Selected</span>
      </div>
      <div className={styles.right}>
        <button className={styles.deleteBtn} onClick={onDelete}>
          🗑️
        </button>
      </div>
    </div>
  );
};

export default ChatSelectionHeader;
