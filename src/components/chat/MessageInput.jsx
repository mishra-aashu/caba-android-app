import React, { useState, useRef, useEffect, useCallback, useMemo, Suspense, lazy } from 'react';
import { debounce } from 'lodash';
import AttachmentMenu from './AttachmentMenu';
import EmojiRenderer from '../common/EmojiRenderer';
import { Paperclip, MessageSquarePlus, Send, LoaderCircle, X, Image as ImageIcon, Video as VideoIcon, Mic, Square, Trash2, Smile, Play, Pause } from 'lucide-react';
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
  const [voiceChunks, setVoiceChunks] = useState([]); // Array of blobs for pause/resume
  const [voiceBlob, setVoiceBlob] = useState(null); // Final combined blob
  const [waveformPoints, setWaveformPoints] = useState([]); // Volume peaks for visualization
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [previewProgress, setPreviewProgress] = useState(0); // 0 to 1
  const [recordingTime, setRecordingTime] = useState(0);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerIntervalRef = useRef(null);
  const audioPreviewRef = useRef(null);

  const isDesktop = useIsDesktop();
  const textareaRef = useRef(null);
  const containerRef = useRef(null);
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
        setShowEmojiPicker(false); // Close emoji picker on outside click
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

  // Voice Recording Logic
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream; // Store stream to stop tracks later
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const segmentBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setVoiceChunks(prev => {
          const newSegments = [...prev, segmentBlob];
          // Update voiceBlob for preview (merging all so far)
          setVoiceBlob(new Blob(newSegments, { type: 'audio/webm' }));
          return newSegments;
        });
        
        if (!isPaused) { // If stopping for good (not just pause)
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
          }
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      setWaveformPoints([]);
      
      // Web Audio Analysis for Waveform
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const capturePeak = () => {
        if (!isRecording || isPaused) return;
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((src, val) => src + val, 0) / bufferLength;
        const normalized = Math.min(100, Math.max(10, (average / 128) * 100)); // Increased min-height to 10%
        setWaveformPoints(prev => [...prev, normalized].slice(-80)); // Slightly fewer bars for better fit
        animationFrameRef.current = setTimeout(capturePeak, 80); // Slightly faster updates
      };
      capturePeak();

      timerIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      hapticsManager.impact();
    } catch (err) {
      console.error('Error starting recording:', err);
      showAlert('Microphone access denied', 'Please allow microphone access to send voice messages.');
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      setIsPaused(true);
      if (animationFrameRef.current) clearTimeout(animationFrameRef.current);
      mediaRecorderRef.current.stop(); // Stop current segment to get the blob
      clearInterval(timerIntervalRef.current);
      hapticsManager.impact();
    }
  };

  const resumeRecording = () => {
    if (isPaused) {
      setIsPaused(false);
      // Re-start peaks capture
      const capturePeak = () => {
        if (isPaused) return;
        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyserRef.current.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((src, val) => src + val, 0) / bufferLength;
        const normalized = Math.min(100, Math.max(10, (average / 128) * 100));
        setWaveformPoints(prev => [...prev, normalized].slice(-80));
        animationFrameRef.current = setTimeout(capturePeak, 80);
      };
      capturePeak();

      // Start a NEW recorder for the next segment
      const mediaRecorder = new MediaRecorder(streamRef.current);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = () => {
        const segmentBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setVoiceChunks(prev => {
          const newSegments = [...prev, segmentBlob];
          setVoiceBlob(new Blob(newSegments, { type: 'audio/webm' }));
          return newSegments;
        });
      };
      mediaRecorder.start();
      timerIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      hapticsManager.impact();
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setIsPaused(false);
    clearInterval(timerIntervalRef.current);
    hapticsManager.medium();
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (animationFrameRef.current) clearTimeout(animationFrameRef.current);
    if (audioContextRef.current) audioContextRef.current.close();
    
    setIsRecording(false);
    setIsPaused(false);
    clearInterval(timerIntervalRef.current);
    setVoiceBlob(null);
    setVoiceChunks([]);
    setWaveformPoints([]);
    chunksRef.current = [];
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    hapticsManager.notification('warning');
  };

  const togglePreviewPlayback = () => {
    if (!voiceBlob) return;
    
    if (!audioPreviewRef.current) {
      const url = URL.createObjectURL(voiceBlob);
      audioPreviewRef.current = new Audio(url);
      audioPreviewRef.current.onended = () => {
        setIsPlayingPreview(false);
        setPreviewProgress(0);
      };
      audioPreviewRef.current.ontimeupdate = () => {
        const progress = audioPreviewRef.current.currentTime / audioPreviewRef.current.duration;
        setPreviewProgress(progress);
      };
    }

    if (isPlayingPreview) {
      audioPreviewRef.current.pause();
      setIsPlayingPreview(false);
    } else {
      audioPreviewRef.current.play();
      setIsPlayingPreview(true);
    }
    hapticsManager.impact();
  };

  useEffect(() => {
    return () => {
      if (audioPreviewRef.current) {
        audioPreviewRef.current.pause();
        audioPreviewRef.current = null;
      }
    };
  }, []);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSend = async () => {
    if (isRecording && !isPaused) {
      stopRecording();
      return; // Wait for onstop to set voiceBlob for final review or send
    }

    const trimmedMessage = message.trim();
    if (!trimmedMessage && !filePreview && !voiceBlob) return;

    playSendSound();
    hapticsManager.impact();
    setIsUploading(true);

    let mediaPath = null;
    let contentType = 'text';

    try {
      if (voiceBlob) {
        if (!navigator.onLine) {
          onSendMedia(voiceBlob, 'voice'); // Send blob directly for offline
        } else {
          const voiceFile = new File([voiceBlob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });
          mediaPath = await uploadVoiceMessage(voiceFile, currentUser.id);
        }
        contentType = 'voice';
      } else if (filePreview) {
        const { file } = filePreview;
        const fileType = file.type.startsWith('image/') ? 'image' : 'video';
        let processedFile;

        if (fileType === 'image') {
          processedFile = await compressImage(file, imageQuality);
        } else {
          processedFile = await handleVideo(file); // handleVideo is async
        }
        
        if (!processedFile) {
          showAlert('Processing failed', 'Could not process your media file.');
          return;
        }

        if (!navigator.onLine) {
          onSendMedia(processedFile, fileType); // Send processed file directly for offline
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
      // Clear all state regardless of success or failure
      setMessage('');
      setVoiceBlob(null);
      setVoiceChunks([]);
      if (audioPreviewRef.current) {
        audioPreviewRef.current.pause();
        audioPreviewRef.current = null;
      }
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
        {!isRecording && (
          <button 
            className={styles['btn-emoji-icon']} 
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            title="Emoji"
          >
            <Smile size={24} />
          </button>
        )}

        {isRecording ? (
          <div className={styles['recording-ui']}>
            <div className={styles['recording-dot']} style={{ animationPlayState: isPaused ? 'paused' : 'running' }} />
            
            <div className={styles['waveform-container']}>
              {waveformPoints.map((point, i) => (
                <div 
                  key={i} 
                  className={styles['waveform-bar']} 
                  style={{ height: `${point}%` }} 
                />
              ))}
            </div>

            <div className={styles['recording-timer']}>{formatTime(recordingTime)}</div>
            <div className={styles['recording-controls-inner']}>
              {(isPaused && voiceBlob) && (
                <button 
                  className={styles['btn-voice-control']} 
                  onClick={togglePreviewPlayback}
                  title={isPlayingPreview ? "Pause" : "Play"}
                >
                  {isPlayingPreview ? <Pause size={18} /> : <Play size={18} />}
                </button>
              )}
              {isPaused ? (
                <button className={styles['btn-voice-control']} onClick={resumeRecording} title="Resume">
                  <Mic size={18} />
                </button>
              ) : null}
              <button className={styles['btn-cancel-voice']} onClick={cancelRecording}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className={styles['input-pill']}>
            
            {voiceBlob && !isRecording ? (
              <div className={styles['voice-preview']}>
                <button 
                  className={styles['btn-voice-control']} 
                  onClick={togglePreviewPlayback}
                  title={isPlayingPreview ? "Pause" : "Play"}
                >
                  {isPlayingPreview ? <Pause size={18} /> : <Play size={18} />}
                </button>

                <div className={styles['waveform-container']}>
                  {waveformPoints.map((point, i) => {
                    const isPlayed = (i / waveformPoints.length) < previewProgress;
                    return (
                      <div 
                        key={i} 
                        className={`${styles['waveform-bar']} ${isPlayed ? styles['played'] : ''}`} 
                        style={{ height: `${point}%` }} 
                      />
                    );
                  })}
                </div>

                <span className={styles['voice-duration']}>{formatTime(recordingTime)}</span>
                <button 
                  className={styles['btn-delete-voice']} 
                  onClick={() => { 
                    setVoiceBlob(null); 
                    setVoiceChunks([]);
                    if (audioPreviewRef.current) {
                      audioPreviewRef.current.pause();
                      audioPreviewRef.current = null;
                    }
                    hapticsManager.impact(); 
                  }}
                  title="Remove voice message"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            ) : (
              <div className={styles['auto-resize-wrapper']}>
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
            )}

            <button 
              className={styles['btn-attach-icon']} 
              onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
              title="Attach"
            >
              <Paperclip size={22} />
            </button>
          </div>
        )}

        <button
          className={styles['btn-action']}
          onClick={
            (isRecording && !isPaused) ? pauseRecording : 
            (isRecording && isPaused) || voiceBlob || message.trim() || filePreview ? handleSend : 
            startRecording
          }
          disabled={isUploading || externalDisabled}
          title={
            (isRecording && !isPaused) ? "Pause" : 
            (isRecording && isPaused) || voiceBlob || message.trim() || filePreview ? "Send" : 
            "Voice Message"
          }
        >
          {isUploading ? (
            <LoaderCircle size={24} className={styles['animate-spin']} />
          ) : (message.trim() || filePreview || (isRecording && isPaused) || voiceBlob) ? (
            <Send size={24} />
          ) : (isRecording && !isPaused) ? (
            <Pause size={24} />
          ) : (
            <Mic size={24} />
          )}
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
