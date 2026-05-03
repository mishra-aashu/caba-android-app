import React, { useState, useRef, useEffect, useCallback, useMemo, Suspense, lazy } from 'react';
import debounce from 'lodash/debounce';
import AttachmentMenu from './AttachmentMenu';
import EmojiRenderer from '../common/EmojiRenderer';
import { Send, LoaderCircle, Mic, Pause, Smile, Clock, Settings as SettingsIcon, X } from 'lucide-react';

import { uploadMedia, uploadVoiceMessage } from '../../services/mediaService';
import { compressImage, handleVideo } from '../../utils/mediaCompressor';
import { useDialog } from '../../contexts/DialogContext';
import useIsDesktop from '../../hooks/useIsDesktop';
import useDraftStore from '../../store/useDraftStore';
import hapticsManager from '../../utils/hapticsManager';
import styles from '../../styles/chat.module.css';

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
  isTempChat = false,
  selectedVanishDuration = 86400,
  disabled: externalDisabled = false,
  onOpenVanishSettings,
  onToggleVanish,

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
  const [scheduledAt, setScheduledAt] = useState(null);
  const [showScheduler, setShowScheduler] = useState(false);

  const textareaRef = useRef(null);
  const containerRef = useRef(null);
  const sendSoundRef = useRef(null);
  const baseUrl = import.meta.env.BASE_URL || '/';

  useEffect(() => {
    sendSoundRef.current = new Audio(`${baseUrl}assets/audio/message_send.ogg`);
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
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    return `${Math.floor(seconds / 86400)}d`;
  };


  const handleSend = async (blobOverride = null) => {
    const finalVoiceBlob = blobOverride || voiceBlob;
    const trimmedMessage = message.trim();
    if (!trimmedMessage && !filePreview && !finalVoiceBlob) return;

    playSendSound();
    hapticsManager.impact();
    setIsUploading(true);

    try {
        const vanishAt = isTempChat ? new Date(Date.now() + Number(selectedVanishDuration) * 1000).toISOString() : null;

        if (finalVoiceBlob) {
          onSendMedia(finalVoiceBlob, 'voice', vanishAt);
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

          onSendMedia(processedFile, fileType, vanishAt);
        } else if (trimmedMessage) {
          onSendMessage(trimmedMessage, { vanishAt, scheduledAt });
        }
        
        if (scheduledAt) {
          toast.success(`Message scheduled for ${new Date(scheduledAt).toLocaleString()}`);
        }

    } catch (error) {
      console.error('Error sending message:', error);
      showAlert('Send failed', 'Could not send your message. Please try again.');
    } finally {
      // [FIX #1 — CRITICAL] Added setIsUploading(false)
      // Previously: isUploading was set to true but NEVER reset to false.
      // This permanently disabled the send/mic button after the first message
      // was sent, requiring a full page reload to send another message.
      setIsUploading(false);
      setMessage('');
      setFilePreview(null);
      setIsRecordingUI(false);
      setScheduledAt(null);
      setShowScheduler(false);
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

      {isTempChat && (
        <div className={styles['vanish-indicator-bar']}>
          <div className={styles['vanish-indicator-left']}>
            <Clock size={12} />
            <span>Vanish Mode active ({formatTime(Number(selectedVanishDuration))})</span>
          </div>
          <div className={styles['vanish-indicator-right']}>
            <button 
              className={styles['vanish-settings-btn']} 
              onClick={onOpenVanishSettings}
              title="Vanish Settings"
            >
              <SettingsIcon size={14} />
            </button>
            <button 
              className={styles['vanish-close-btn']} 
              onClick={onToggleVanish}
              title="Turn Off Vanish Mode"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}


      <div className={styles['input-row']}>
        {isRecordingUI || voiceBlob ? (
          <VoiceRecorder
            isExternalRecording={isRecordingUI}
            onRecordingComplete={handleRecordingComplete}
            onCancel={() => setIsRecordingUI(false)}
            formatTime={formatTime}
          />
        ) : (
          <>
            <InputBar
              message={message}
              setMessage={setMessage}
              textareaRef={textareaRef}
              isRecording={isRecordingUI}
              voiceBlob={voiceBlob}
              isUploading={isUploading}
              externalDisabled={externalDisabled}
              disabledPlaceholder={disabledPlaceholder}
              isTempChat={isTempChat}
              onInputChange={handleInputChange}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
              onToggleEmoji={() => setShowEmojiPicker(!showEmojiPicker)}
              onToggleAttachment={() => setShowAttachmentMenu(!showAttachmentMenu)}
            />

            {!isRecordingUI && !voiceBlob && (
              canShowInputBar && !filePreview && !message.trim() ? (
                <button
                  className={styles['btn-action']}
                  onClick={() => setIsRecordingUI(true)}
                  disabled={isUploading || externalDisabled}
                  title="Voice Message"
                >
                  <Mic size={24} />
                </button>
              ) : (
                <div className={styles['send-actions-group']}>
                  <button
                    className={styles['btn-scheduler']}
                    onClick={() => setShowScheduler(!showScheduler)}
                    disabled={isUploading || externalDisabled}
                    title="Schedule Message"
                    style={{ color: scheduledAt ? 'var(--accent-color)' : 'inherit' }}
                  >
                    <Clock size={20} />
                  </button>
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
                </div>
              )
            )}
          </>
        )}
      </div>

      {showScheduler && (
        <div className={styles['scheduler-popover']}>
          <div className={styles['scheduler-header']}>
            <span>Schedule Message</span>
            <button onClick={() => setShowScheduler(false)}>✕</button>
          </div>
          <div className={styles['scheduler-body']}>
            <input 
              type="datetime-local" 
              className={styles['scheduler-input']}
              min={new Date().toISOString().slice(0, 16)}
              onChange={(e) => setScheduledAt(e.target.value ? new Date(e.target.value).getTime() : null)}
            />
            {scheduledAt && (
              <p className={styles['scheduler-preview']}>
                Will be sent on: {new Date(scheduledAt).toLocaleString()}
              </p>
            )}
          </div>
        </div>
      )}

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