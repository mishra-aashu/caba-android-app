import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Reply, Forward, Copy, Trash2 } from 'lucide-react';
import styles from '../../../styles/chat.module.css';
import useChatStore from '../../../store/useChatStore';

const ChatActionsPanel = ({ 
  onReply, 
  onForward, 
  onDelete, 
  currentUser 
}) => {
  const isSelectionMode = useChatStore(state => state.isSelectionMode);
  const selectedMessageIds = useChatStore(state => state.selectedMessageIds);
  const clearSelection = useChatStore(state => state.clearSelection);

  const selectedCount = selectedMessageIds.size;
  const isSingle = selectedCount === 1;

  if (!isSelectionMode) return null;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className={styles['selection-actions-bar']}
      >
        <div className={styles['selection-bar-inner']}>
          {/* Left: Close & Count */}
          <div className={styles['selection-bar-left']}>
            <button 
              className={styles['selection-bar-close']}
              onClick={clearSelection}
              aria-label="Close selection"
            >
              <X size={22} />
            </button>
            <div className={styles['selection-bar-count']}>
              {selectedCount} selected
            </div>
          </div>

          {/* Right: Action Buttons */}
          <div className={styles['selection-bar-actions']}>
            {isSingle && (
              <button 
                className={styles['selection-bar-btn']}
                onClick={() => onReply(Array.from(selectedMessageIds)[0])}
                title="Reply"
              >
                <Reply size={22} />
                <span>Reply</span>
              </button>
            )}
            
            <button 
              className={styles['selection-bar-btn']}
              onClick={() => onForward(Array.from(selectedMessageIds))}
              title="Forward"
            >
              <Forward size={22} />
              <span>Forward</span>
            </button>
            
            <button 
              className={`${styles['selection-bar-btn']} ${styles['selection-bar-btn-danger']}`}
              onClick={() => onDelete(Array.from(selectedMessageIds))}
              title="Delete"
            >
              <Trash2 size={22} />
              <span>Delete</span>
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ChatActionsPanel;
