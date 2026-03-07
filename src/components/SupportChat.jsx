import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Check, CheckCheck, Plus, X, Image as ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSupabase } from '../contexts/SupabaseContext';
import { realtimeManager } from '../utils/realtimeManager';
import useAuthStore from '../store/authStore';
import './support/SupportChat.css';

const SupportChat = () => {
  const navigate = useNavigate();
  const { supabase } = useSupabase();
  const currentUser = useAuthStore((state) => state.dbUser);

  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [showNewRequest, setShowNewRequest] = useState(false);
  const [category, setCategory] = useState('general');
  const [subject, setSubject] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const messagesEndRef = useRef(null);
  const mountedRef = useRef(true);

  // Use a ref for the latest loadMessages to avoid stale closure in realtime handler
  const loadMessagesRef = useRef(null);

  const loadMessages = useCallback(async () => {
    if (!currentUser || !mountedRef.current) return;
    try {
      const { data, error } = await supabase
        .from('support_messages')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const formatted = [];
      (data || []).forEach((msg) => {
        // Add the user's message
        formatted.push({
          id: msg.id,
          text: msg.message,
          sender: msg.message_type === 'user' ? 'user' : 'support',
          timestamp: new Date(msg.created_at),
          status: msg.is_read ? 'read' : 'sent',
          category: msg.category,
          subject: msg.subject,
          attachment_url: msg.attachment_url,
          dbRow: msg,
        });

        // If there's an admin response on this specific message row, add it as a separate message
        if (msg.admin_response) {
          formatted.push({
            id: `${msg.id}-reply`,
            text: msg.admin_response,
            sender: 'support',
            timestamp: new Date(msg.responded_at || msg.updated_at),
            status: 'read',
            isReply: true
          });
        }
      });

      // If no messages yet, show a welcome message locally (not stored in DB)
      if (formatted.length === 0) {
        formatted.push(
          {
            id: 'welcome-1',
            text: '👋 Welcome to CaBa Support!',
            sender: 'support',
            timestamp: new Date(),
            status: 'read',
            isLocal: true,
          },
          {
            id: 'welcome-2',
            text: "How can we help you today? Feel free to share your questions, suggestions, or any issues you're facing with the app.",
            sender: 'support',
            timestamp: new Date(),
            status: 'read',
            isLocal: true,
          }
        );
      }

      setMessages(formatted);
    } catch (error) {
      console.error('Error loading support messages:', error);
    } finally {
      setLoading(false);
    }
  }, [currentUser, supabase]);

  loadMessagesRef.current = loadMessages;

  useEffect(() => {
    mountedRef.current = true;
    loadMessages();

    // Real-time subscription for admin responses
    const channelName = `support_${currentUser?.id}`;
    if (currentUser?.id) {
      realtimeManager.subscribe(
        channelName,
        {},
        {
          postgres_changes: [{
            event: '*',
            schema: 'public',
            table: 'support_messages',
            filter: `user_id=eq.${currentUser.id}`,
            handler: (payload) => {
              console.log('[SupportChat] Realtime update:', payload.eventType);
              loadMessagesRef.current?.();
            }
          }],
          onReconnect: () => {
            console.log('[SupportChat] Reconnected, catching up...');
            loadMessagesRef.current?.();
          }
        }
      );
    }

    return () => {
      mountedRef.current = false;
      if (currentUser?.id) {
        realtimeManager.unsubscribe(channelName);
      }
    };
  }, [currentUser?.id, loadMessages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if ((!newMessage.trim() && !showNewRequest) || !currentUser) return;

    const messageContent = newMessage.trim();
    const currentCategory = category;
    const currentSubject = subject;
    const currentAttachment = attachment;

    setNewMessage('');
    setAttachment(null);
    if (showNewRequest) {
      setIsSubmitting(true);
    }

    // Optimistic update
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg = {
      id: tempId,
      text: messageContent,
      sender: 'user',
      timestamp: new Date(),
      status: 'sending',
      category: currentCategory,
      subject: currentSubject,
      attachment_url: currentAttachment ? URL.createObjectURL(currentAttachment) : null
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      let attachmentUrl = null;
      let attachmentType = null;

      if (currentAttachment) {
        const fileExt = currentAttachment.name.split('.').pop();
        const fileName = `${currentUser.id}/${Date.now()}.${fileExt}`;
        const filePath = `support/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('media')
          .upload(filePath, currentAttachment);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('media')
          .getPublicUrl(filePath);

        attachmentUrl = publicUrl;
        attachmentType = currentAttachment.type.startsWith('image/') ? 'image' : 'document';
      }

      const { data, error } = await supabase
        .from('support_messages')
        .insert({
          user_id: currentUser.id,
          message: messageContent,
          message_type: 'user',
          is_read: false,
          category: currentCategory,
          subject: currentSubject,
          status: 'open',
          attachment_url: attachmentUrl,
          attachment_type: attachmentType
        })
        .select()
        .single();

      if (error) throw error;

      if (showNewRequest) {
        setShowNewRequest(false);
        setSubject('');
        setCategory('general');
      }

      // Replace optimistic message with real one
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === tempId
            ? { ...msg, id: data.id, status: 'sent', dbRow: data }
            : msg
        )
      )
    } catch (error) {
      console.error('Error sending support message:', error);
      // Rollback optimistic update
      setMessages((prev) => prev.filter((msg) => msg.id !== tempId));
    } finally {
      if (showNewRequest) {
        setIsSubmitting(false);
      }
    }
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

  if (loading) {
    return (
      <div className="support-chat-container">
        <header className="support-chat-header">
          <div className="header-left">
            <button className="back-btn" onClick={() => navigate('/')}>
              <ArrowLeft size={20} />
            </button>
          </div>
          <div className="header-center">
            <div className="support-info">
              <h3>Support Center</h3>
              <span className="support-status">Loading...</span>
            </div>
          </div>
        </header>
        <div className="support-messages" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
            style={{ width: 30, height: 30, border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#38bdf8', borderRadius: '50%' }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="support-chat-container">
      {/* Header */}
      <header className="support-chat-header">
        <div className="header-left">
          <button className="back-btn" onClick={() => navigate('/')}>
            <ArrowLeft size={20} />
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
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="new-request-btn"
            onClick={() => setShowNewRequest(true)}
          >
            <Plus size={16} /> New Request
          </motion.button>
        </div>
      </header>

      {/* Messages */}
      <div className="support-messages">
        <div className="messages-list">
          {messages.map((message) => (
            <motion.div
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={message.id}
              className={`message-item ${message.sender === 'user' ? 'user-message' : 'support-message'}`}
            >
              <div className="message-content">
                {message.subject && <div className="message-subject">Re: {message.subject}</div>}
                {message.category && <div className="message-category">#{message.category}</div>}
                <p>{message.text}</p>
                {message.attachment_url && (
                  <div className="message-attachment">
                    <img src={message.attachment_url} alt="Attachment" />
                  </div>
                )}
                <div className="message-footer">
                  <span className="message-time">{formatTime(message.timestamp)}</span>
                  {message.sender === 'user' && (
                    <span className="message-status">
                      {message.status === 'sending' ? (
                        '...'
                      ) : message.status === 'sent' ? (
                        <Check size={14} />
                      ) : (
                        <CheckCheck size={14} />
                      )}
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Message Input */}
      <div className="support-input-area">
        <div className="input-container">
          <input
            type="text"
            placeholder="How can we help?"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            className="message-input"
          />
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="send-btn"
            onClick={handleSendMessage}
            disabled={!newMessage.trim()}
          >
            <Send size={18} />
          </motion.button>
        </div>
      </div>

      {/* New Request Modal */}
      <AnimatePresence>
        {showNewRequest && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="new-request-overlay"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="new-request-modal"
            >
              <header className="modal-header">
                <h3>Submit New Feedback</h3>
                <button className="close-btn" onClick={() => setShowNewRequest(false)}>
                  <X size={20} />
                </button>
              </header>
              <div className="modal-body">
                <div className="form-group">
                  <label>Subject</label>
                  <input
                    type="text"
                    placeholder="Brief summary..."
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Category</label>
                  <select value={category} onChange={(e) => setCategory(e.target.value)}>
                    <option value="general">General Inquiry</option>
                    <option value="technical">Technical Issue</option>
                    <option value="billing">Billing/Payment</option>
                    <option value="bug">Report a Bug</option>
                    <option value="suggestion">Feature Suggestion</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Message</label>
                  <textarea
                    placeholder="Tell us what happened..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    rows={4}
                  />
                </div>
                <div className="form-group">
                  <label>Attachment</label>
                  <div className="file-upload-container">
                    <input
                      type="file"
                      id="support-file"
                      accept="image/*"
                      onChange={(e) => setAttachment(e.target.files[0])}
                      style={{ display: 'none' }}
                    />
                    <label htmlFor="support-file" className="file-upload-label" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      <ImageIcon size={18} />
                      {attachment ? attachment.name : 'Click to upload screenshot'}
                    </label>
                    {attachment && (
                      <button className="clear-attachment" onClick={() => setAttachment(null)} style={{ border: 'none', background: 'transparent', color: '#ef4444', marginTop: '8px', cursor: 'pointer' }}>Remove</button>
                    )}
                  </div>
                </div>
              </div>
              <footer className="modal-footer">
                <button
                  className="cancel-btn"
                  onClick={() => setShowNewRequest(false)}
                  disabled={isSubmitting}
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="submit-btn"
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || !subject.trim() || isSubmitting}
                  style={{ border: 'none', color: 'white', cursor: 'pointer', fontWeight: 700 }}
                >
                  {isSubmitting ? 'Sending...' : 'Send Request'}
                </motion.button>
              </footer>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SupportChat;