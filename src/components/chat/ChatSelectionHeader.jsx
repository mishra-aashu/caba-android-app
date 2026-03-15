import React from 'react';
import { X, Trash2, CheckCheck, BellOff } from 'lucide-react';
import styles from './ChatSelectionHeader.module.css';

const ChatSelectionHeader = ({ selectedCount, onClear, onDelete, onMarkRead, onMute }) => {
  return (
    <div className={styles.header}>
      <div className={styles.left}>
        <button className={styles.iconBtn} onClick={onClear} title="Clear selection">
          <X size={22} />
        </button>
        <span className={styles.count}>{selectedCount} Selected</span>
      </div>
      <div className={styles.right}>
        <button className={styles.actionBtn} onClick={onMarkRead} title="Mark as read">
          <CheckCheck size={20} />
        </button>
        <button className={styles.actionBtn} onClick={onMute} title="Mute notifications">
          <BellOff size={20} />
        </button>
        <button className={styles.deleteBtn} onClick={onDelete} title="Delete">
          <Trash2 size={20} />
        </button>
      </div>
    </div>
  );
};

export default ChatSelectionHeader;
