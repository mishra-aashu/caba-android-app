import React, { useRef, useCallback, useEffect, useMemo, memo } from 'react';
import { Virtuoso } from 'react-virtuoso';
import MessageItem from './MessageItem';
import TypingIndicator from './TypingIndicator';
import useChatStore, { selectMessages } from '../../store/useChatStore';

/**
 * VirtualizedMessageList - A high-performance chat message list using react-virtuoso
 * 
 * Features:
 * - Uses Zustand store for messages (selective subscription for 60fps)
 * - Starts at bottom (chat-like behavior)
 * - Dynamic height support for variable message sizes
 * - Auto-scroll to bottom on new messages
 * - Memoized components to prevent unnecessary re-renders
 * - Optimized for mobile performance (60+ FPS)
 */
const VirtualizedMessageList = ({
  currentUser,
  selectedMessages,
  isSelectionMode,
  onMessageSelect,
  onReply,
  onForward,
  onDelete,
  onEdit,
  onMediaView,
  onMediaDownload,
  isLoading,
  isGroupChat,
  onSenderClick,
  isScrolledToBottom,
  onScroll,
  followOutput,
  typingUsers = {},
  initialTopMostItemIndex,
}) => {
  // 🔥 OPTIMIZED: Subscribe ONLY to messages array from Zustand store
  // This component ONLY re-renders when messages change
  // The ChatScreen parent does NOT re-render because it won't subscribe to messages
  const messages = useChatStore(selectMessages);
  
  const virtuosoRef = useRef(null);
  const containerRef = useRef(null);
  const prevMessagesLengthRef = useRef(0);
  const isAutoScrollingRef = useRef(false);
  const lastMessageCountRef = useRef(messages.length);

  // Determine if we should auto-scroll based on user position
  // Only auto-scroll when user is explicitly at bottom or during initial load
  const shouldAutoScroll = useCallback(() => {
    // Don't auto-scroll if user is manually scrolling up to read older messages
    if (isAutoScrollingRef.current) return true;
    
    // Only auto-scroll if user is already at bottom
    return isScrolledToBottom === true;
  }, [isScrolledToBottom]);

  // Scroll to bottom function exposed to parent
  const scrollToBottom = useCallback((behavior = 'smooth') => {
    if (virtuosoRef.current && messages.length > 0) {
      virtuosoRef.current.scrollToIndex({
        index: messages.length - 1,
        behavior,
        align: 'end',
      });
    }
  }, [messages.length]);

  // Expose scrollToBottom to parent via ref callback
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollToBottom = scrollToBottom;
    }
  }, [scrollToBottom]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    const prevLength = prevMessagesLengthRef.current;
    const newLength = messages.length;

    if (newLength > prevLength && shouldAutoScroll()) {
      // New message arrived - auto-scroll to bottom
      isAutoScrollingRef.current = true;
      
      // Use 'auto' behavior to prevent smooth animation conflicts
      if (virtuosoRef.current) {
        virtuosoRef.current.scrollToIndex({
          index: newLength - 1,
          behavior: 'auto',
          align: 'end',
        });
      }
      
      // Reset auto-scroll flag after a shorter delay
      setTimeout(() => {
        isAutoScrollingRef.current = false;
      }, 100);
    }
    
    prevMessagesLengthRef.current = newLength;
  }, [messages.length, shouldAutoScroll]);

  // Handle scroll events from Virtuoso
  const handleScroll = useCallback((location) => {
    // Track if user is at bottom to prevent unwanted auto-scroll
    const isAtBottom = location?.isAtBottom || false;
    
    if (onScroll) {
      onScroll({
        ...location,
        isAtBottom,
        // Add explicit scroll direction tracking
        isScrollingUp: location?.scrollTop !== undefined && location?.scrollTop > 0
      });
    }
  }, [onScroll]);

  // Memoized message item renderer with zero-height fix
  // Use useMemo instead of useCallback to avoid stale closures
  const renderMessage = useMemo(() => {
    return (index, message) => {
      if (!message) {
        // Return a placeholder with minimum height to prevent zero-sized element
        return (
          <div 
            className="message-item-placeholder" 
            style={{ minHeight: '24px', width: '100%', display: 'block' }}
          />
        );
      }
      
      // Safely get repliedMsg
      const replyTo = message.replyTo || message.reply_to;
      const repliedMsg = replyTo
        ? messages.find(m => m && m.id === replyTo)
        : null;

      // Get message ID for selection state
      const msgId = message.id || message.tempId || `msg-${index}`;
      const isSelected = selectedMessages.has(message.id);
      const msgCurrentUser = currentUser;

      // Wrap in a div with min-height to prevent zero-sized element error
      // Using stable dimensions
      return (
        <div 
          className="virtuoso-message-wrapper"
          style={{ 
            minHeight: '24px', 
            width: '100%',
            overflow: 'hidden',
            display: 'block',
            boxSizing: 'border-box',
          }}
        >
          <MessageItem
            key={msgId}
            message={message}
            repliedMsg={repliedMsg}
            currentUser={msgCurrentUser}
            isSelected={isSelected}
            isSelectionMode={isSelectionMode}
            onSelect={() => onMessageSelect(message.id)}
            onReply={() => onReply(message)}
            onForward={() => onForward(message)}
            onDelete={onDelete}
            onEdit={onEdit}
            onMediaView={onMediaView}
            onMediaDownload={onMediaDownload}
            isGroupChat={isGroupChat}
            onSenderClick={onSenderClick}
          />
        </div>
      );
    };
  }, [
    messages,
    currentUser,
    selectedMessages,
    isSelectionMode,
    onMessageSelect,
    onReply,
    onForward,
    onDelete,
    onEdit,
    onMediaView,
    onMediaDownload,
    isGroupChat,
    onSenderClick,
  ]);

  // Memoized date header renderer
  const renderDateHeader = useCallback((index) => {
    if (index >= messages.length) return null;
    
    const message = messages[index];
    if (!message) return null;
    
    const createdAt = message.created_at ?? message.createdAt;
    if (!createdAt) return null;
    
    const date = new Date(createdAt);
    if (isNaN(date.getTime())) return null;
    
    // Check if this is the first message of the day
    const prevMessage = index > 0 ? messages[index - 1] : null;
    const prevDate = prevMessage 
      ? new Date(prevMessage.created_at ?? prevMessage.createdAt)
      : null;
    
    const isFirstOfDay = !prevDate || date.toDateString() !== prevDate.toDateString();
    
    if (isFirstOfDay) {
      return (
        <div className="date-separator" key={`date-${date.toDateString()}`}>
          <div className="date-pill">
            {date.toLocaleDateString()}
          </div>
        </div>
      );
    }
    
    return null;
  }, [messages]);

  // Combine messages with date headers
  const itemsWithHeaders = useMemo(() => {
    const items = [];
    
    messages.forEach((message, index) => {
      // Add date header if needed
      const createdAt = message?.created_at ?? message?.createdAt;
      if (createdAt) {
        const date = new Date(createdAt);
        const prevMessage = index > 0 ? messages[index - 1] : null;
        const prevDate = prevMessage 
          ? new Date(prevMessage.created_at ?? prevMessage.createdAt)
          : null;
        
        const isFirstOfDay = !prevDate || date.toDateString() !== prevDate.toDateString();
        
        if (isFirstOfDay) {
          items.push({ type: 'date-header', date: date.toDateString(), key: `header-${date.toDateString()}` });
        }
      }
      
      // Add message
      items.push({ type: 'message', message, key: message.id || message.tempId || `msg-${index}` });
    });
    
    return items;
  }, [messages]);

  // Render item with date headers
  const renderItem = useCallback((index) => {
    const item = itemsWithHeaders[index];
    if (!item) return null;
    
    if (item.type === 'date-header') {
      return (
        <div className="date-separator">
          <div className="date-pill">
            {new Date(item.date).toLocaleDateString()}
          </div>
        </div>
      );
    }
    
    const messageIndex = messages.findIndex(m => m.id === item.message?.id || m.tempId === item.message?.tempId);
    return renderMessage(messageIndex, item.message);
  }, [itemsWithHeaders, messages, renderMessage]);

  // Loading state
  if (isLoading) {
    return (
      <div className="messages-wrapper virtuoso-loading">
        <div className="skeleton-messages">
          <div className="skeleton-message received"></div>
          <div className="skeleton-message sent"></div>
          <div className="skeleton-message received"></div>
          <div className="skeleton-message sent"></div>
          <div className="skeleton-message received"></div>
          <div className="skeleton-message sent"></div>
        </div>
      </div>
    );
  }

  // Empty state
  if (!messages || messages.length === 0) {
    return (
      <div className="messages-wrapper virtuoso-empty">
        <div className="no-messages-placeholder">
          <div className="no-messages-content">
            <div className="no-messages-icon">💬</div>
            <h3>No messages yet</h3>
            <p>Start the conversation by sending a message!</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="messages-wrapper virtuoso-container" 
      ref={containerRef}
      style={{ 
        contain: 'content',
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        paddingTop: 0,
        marginTop: 0,
        /* Removed GPU hints to prevent blank screen */
      }}
    >
      <Virtuoso
        ref={virtuosoRef}
        data={messages}
        initialTopMostItemIndex={initialTopMostItemIndex ?? (messages.length > 0 ? messages.length - 1 : 0)}
        followOutput={'auto'} // Always auto for professional behavior
        atBottomStateChange={(isAtBottom) => {
          // Properly track bottom state
          if (onScroll) {
            onScroll({ isAtBottom });
          }
        }}
        atTopStateChange={(isAtTop) => {
          // Track top state for better scroll control
          if (onScroll) {
            onScroll({ isAtTop });
          }
        }}
        itemContent={renderMessage}
        computeItemKey={(index, message) => message?.id || message?.tempId || `msg-${index}`}
        overscan={50} // Reduced for better performance
        alignToBottom={true}
        style={{ 
          flex: 1,
          width: '100%',
          minHeight: 0,
          height: '100%',
          /* Professional scroll behavior */
          overflowY: 'auto',
        }}
      />
      {/* Typing indicator outside virtuoso to avoid zero-sized element issues */}
      <TypingIndicator isVisible={Object.keys(typingUsers).length > 0} />
    </div>
  );
};


// Memoized export for performance - strict comparison to prevent flickering
// Note: messages is now handled by Zustand store subscription, not props
export default memo(VirtualizedMessageList, (prevProps, nextProps) => {
  // Don't re-render for same current user
  if (prevProps.currentUser !== nextProps.currentUser) return false;
  
  // Only re-render on loading state change
  if (prevProps.isLoading !== nextProps.isLoading) return false;
  
  // Only re-render on selection mode change
  if (prevProps.isSelectionMode !== nextProps.isSelectionMode) return false;
  
  // Don't re-render for scroll state changes (causes flicker)
  // We don't need to re-render the whole list just because user scrolled
  
  // Check selected messages count (not deep comparison to avoid flicker)
  if (prevProps.selectedMessages?.size !== nextProps.selectedMessages?.size) return false;
  
  // Check typing users
  const prevTypingCount = Object.keys(prevProps.typingUsers || {}).length;
  const nextTypingCount = Object.keys(nextProps.typingUsers || {}).length;
  if (prevTypingCount !== nextTypingCount) return false;
  
  return true;
});
