import React, { useState, useRef, useEffect, useCallback } from 'react';
import AttachmentMenu from './AttachmentMenu';
import EmojiPicker from '../common/EmojiPicker';
import { Paperclip, MessageSquarePlus, Send, LoaderCircle, X, Image as ImageIcon, Video as VideoIcon, Mic, Square, Trash2, Smile } from 'lucide-react';
import { uploadMedia, uploadVoiceMessage } from '../../services/mediaService';
import { compressImage, handleVideo } from '../../utils/mediaCompressor';
import useIsDesktop from '../../hooks/useIsDesktop';

const MessageInput = ({
  onSendMessage,
  onSendMedia,
  onTyping,
  replyingTo,
  onCancelReply,
  currentUser
}) => {
  const [message, setMessage] = useState('');
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const [filePreview, setFilePreview] = useState(null); // { url: '...', file: File }
  const [imageQuality, setImageQuality] = useState('standard'); // 'standard' or 'high'
  const [voiceBlob, setVoiceBlob] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [hasPermission, setHasPermission] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const isDesktop = useIsDesktop();
  const textareaRef = useRef(null);
  const containerRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const canvasRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setShowAttachmentMenu(false);
        setShowQuickReplies(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // Cleanup object URL
  useEffect(() => {
    return () => {
      if (filePreview) {
        URL.revokeObjectURL(filePreview.url);
      }
    };
  }, [filePreview]);

  const handleInputChange = (e) => {
    setMessage(e.target.value);
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
    onTyping();
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = async () => {
    // Prioritize sending voice if available
    if (voiceBlob) {
      setIsUploading(true);
      // Convert blob to file
      const voiceFile = new File([voiceBlob], "voice.webm", { type: "audio/webm" });
      const mediaPath = await uploadVoiceMessage(voiceFile, currentUser.id);
      setIsUploading(false);

      if (mediaPath) {
        onSendMedia(mediaPath, 'voice');
      } else {
        alert('Voice upload failed. Please try again.');
      }
      setVoiceBlob(null);
    }
    // Then media if a file is selected
    else if (filePreview) {
      const { file } = filePreview;
      setIsUploading(true);

      let processedFile;
      const fileType = file.type.startsWith('image/') ? 'image' : 'video';

      if (fileType === 'image') {
        processedFile = await compressImage(file, imageQuality);
      } else { // It's a video
        processedFile = handleVideo(file);
      }

      if (!processedFile) {
        setIsUploading(false);
        setFilePreview(null); // Clear preview on failure (e.g., video too large)
        return;
      }

      const mediaPath = await uploadMedia(processedFile, currentUser.id);
      setIsUploading(false);

      if (mediaPath) {
        onSendMedia(mediaPath, fileType);
      } else {
        alert('Upload failed. Please try again.');
      }
      setFilePreview(null); // Clear preview after sending
    }
    // Fallback to sending a text message
    else if (message.trim()) {
      onSendMessage(message.trim());
      setMessage('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const toggleAttachmentMenu = () => {
    setShowAttachmentMenu(prev => !prev);
  };

  const toggleQuickReplies = () => {
    setShowQuickReplies(prev => !prev);
  };
  
  const handleFileSelect = (file) => {
    if (file) {
      const url = URL.createObjectURL(file);
      setFilePreview({ url, file });
    }
  };

  const cancelFilePreview = () => {
    setFilePreview(null);
  };

  const handleQuickReply = (replyText) => {
    onSendMessage(replyText);
    setShowQuickReplies(false);
  };

  const handleEmojiSelect = (emoji) => {
    // Check if it's a GIF URL (starts with http)
    if (emoji.startsWith('http')) {
      // Send GIF as media message directly
      onSendMedia(emoji, 'image');
    } else {
      // Regular emoji - append to message
      setMessage(prev => prev + emoji);
    }
    setShowEmojiPicker(false);
  };

  const handleVoiceRecord = () => {
    if (!isRecording) {
      startRecording();
    } else {
      stopRecording();
    }
  };



  const resetRecordingState = useCallback(() => {
    setIsRecording(false);
    setRecordingTime(0);
    setVoiceBlob(null);

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    const canvas = canvasRef.current;
    if (canvas) {
      const context = canvas.getContext('2d');
      context.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, []);

  const requestMicrophonePermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setHasPermission(true);
      return true;
    } catch (err) {
      setHasPermission(false);
      alert('Microphone access is required to record audio.');
      return false;
    }
  };

  const visualize = () => {
    if (!analyserRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const canvasCtx = canvas.getContext('2d');
    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationFrameRef.current = requestAnimationFrame(draw);
      analyserRef.current.getByteTimeDomainData(dataArray);

      canvasCtx.fillStyle = 'var(--surface-color, #fff)';
      canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
      canvasCtx.lineWidth = 2;
      canvasCtx.strokeStyle = 'var(--brand-primary, #128c7e)';
      canvasCtx.beginPath();

      const sliceWidth = canvas.width * 1.0 / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = v * canvas.height / 2;

        if (i === 0) {
          canvasCtx.moveTo(x, y);
        } else {
          canvasCtx.lineTo(x, y);
        }
        x += sliceWidth;
      }
      canvasCtx.lineTo(canvas.width, canvas.height / 2);
      canvasCtx.stroke();
    };
    draw();
  };

  const startRecording = async () => {
    const hasPermission = await requestMicrophonePermission();
    if (!hasPermission) return;

    audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    analyserRef.current = audioContextRef.current.createAnalyser();
    const source = audioContextRef.current.createMediaStreamSource(streamRef.current);
    source.connect(analyserRef.current);

    const mediaRecorder = new MediaRecorder(streamRef.current);
    mediaRecorderRef.current = mediaRecorder;
    const chunks = [];
    mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
    mediaRecorder.onstop = () => {
      const completeBlob = new Blob(chunks, { type: 'audio/webm' });
      setVoiceBlob(completeBlob);
    };
    mediaRecorder.start();
    setIsRecording(true);
    setRecordingTime(0);
    visualize();
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  };

  const deleteRecording = () => {
    setVoiceBlob(null);
    setRecordingTime(0);
    setIsRecording(false);
    resetRecordingState();
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="chat-input-container" ref={containerRef} style={{ position: 'relative' }}>
      <AttachmentMenu
        isOpen={showAttachmentMenu}
        onClose={() => setShowAttachmentMenu(false)}
        onFileSelect={handleFileSelect}
      />



      {/* Quick Replies Menu */}
      {showQuickReplies && (
        <div className="quick-replies-menu">
          <div className="quick-reply-option" onClick={() => handleQuickReply("Hello!")}>
            Hello!
          </div>
          <div className="quick-reply-option" onClick={() => handleQuickReply("How are you?")}>
            How are you?
          </div>
          <div className="quick-reply-option" onClick={() => handleQuickReply("Thank you!")}>
            Thank you!
          </div>
          <div className="quick-reply-option" onClick={() => handleQuickReply("See you later!")}>
            See you later!
          </div>
          <div className="quick-reply-option" onClick={() => handleQuickReply("I'm on my way!")}>
            I'm on my way!
          </div>
          <div className="quick-reply-option" onClick={() => handleQuickReply("Yes")}>
            Yes
          </div>
          <div className="quick-reply-option" onClick={() => handleQuickReply("No")}>
            No
          </div>
          <div className="quick-reply-option" onClick={() => handleQuickReply("Okay")}>
            Okay
          </div>
        </div>
      )}

      {/* NEW: Media Preview Area */}
      {filePreview && (
        <div className="media-preview-container">
          <button onClick={cancelFilePreview} className="cancel-preview-btn"><X size={18} /></button>
          {filePreview.file.type.startsWith('image/') ? (
            <img src={filePreview.url} alt="Preview" className="media-thumbnail" />
          ) : (
            <div className="media-thumbnail video">
              <VideoIcon size={40} />
            </div>
          )}

          {filePreview.file.type.startsWith('image/') && (
            <div className="quality-selector">
              <label>
                <input 
                  type="radio" 
                  name="quality" 
                  value="standard"
                  checked={imageQuality === 'standard'} 
                  onChange={(e) => setImageQuality(e.target.value)} 
                />
                Standard
              </label>
              <label>
                <input 
                  type="radio" 
                  name="quality" 
                  value="high"
                  checked={imageQuality === 'high'} 
                  onChange={(e) => setImageQuality(e.target.value)} 
                />
                High
              </label>
            </div>
          )}
        </div>
      )}

      {replyingTo && (
        <div className="reply-preview-container">

          <div className="reply-content">
            {/* Accent Line + Content */}
            <div className="reply-border"></div>

            <div className="reply-details">
              <span className="reply-title">Replying to {replyingTo.sender_id === currentUser?.id ? 'You' : 'Them'}</span>
              <p className="reply-message">
                {/* Agar text lamba ho to cut jayega */}
                {replyingTo.media_type === 'voice' ? '🎤 Voice Message' : replyingTo.content.substring(0, 60) + '...'}
              </p>
            </div>
          </div>

          {/* Close Button */}
          <button className="close-reply-btn" onClick={onCancelReply}>
            ✕
          </button>
        </div>
      )}

      {isRecording && (
        <div className="recording-row">
          <div className="recording-waveform">
            <canvas ref={canvasRef} width={300} height={60}></canvas>
            <div className="recording-timer">{formatTime(recordingTime)}</div>
          </div>
          <div className="recording-controls">
            <button onClick={stopRecording} className="btn-stop-recording" title="Stop Recording">
              <Square size={24} />
            </button>
          </div>
        </div>
      )}

      {!isRecording && (
      <div className="input-row">
        <div className="left-buttons">
          <button
            className="btn-quick-reply"
            onClick={toggleQuickReplies}
            title="Quick Messages"
            disabled={isUploading}
          >
            <MessageSquarePlus size={22} />
          </button>
          <button
            className="btn-attach"
            onClick={toggleAttachmentMenu}
            title="Attach Media"
            disabled={isUploading}
          >
            <Paperclip size={22} />
          </button>
          <button
            className="btn-emoji"
            onClick={() => setShowEmojiPicker(true)}
            title="Add emoji"
            disabled={isUploading}
          >
            <Smile size={22} />
          </button>
          <button
            className="btn-mic"
            onClick={handleVoiceRecord}
            title={isRecording ? "Stop Recording" : "Record Voice"}
            disabled={isUploading}
          >
            {isRecording ? <Square size={22} /> : <Mic size={22} />}
          </button>
        </div>

        <textarea
          ref={textareaRef}
          className="chat-input"
          placeholder={isUploading ? "Uploading..." : (filePreview ? "Add a caption..." : "Type a message...")}
          value={message}
          onChange={handleInputChange}
          onKeyPress={handleKeyPress}
          onContextMenu={isDesktop ? (e) => {
            e.preventDefault();
            setShowEmojiPicker(true);
          } : undefined}
          rows={1}
          disabled={isUploading}
        />

        <button
          className="btn-send"
          onClick={handleSend}
          disabled={(!message.trim() && !filePreview && !voiceBlob) || isUploading}
        >
          {isUploading ? <LoaderCircle size={24} className="animate-spin" /> : <Send size={22} />}
        </button>
      </div>
      )}

      {/* Emoji Picker */}
      {showEmojiPicker && (
        <div className="emoji-picker-overlay" onClick={() => setShowEmojiPicker(false)}>
          <div className="emoji-picker-container" onClick={(e) => e.stopPropagation()}>
            <EmojiPicker
              isOpen={true}
              onEmojiSelect={handleEmojiSelect}
              onClose={() => setShowEmojiPicker(false)}
              showHeader={true}
              showArrow={true}
              showCloseButton={true}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default MessageInput;