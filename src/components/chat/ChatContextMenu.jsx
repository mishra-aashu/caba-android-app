import React, { useEffect, useRef } from 'react';
import { Trash2, Archive, BellOff } from 'lucide-react';
import styles from './ChatContextMenu.module.css';

const ChatContextMenu = ({ x, y, onClose, onDelete, chat }) => {
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div 
      ref={menuRef}
      className={styles.menu}
      style={{ left: x, top: y }}
    >
      <div className={styles.item} onClick={() => { onDelete(); onClose(); }}>
        <span className={styles.icon}><Trash2 size={16} /></span>
        <span>Delete Chat</span>
      </div>
      <div className={styles.item} onClick={onClose}>
        <span className={styles.icon}><Archive size={16} /></span>
        <span>Archive</span>
      </div>
      <div className={styles.divider} />
      <div className={styles.item} onClick={onClose}>
        <span className={styles.icon}><BellOff size={16} /></span>
        <span>Mute Notifications</span>
      </div>
    </div>
  );
};

export default ChatContextMenu;
