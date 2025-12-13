import React, { useState, useRef } from 'react';
import AttachmentMenu from './AttachmentMenu';

const MessageInput = ({ 
  onSendMessage, 
  onTyping, 
  replyingTo, 
  onCancelReply,
  chatId,
  receiverId
}) => {
  const [message, setMessage] = useState('');
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const textareaRef = useRef(null);

  // Default quick reply messages
  const quickReplies = [
    'Hello!',
    'How are you?',
    'Thank you!',
    'Sorry',
    'Okay',
    'Yes',
    'No',
    'Please',
    'Good morning',
    'Good night'
  ];

  const handleInputChange = (e) => {
    setMessage(e.target.value);

    // Auto-resize textarea
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 160) + 'px';
    }

    // Trigger typing indicator
    onTyping();
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if (message.trim()) {
      onSendMessage(message.trim());
      setMessage('');
      const textarea = textareaRef.current;
      if (textarea) {
        textarea.style.height = 'auto';
      }
    }
  };

  const toggleAttachmentMenu = () => {
    console.log('Attachment button clicked! Current state:', showAttachmentMenu);
    setShowAttachmentMenu(!showAttachmentMenu);
    setShowQuickReplies(false);
    console.log('New state:', !showAttachmentMenu);
  };

  // Handle file selection from the attachment menu
  const handleFileSelect = async (mediaData) => {
    setIsUploading(true);

    try {
      if (mediaData.type === 'location') {
        // Handle location share
        const locationMessage = `📍 Location: ${mediaData.address}`;
        onSendMessage(locationMessage);
      } else if (mediaData.type === 'contact') {
        // Handle contact share
        const contactMessage = `👤 Contact: ${mediaData.name}${mediaData.phones.length > 0 ? ` (${mediaData.phones[0]})` : ''}`;
        onSendMessage(contactMessage);
      } else if (mediaData.type === 'reminder') {
        // Handle reminder share
        const reminderMessage = `⏰ Reminder: ${mediaData.message}`;
        onSendMessage(reminderMessage);
      } else {
        // Handle media upload (image, video, audio, document)
        const content = mediaData.fileName || 'File';
        onSendMessage(content, {
          mediaUrl: mediaData.mediaUrl,
          mediaType: mediaData.mediaType,
          fileName: mediaData.fileName,
          fileSize: mediaData.fileSize,
          mimeType: mediaData.mimeType
        });
      }

      // Reset state
      setMessage('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }

    } catch (error) {
      console.error('Error handling file selection:', error);
      alert('Failed to process file: ' + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleQuickReply = (reply) => {
    onSendMessage(reply);
    setShowQuickReplies(false);
  };

  const toggleQuickReplies = () => {
    setShowQuickReplies(!showQuickReplies);
    setShowAttachmentMenu(false);
  };

  return (
    <div className="chat-input-container">
      {/* Reply Preview */}
      {replyingTo && (
        <div className="reply-preview-bar">
          <div className="reply-preview-content">
            <div className="reply-author">
              Replying to {replyingTo.sender_id === JSON.parse(localStorage.getItem('currentUser')).id ? 'You' : 'Them'}
            </div>
            <div className="reply-text">{replyingTo.content}</div>
          </div>
          <button className="reply-close-btn" onClick={onCancelReply}>
            <i className="fas fa-times"></i>
          </button>
        </div>
      )}

      <div className="input-row">
        <button
          className="btn-attach"
          onClick={toggleAttachmentMenu}
          title="Attach Media"
        >
          <i className="fas fa-paperclip"></i>
        </button>

        <button
          className="btn-quick-reply"
          onClick={toggleQuickReplies}
          title="Quick Replies"
        >
          <i className="fas fa-comment-dots"></i>
        </button>

        <textarea
          ref={textareaRef}
          className="chat-input"
          placeholder="Type a message..."
          value={message}
          onChange={handleInputChange}
          onKeyPress={handleKeyPress}
          rows={2}
          disabled={isUploading}
        />

        <button
          className="btn-send"
          onClick={handleSend}
          disabled={!message.trim() || isUploading}
        >
          <span id="sendIcon">
            {isUploading ? (
              <i className="fas fa-spinner fa-spin"></i>
            ) : (
              <i className="fas fa-paper-plane"></i>
            )}
          </span>
        </button>
      </div>

      {/* WhatsApp-Style Attachment Menu */}
      <AttachmentMenu
        isVisible={showAttachmentMenu}
        onFileSelect={handleFileSelect}
        onClose={() => setShowAttachmentMenu(false)}
        chatId={chatId}
        receiverId={receiverId}
      />

      {/* Quick Replies Menu */}
      {showQuickReplies && (
        <div className="quick-replies-menu">
          {quickReplies.map((reply, index) => (
            <button
              key={index}
              className="quick-reply-option"
              onClick={() => handleQuickReply(reply)}
            >
              {reply}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default MessageInput;