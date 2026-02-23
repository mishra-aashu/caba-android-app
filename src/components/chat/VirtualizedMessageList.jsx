import React, { useRef, useCallback, useEffect, useMemo, memo } from 'react';
import { Virtuoso } from 'react-virtuoso';
import MessageItem from './MessageItem';
import TypingIndicator from './TypingIndicator';

/**
 * VirtualizedMessageList - A high-performance chat message list using react-virtuoso
 * 
 * Features:
 * - Starts at bottom (chat-like behavior)
 * - Dynamic height support for variable message sizes
 * - Auto-scroll to bottom on new messages
 * - Memoized components to prevent unnecessary re-renders
 * - Optimized for mobile performance (60+ FPS)
 */
const VirtualizedMessageList = ({
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
  isLoading,
  isGroupChat,
  onSenderClick,
  isScrolledToBottom,
  onScroll,
  followOutput,
  typingUsers = {},
  initialTopMostItemIndex,
}) => {
  const virtuosoRef = useRef(null);
  const containerRef = useRef(null);
  const prevMessagesLengthRef = useRef(0);
  const isAutoScrollingRef = useRef(false);

  // Determine if we should auto-scroll based on user position
  const shouldAutoScroll = useCallback(() => {
    return isScrolledToBottom || isAutoScrollingRef.current;
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
      
      // Use smooth scroll for new messages, instant for initial load
      const behavior = prevLength === 0 ? 'auto' : 'smooth';
      
      if (virtuosoRef.current) {
        virtuosoRef.current.scrollToIndex({
          index: newLength - 1,
          behavior,
          align: 'end',
        });
      }
      
      // Reset auto-scroll flag after animation
      setTimeout(() => {
        isAutoScrollingRef.current = false;
      }, 300);
    }
    
    prevMessagesLengthRef.current = newLength;
  }, [messages.length, shouldAutoScroll]);

  // Handle scroll events from Virtuoso
  const handleScroll = useCallback((location) => {
    if (onScroll) {
      onScroll(location);
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
        contain: 'strict',
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        paddingTop: 0,
        marginTop: 0,
      }}
    >
      <Virtuoso
        ref={virtuosoRef}
        data={messages}
        initialTopMostItemIndex={initialTopMostItemIndex ?? (messages.length > 0 ? messages.length - 1 : 0)}
        followOutput={followOutput ?? (shouldAutoScroll() ? 'auto' : false)}
        atBottomStateChange={(isAtBottom) => {
          // Optionally notify parent of scroll state
        }}
        itemContent={renderMessage}
        computeItemKey={(index, message) => message?.id || message?.tempId || `msg-${index}`}
        overscan={200} // Render 200px extra for smoother scrolling
        alignToBottom // Align to bottom like WhatsApp/Telegram
        style={{ 
          flex: 1,
          width: '100%',
          minHeight: 0,
          height: '100%',
          willChange: 'transform', // GPU acceleration hint
        }}
      />
      {/* Typing indicator outside virtuoso to avoid zero-sized element issues */}
      <TypingIndicator isVisible={Object.keys(typingUsers).length > 0} />
    </div>
  );
};


// Memoized export for performance - strict comparison to prevent flickering
export default memo(VirtualizedMessageList, (prevProps, nextProps) => {
  // Don't re-render if messages array is the same reference
  if (prevProps.messages !== nextProps.messages) return false;
  
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
