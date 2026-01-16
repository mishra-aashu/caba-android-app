import React, { useState, useRef, useEffect } from 'react';
import AttachmentMenu from './AttachmentMenu';
import { Paperclip, MessageSquarePlus, Send, LoaderCircle, X, Image as ImageIcon, Video as VideoIcon } from 'lucide-react';
import { uploadMedia } from '../../services/mediaService';
import { compressImage, handleVideo } from '../../utils/mediaCompressor';

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

  const textareaRef = useRef(null);
  const containerRef = useRef(null);

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
    // Prioritize sending media if a file is selected
    if (filePreview) {
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
                {replyingTo.content.substring(0, 60)}...
              </p>
            </div>
          </div>

          {/* Close Button */}
          <button className="close-reply-btn" onClick={onCancelReply}>
            ✕
          </button>
        </div>
      )}

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
        </div>

        <textarea
          ref={textareaRef}
          className="chat-input"
          placeholder={isUploading ? "Uploading..." : (filePreview ? "Add a caption..." : "Type a message...")}
          value={message}
          onChange={handleInputChange}
          onKeyPress={handleKeyPress}
          rows={1}
          disabled={isUploading}
        />

        <button
          className="btn-send"
          onClick={handleSend}
          disabled={(!message.trim() && !filePreview) || isUploading}
        >
          {isUploading ? <LoaderCircle size={24} className="animate-spin" /> : <Send size={22} />}
        </button>
      </div>
    </div>
  );
};

export default MessageInput;