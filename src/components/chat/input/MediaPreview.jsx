import React from 'react';
import { X, Video as VideoIcon } from 'lucide-react';
import styles from '../../../styles/chat.module.css';

const MediaPreview = ({ filePreview, onRemove }) => {
  if (!filePreview) return null;

  return (
    <div className={styles['file-preview-container']}>
      <div className={styles['file-preview']}>
        {filePreview.fileType === 'image' ? (
          <img src={filePreview.previewUrl} alt="preview" />
        ) : (
          <div className={styles['video-preview-icon']}><VideoIcon size={40} /></div>
        )}
        <button className={styles['remove-file-btn']} onClick={onRemove}>
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

export default MediaPreview;
