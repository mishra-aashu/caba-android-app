import React, { useState, useRef, useEffect, useCallback, useMemo, Suspense, lazy } from 'react';
import { debounce } from 'lodash';
import AttachmentMenu from './AttachmentMenu';
import EmojiRenderer from '../common/EmojiRenderer';
import { Paperclip, MessageSquarePlus, Send, LoaderCircle, X, Image as ImageIcon, Video as VideoIcon, Mic, Square, Trash2, Smile } from 'lucide-react';
import { uploadMedia, uploadVoiceMessage } from '../../services/mediaService';
import { compressImage, handleVideo } from '../../utils/mediaCompressor';
import { useDialog } from '../../contexts/DialogContext';
import useIsDesktop from '../../hooks/useIsDesktop';
import useDraftStore from '../../store/useDraftStore';
import hapticsManager from '../../utils/hapticsManager';
import styles from '../../styles/chat.module.css';

const EmojiPicker = lazy(() => import('../common/EmojiPicker'));

const MAX_MESSAGE_LENGTH = 500;

const MessageInput = ({
  onSendMessage,
  onSendMedia,
  onTyping,
  replyingTo,
  onCancelReply,
  currentUser,
  chatId,
  disabled: externalDisabled = false,
  disabledPlaceholder = "Only admins can send messages"
}) => {
  const { setDraft, getDraft, clearDraft } = useDraftStore();
  const [message, setMessage] = useState('');
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const { showAlert } = useDialog();

  const [filePreview, setFilePreview] = useState(null);
  const [imageQuality, setImageQuality] = useState('standard');
  const [voiceBlob, setVoiceBlob] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const isDesktop = useIsDesktop();
  const textareaRef = useRef(null);
  const containerRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);
  const sendSoundRef = useRef(null);
  const baseUrl = import.meta.env.BASE_URL || '/';

  useEffect(() => {
    sendSoundRef.current = new Audio(`${baseUrl}assets/audio/message_send.mp3`);
    sendSoundRef.current.load();
  }, [baseUrl]);

  const playSendSound = useCallback(() => {
    try {
      if (sendSoundRef.current) {
        sendSoundRef.current.currentTime = 0;
        sendSoundRef.current.play().catch(e => console.warn('Send sound blocked:', e));
      }
    } catch (e) {
      console.error('Error playing send sound:', e);
    }
  }, []);

  useEffect(() => {
    if (chatId) {
      const savedDraft = getDraft(chatId);
      setMessage(savedDraft || '');
    }
  }, [chatId, getDraft]);

  const debouncedSaveDraft = useMemo(
    () => debounce((id, content) => {
      if (id) setDraft(id, content);
    }, 500),
    [setDraft]
  );

  const debouncedOnTyping = useMemo(
    () => debounce(() => {
      onTyping();
    }, 500),
    [onTyping]
  );

  useEffect(() => {
    if (chatId && message) {
      debouncedSaveDraft(chatId, message);
    }
    return () => {
      debouncedSaveDraft.flush();
    };
  }, [message, chatId, debouncedSaveDraft]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setShowAttachmentMenu(false);
        setShowQuickReplies(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e) => {
    setMessage(e.target.value);
    debouncedOnTyping();
  };

  const handleFileSelect = (file) => {
    if (!file) return;
    const fileType = file.type.startsWith('image/') ? 'image' : 'video';
    const previewUrl = URL.createObjectURL(file);
    setFilePreview({ file, previewUrl, fileType });
    setShowAttachmentMenu(false);
  };

  const handleSend = async () => {
    playSendSound();
    hapticsManager.impact();
    
    if (voiceBlob) {
      if (!navigator.onLine) {
        onSendMedia(voiceBlob, 'voice');
        setVoiceBlob(null);
        return;
      }
      setIsUploading(true);
      const voiceFile = new File([voiceBlob], "voice.webm", { type: "audio/webm" });
      const mediaPath = await uploadVoiceMessage(voiceFile, currentUser.id);
      setIsUploading(false);
      if (mediaPath) onSendMedia(mediaPath, 'voice');
      setVoiceBlob(null);
    } else if (filePreview) {
      const { file } = filePreview;
      let processedFile;
      const fileType = file.type.startsWith('image/') ? 'image' : 'video';
      if (fileType === 'image') processedFile = await compressImage(file, imageQuality);
      else processedFile = handleVideo(file);
      
      if (!processedFile) {
        setIsUploading(false);
        setFilePreview(null);
        return;
      }

      if (!navigator.onLine) {
        onSendMedia(processedFile, fileType);
        setFilePreview(null);
        return;
      }

      setIsUploading(true);
      const mediaPath = await uploadMedia(processedFile, currentUser.id);
      setIsUploading(false);
      if (mediaPath) onSendMedia(mediaPath, fileType);
      setFilePreview(null);
    } else if (message.trim()) {
      onSendMessage(message.trim());
      setMessage('');
      if (chatId) clearDraft(chatId);
    }
  };

  const handleEmojiSelect = (emoji) => {
    if (emoji.startsWith('http')) {
      onSendMedia(emoji, 'image');
      setShowEmojiPicker(false);
    } else {
      setMessage(prev => prev + emoji);
    }
  };

  return (
    <div className={styles['chat-input-container']} ref={containerRef}>
      <AttachmentMenu
        isOpen={showAttachmentMenu}
        onClose={() => setShowAttachmentMenu(false)}
        onFileSelect={handleFileSelect}
      />

      {filePreview && (
        <div className={styles['file-preview-container']}>
          <div className={styles['file-preview']}>
            {filePreview.fileType === 'image' ? (
              <img src={filePreview.previewUrl} alt="preview" />
            ) : (
              <div className={styles['video-preview-icon']}><VideoIcon size={40} /></div>
            )}
            <button className={styles['remove-file-btn']} onClick={() => setFilePreview(null)}>
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {replyingTo && (
        <div className={styles['reply-preview-container']}>
          <div className={styles['reply-content']}>
            <div className={styles['reply-border']}></div>
            <div className={styles['reply-details']}>
              <span className={styles['reply-title']}>Replying to {replyingTo.sender_id === currentUser?.id ? 'You' : 'Them'}</span>
              <p className={styles['reply-message']}>{replyingTo.content.substring(0, 60)}</p>
            </div>
          </div>
          <button className={styles['close-reply-btn']} onClick={onCancelReply}>✕</button>
        </div>
      )}

      <div className={styles['input-row']}>
        <button 
          className={styles['btn-emoji']} 
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          title="Emoji"
        >
          <Smile size={22} />
        </button>

        <button 
          className={styles['btn-emoji']} 
          onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
          title="Attach"
        >
          <Paperclip size={22} />
        </button>
        
        <div className={styles['auto-resize-container']}>
          <span className={styles['textarea-mirror']}>{message + '\n'}</span>
          <textarea
            ref={textareaRef}
            className={styles['chat-input']}
            placeholder={externalDisabled ? disabledPlaceholder : "Type a message..."}
            value={message}
            onChange={handleInputChange}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
            rows={1}
            disabled={isUploading || externalDisabled}
          />
        </div>

        <button
          className={styles['btn-send']}
          onClick={handleSend}
          disabled={!message.trim() && !filePreview && !voiceBlob}
          title="Send"
        >
          {isUploading ? <LoaderCircle size={22} className={styles['animate-spin']} /> : <Send size={22} />}
        </button>
      </div>

      <Suspense fallback={null}>
        {showEmojiPicker && (
          <EmojiPicker
            isOpen={showEmojiPicker}
            onEmojiSelect={handleEmojiSelect}
            onClose={() => setShowEmojiPicker(false)}
          />
        )}
      </Suspense>
    </div>
  );
};

export default MessageInput;
