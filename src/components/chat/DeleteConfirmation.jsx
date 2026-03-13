import React from 'react';
import styles from './DeleteConfirmation.module.css';

const DeleteConfirmation = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title = "Delete Chat?", 
  message = "Are you sure you want to delete this chat? This action cannot be undone.",
  isMobile = false,
  selectedCount = 0
}) => {
  if (!isOpen) return null;

  const displayMessage = selectedCount > 1 
    ? `Are you sure you want to delete ${selectedCount} selected chats?`
    : message;

  if (isMobile) {
    // Bottom Sheet for Mobile
    return (
      <div className={styles.overlay} onClick={onClose}>
        <div className={styles.bottomSheet} onClick={e => e.stopPropagation()}>
          <div className={styles.handle} />
          <h3 className={styles.title}>{title}</h3>
          <p className={styles.message}>{displayMessage}</p>
          <div className={styles.mobileActions}>
            <button className={`${styles.btn} ${styles.btnDelete}`} onClick={onConfirm}>
              Delete
            </button>
            <button className={`${styles.btn} ${styles.btnCancel}`} onClick={onClose}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Modal for Desktop
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h3 className={styles.title}>{title}</h3>
        <p className={styles.message}>{displayMessage}</p>
        <div className={styles.desktopActions}>
          <button className={`${styles.btn} ${styles.btnCancel}`} onClick={onClose}>
            Cancel
          </button>
          <button className={`${styles.btn} ${styles.btnDelete}`} onClick={onConfirm}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmation;
