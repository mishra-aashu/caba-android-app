import React, { useState, useRef, useEffect, useCallback, useMemo, Suspense, lazy } from 'react';
import debounce from 'lodash/debounce';
import AttachmentMenu from './AttachmentMenu';
import EmojiRenderer from '../common/EmojiRenderer';
import { Send, LoaderCircle, Mic, Pause, Smile } from 'lucide-react';
import { uploadMedia, uploadVoiceMessage } from '../../services/mediaService';
import { compressImage, handleVideo } from '../../utils/mediaCompressor';
import { useDialog } from '../../contexts/DialogContext';
import useIsDesktop from '../../hooks/useIsDesktop';
import useDraftStore from '../../store/useDraftStore';
import hapticsManager from '../../utils/hapticsManager';
import styles from '../../styles/chat.module.css';

// Sub-components
import MediaPreview from './input/MediaPreview';
import VoiceRecorder from './input/VoiceRecorder';
import InputBar from './input/InputBar';

const EmojiPicker = lazy(() => import('../common/EmojiPicker'));

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
  const [isUploading, setIsUploading] = useState(false);
  const { showAlert } = useDialog();

  const [filePreview, setFilePreview] = useState(null);
  const [voiceBlob, setVoiceBlob] = useState(null);
  const [isRecordingUI, setIsRecordingUI] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  
  const textareaRef = useRef(null);
  const containerRef = useRef(null);
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
        setShowEmojiPicker(false);
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

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSend = async (blobOverride = null) => {
    const finalVoiceBlob = blobOverride || voiceBlob;
    const trimmedMessage = message.trim();
    if (!trimmedMessage && !filePreview && !finalVoiceBlob) return;

    playSendSound();
    hapticsManager.impact();
    setIsUploading(true);

    let mediaPath = null;
    let contentType = 'text';

    try {
      if (finalVoiceBlob) {
        if (!navigator.onLine) {
          onSendMedia(finalVoiceBlob, 'voice');
        } else {
          const voiceFile = new File([finalVoiceBlob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });
          mediaPath = await uploadVoiceMessage(voiceFile, currentUser.id);
        }
        contentType = 'voice';
      } else if (filePreview) {
        const { file } = filePreview;
        const fileType = file.type.startsWith('image/') ? 'image' : 'video';
        let processedFile;

        if (fileType === 'image') {
          processedFile = await compressImage(file, 'standard');
        } else {
          processedFile = await handleVideo(file);
        }
        
        if (!processedFile) {
          showAlert('Processing failed', 'Could not process your media file.');
          return;
        }

        if (!navigator.onLine) {
          onSendMedia(processedFile, fileType);
        } else {
          mediaPath = await uploadMedia(processedFile, currentUser.id);
        }
        contentType = fileType;
      } else if (trimmedMessage) {
        onSendMessage(trimmedMessage);
        contentType = 'text';
      }

      if (mediaPath) {
        onSendMedia(mediaPath, contentType);
      }

    } catch (error) {
      console.error('Error sending message:', error);
      showAlert('Send failed', 'Could not send your message. Please try again.');
    } finally {
      setMessage('');
      setVoiceBlob(null);
      setFilePreview(null);
      setIsRecordingUI(false);
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

  const handleRecordingComplete = (blob) => {
    if (blob) {
        handleSend(blob);
    } else {
        setVoiceBlob(null);
        setIsRecordingUI(false);
    }
  };

  const canShowInputBar = !isRecordingUI && !voiceBlob;

  return (
    <div className={styles['chat-input-container']} ref={containerRef}>
      <AttachmentMenu
        isOpen={showAttachmentMenu}
        onClose={() => setShowAttachmentMenu(false)}
        onFileSelect={handleFileSelect}
      />

      <MediaPreview 
        filePreview={filePreview} 
        onRemove={() => setFilePreview(null)} 
      />

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


        <VoiceRecorder 
          isExternalRecording={isRecordingUI}
          onRecordingComplete={handleRecordingComplete}
          onCancel={() => setIsRecordingUI(false)}
          formatTime={formatTime}
        />

        <InputBar 
          message={message}
          setMessage={setMessage}
          textareaRef={textareaRef}
          isRecording={isRecordingUI}
          voiceBlob={voiceBlob}
          isUploading={isUploading}
          externalDisabled={externalDisabled}
          disabledPlaceholder={disabledPlaceholder}
          onInputChange={handleInputChange}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
          onToggleEmoji={() => setShowEmojiPicker(!showEmojiPicker)}
          onToggleAttachment={() => setShowAttachmentMenu(!showAttachmentMenu)}
        />

        {canShowInputBar && !filePreview && !message.trim() ? (
          <button
            className={styles['btn-action']}
            onClick={() => setIsRecordingUI(true)}
            disabled={isUploading || externalDisabled}
            title="Voice Message"
          >
            <Mic size={24} />
          </button>
        ) : (
          <button
            className={styles['btn-action']}
            onClick={() => handleSend()}
            disabled={isUploading || externalDisabled}
            title="Send"
          >
            {isUploading ? (
              <LoaderCircle size={24} className={styles['animate-spin']} />
            ) : (
              <Send size={24} />
            )}
          </button>
        )}
      </div>

      <Suspense fallback={null}>
        {showEmojiPicker && (
          <EmojiPicker
            isOpen={showEmojiPicker}
            onEmojiSelect={handleEmojiSelect}
            onClose={() => setShowEmojiPicker(false)}
            showTrigger={false}
          />
        )}
      </Suspense>
    </div>
  );
};

export default MessageInput;
