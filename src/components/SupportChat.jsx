import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Check, CheckCheck } from 'lucide-react';
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
    if (!newMessage.trim() || !currentUser) return;

    const messageText = newMessage.trim();
    setNewMessage('');

    // Optimistic update
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg = {
      id: tempId,
      text: messageText,
      sender: 'user',
      timestamp: new Date(),
      status: 'sending',
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      const { data, error } = await supabase
        .from('support_messages')
        .insert({
          user_id: currentUser.id,
          message: messageText,
          message_type: 'user',
          is_read: false,
        })
        .select()
        .single();

      if (error) throw error;

      // Replace optimistic message with real one
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === tempId
            ? { ...msg, id: data.id, status: 'sent', dbRow: data }
            : msg
        )
      );
    } catch (error) {
      console.error('Error sending support message:', error);
      // Rollback optimistic update
      setMessages((prev) => prev.filter((msg) => msg.id !== tempId));
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
              <ArrowLeft size={24} />
            </button>
          </div>
          <div className="header-center">
            <div className="support-info">
              <h3>CaBa Support</h3>
              <span className="support-status">Loading...</span>
            </div>
          </div>
        </header>
        <div className="support-messages" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p>Loading messages...</p>
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
          {messages.map((message) => (
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