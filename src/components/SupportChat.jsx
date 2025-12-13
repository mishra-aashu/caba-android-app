import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Check, CheckCheck } from 'lucide-react';
import './support/SupportChat.css';

const SupportChat = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([
    {
      id: 1,
      text: "👋 Welcome to CaBa Support!",
      sender: 'support',
      timestamp: new Date(Date.now() - 300000), // 5 minutes ago
      status: 'read'
    },
    {
      id: 2,
      text: "How can we help you today? Feel free to share your questions, suggestions, or any issues you're facing with the app.",
      sender: 'support',
      timestamp: new Date(Date.now() - 240000), // 4 minutes ago
      status: 'read'
    },
    {
      id: 3,
      text: "You can also check our About page for detailed information about privacy, security, and app features.",
      sender: 'support',
      timestamp: new Date(Date.now() - 180000), // 3 minutes ago
      status: 'read'
    }
  ]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;

    // Get current user info
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');

    const userMessage = {
      id: Date.now(),
      text: newMessage,
      sender: 'user',
      timestamp: new Date(),
      status: 'sent',
      userName: currentUser.name || 'Unknown User',
      userPhone: currentUser.phone || 'Unknown',
      isRead: false
    };

    setMessages(prev => [...prev, userMessage]);
    setNewMessage('');

    // Save to localStorage for admin panel
    const existingMessages = JSON.parse(localStorage.getItem('supportMessages') || '[]');
    existingMessages.push(userMessage);
    localStorage.setItem('supportMessages', JSON.stringify(existingMessages));

    // Simulate support response after a delay
    setTimeout(() => {
      const supportResponse = {
        id: Date.now() + 1,
        text: "Thank you for your message! Our support team will review it and get back to you soon. In the meantime, you can check our About page for more information.",
        sender: 'support',
        timestamp: new Date(),
        status: 'read'
      };
      setMessages(prev => [...prev, supportResponse]);
    }, 2000);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (timestamp) => {
    return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getInitials = (name) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="support-chat-container">
      {/* Header */}
      <header className="support-chat-header">
        <div className="header-left">
          <button className="back-btn" onClick={() => navigate('/')}>
            <ArrowLeft size={24} />
          </button>
        </div>
        <div className="header-center">
          <div className="support-avatar">
            <div className="support-initials">CS</div>
          </div>
          <div className="support-info">
            <h3>CaBa Support</h3>
            <span className="support-status">Online</span>
          </div>
        </div>
        <div className="header-right">
          <span className="support-verified">
            <CheckCheck size={16} />
          </span>
        </div>
      </header>

      {/* Messages */}
      <div className="support-messages">
        <div className="messages-list">
          {messages.map(message => (
            <div
              key={message.id}
              className={`message-item ${message.sender === 'user' ? 'user-message' : 'support-message'}`}
            >
              <div className="message-content">
                <p>{message.text}</p>
                <div className="message-footer">
                  <span className="message-time">{formatTime(message.timestamp)}</span>
                  {message.sender === 'user' && (
                    <span className="message-status">
                      {message.status === 'sent' ? <Check size={14} /> : <CheckCheck size={14} />}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Message Input */}
      <div className="support-input-area">
        <div className="input-container">
          <input
            type="text"
            placeholder="Type your message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            className="message-input"
          />
          <button
            className="send-btn"
            onClick={handleSendMessage}
            disabled={!newMessage.trim()}
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default SupportChat;