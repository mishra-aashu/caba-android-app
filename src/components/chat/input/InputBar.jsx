import React from 'react';
import { Paperclip } from 'lucide-react';
import hapticsManager from '../../../utils/hapticsManager';
import styles from '../../../styles/chat.module.css';

const InputBar = ({
  message,
  setMessage,
  textareaRef,
  isRecording,
  voiceBlob,
  isUploading,
  externalDisabled,
  disabledPlaceholder,
  onInputChange,
  onKeyDown,
  onToggleEmoji,
  onToggleAttachment,
  showEmojiPicker
}) => {
  const handleToggleAttachment = () => {
    hapticsManager.impact();
    onToggleAttachment();
  };

  if (isRecording || voiceBlob) return null;

  return (
    <div className={styles['input-pill']}>
      <div className={styles['auto-resize-wrapper']}>
        <span className={styles['textarea-mirror']}>{message + '\n'}</span>
        <textarea
          ref={textareaRef}
          className={styles['chat-input']}
          placeholder={externalDisabled ? disabledPlaceholder : "Type a message..."}
          value={message}
          onChange={onInputChange}
          onKeyDown={onKeyDown}
          rows={1}
          disabled={isUploading || externalDisabled}
        />
      </div>

      <button 
        className={styles['btn-attach-icon']} 
        onClick={handleToggleAttachment}
        title="Attach"
      >
        <Paperclip size={22} />
      </button>
    </div>
  );
};

export default InputBar;
