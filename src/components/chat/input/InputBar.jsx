import React from 'react';
import { Paperclip, Smile } from 'lucide-react';
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
  isTempChat = false,
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

  const handleToggleEmoji = () => {
    hapticsManager.impact();
    onToggleEmoji();
  };

  if (isRecording || voiceBlob) return null;

  return (
    <div className={styles['input-pill']}>
      <button 
        className={styles['btn-emoji-icon']} 
        onClick={handleToggleEmoji}
        title="Emoji"
        type="button"
      >
        <Smile size={24} />
      </button>

      <div className={styles['auto-resize-wrapper']}>
        <span className={styles['textarea-mirror']}>{message + '\n'}</span>
        <textarea
          ref={textareaRef}
          className={`${styles['chat-input']} ${isTempChat ? styles['vanish-input'] : ''}`}
          placeholder={externalDisabled ? disabledPlaceholder : (isTempChat ? "Secret message..." : "Type a message...")}
          value={message}
          onChange={onInputChange}
          onKeyDown={onKeyDown}
          rows={1}
          disabled={isUploading || externalDisabled}
          // [PRIVACY] Disable keyboard learning/suggestions in Vanish Mode
          autoComplete={isTempChat ? "off" : "on"}
          autoCorrect={isTempChat ? "off" : "on"}
          spellCheck={!isTempChat}
          data-private={isTempChat}
          inputMode={isTempChat ? "text" : undefined}
        />
      </div>

      <button 
        className={styles['btn-attach-icon']} 
        onClick={handleToggleAttachment}
        title="Attach"
        type="button"
      >
        <Paperclip size={22} />
      </button>
    </div>
  );
};

export default InputBar;
