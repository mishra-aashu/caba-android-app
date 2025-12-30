import React, { useState, useRef } from 'react';
import AttachmentMenu from './AttachmentMenu';
import { Paperclip, MessageSquarePlus, Send, LoaderCircle } from 'lucide-react';

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
  const [isUploading, setIsUploading] = useState(false);
  const textareaRef = useRef(null);

  const quickReplies = [
    'Hello!', 'How are you?', 'Thank you!', 'Sorry', 'Okay', 'Yes', 'No', 'Please', 'Good morning', 'Good night'
  ];

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

  const handleSend = () => {
    if (message.trim()) {
      onSendMessage(message.trim());
      setMessage('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const toggleAttachmentMenu = () => {
    setShowAttachmentMenu(!showAttachmentMenu);
    setShowQuickReplies(false);
  };
  
  const handleFileSelect = async (mediaData) => {
    // This function is now mostly obsolete with the new menu,
    // but the logic can be repurposed when menu items are connected.
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
      {replyingTo && (
        <div className="reply-preview-bar">
          <div className="reply-preview-content">
            <div className="reply-author">
              Replying to {replyingTo.sender_id === JSON.parse(localStorage.getItem('currentUser'))?.id ? 'You' : 'Them'}
            </div>
            <div className="reply-text">{replyingTo.content}</div>
          </div>
          <button className="reply-close-btn" onClick={onCancelReply}>&times;</button>
        </div>
      )}

      <div className="input-row">
        <div className="left-buttons">
          <button
            className="btn-attach"
            onClick={toggleAttachmentMenu}
            title="Attach Media"
          >
            <Paperclip size={22} />
          </button>

          <button
            className="btn-quick-reply"
            onClick={toggleQuickReplies}
            title="Quick Replies"
          >
            <MessageSquarePlus size={22} />
          </button>
        </div>

        <textarea
          ref={textareaRef}
          className="chat-input"
          placeholder="Type a message..."
          value={message}
          onChange={handleInputChange}
          onKeyPress={handleKeyPress}
          rows={1}
          disabled={isUploading}
        />

        <button
          className="btn-send"
          onClick={handleSend}
          disabled={!message.trim() || isUploading}
        >
          {isUploading ? <LoaderCircle size={24} className="animate-spin" /> : <Send size={22} />}
        </button>
      </div>

      <AttachmentMenu 
        isOpen={showAttachmentMenu} 
        onClose={() => setShowAttachmentMenu(false)} 
      />

      {showQuickReplies && (
        <div className="attachment-overlay" onClick={() => setShowQuickReplies(false)}>
          <div className="quick-replies-menu" onClick={(e) => e.stopPropagation()}>
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
        </div>
      )}
    </div>
  );
};

export default MessageInput;