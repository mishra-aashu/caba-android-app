import { create } from 'zustand';

/**
 * useChatStore - Zustand store for optimized chat message management
 * 
 * This store is designed for PERFECT 60fps performance by using selective
 * subscriptions. Components only subscribe to what they need:
 * 
 * - ChatScreen: Does NOT subscribe to messages (remains static)
 * - ChatList (Virtuoso): Subscribes ONLY to messages array
 * - ChatInput: Subscribes ONLY to addMessage action
 * 
 * This prevents the "full screen re-render" problem when new messages arrive.
 */

const useChatStore = create((set, get) => ({
  // ─── STATE ─────────────────────────────────────────────────────────────
  roomMessages: {}, // Format: { [chatId]: messages[] }
  roomScrollPositions: {}, // Format: { [chatId]: index }
  isSyncing: false,

  // ─── ACTIONS ──────────────────────────────────────────────────────────

  /**
   * Add a new message to a specific chat room
   * @param {string} chatId - The ID of the chat room
   * @param {Object} newMessage - The message object to add
   */
  addMessage: (chatId, newMessage) => {
    if (!chatId) return;
    set((state) => {
      const currentMessages = state.roomMessages[chatId] || [];
      // Prevent duplicates by checking both real id AND tempId
      const exists = currentMessages.some(
        msg =>
          (newMessage.id && msg.id === newMessage.id) ||
          (newMessage.tempId && msg.tempId === newMessage.tempId)
      );
      if (exists) return state;

      return {
        roomMessages: {
          ...state.roomMessages,
          [chatId]: [...currentMessages, newMessage]
        }
      };
    });
  },

  /**
   * Set messages for a chat room — merges with existing optimistic (temp) messages.
   * This prevents the blank-screen flash when React Query refetches after a send.
   */
  setMessages: (chatId, newMessages) => {
    if (!chatId) return;
    set((state) => {
      const current = state.roomMessages[chatId] || [];
      const now = new Date();

      // PROTECT RECENT MESSAGES: Keep any message that is NOT in the new batch 
      // but was either optimistic (tempId) OR sent very recently (within 5 mins).
      // This prevents disappearance during the "stale refetch" window.
      const protectedMessages = current.filter(msg => {
        const isOptimistic = !!msg.tempId;
        const msgTime = new Date(msg.createdAt || msg.created_at || now);
        const isVeryRecent = (now - msgTime) < 1000 * 60 * 5; // 5 minutes grace period

        const isInNewBatch = newMessages.some(m =>
          (msg.id && m.id === msg.id) ||
          (msg.tempId && m.tempId === msg.tempId) ||
          (m.tempId && m.tempId === msg.id)
        );

        return (isOptimistic || isVeryRecent) && !isInNewBatch;
      });

      // Combine: Server messages take priority (newer first usually); append protected messages
      // Note: We filter out any protected message that survived the isInNewBatch check but 
      // is actually conceptually older than what we want to keep (though append is safest here).
      const merged = [...newMessages];

      // Add protected messages that aren't already there
      protectedMessages.forEach(msg => {
        if (!merged.some(m => m.id === msg.id || (msg.tempId && m.tempId === msg.tempId))) {
          merged.push(msg);
        }
      });

      // Sort merged array by created_at ascending (oldest first, newest at bottom)
      merged.sort((a, b) => {
        const timeA = new Date(a.createdAt || a.created_at || 0);
        const timeB = new Date(b.createdAt || b.created_at || 0);
        return timeA - timeB;
      });

      return {
        roomMessages: {
          ...state.roomMessages,
          [chatId]: merged
        }
      };
    });
  },

  /**
   * Update a specific message in a chat room
   * @param {string} chatId - The ID of the chat room
   * @param {string} messageId - The ID of the message to update
   * @param {Object} updates - The updates to apply
   */
  updateMessage: (chatId, messageId, updates) => {
    if (!chatId) return;
    set((state) => ({
      roomMessages: {
        ...state.roomMessages,
        [chatId]: (state.roomMessages[chatId] || []).map(msg =>
          // Match by real id OR by tempId (for optimistic messages)
          (msg.id === messageId || msg.tempId === messageId)
            ? { ...msg, ...updates }
            : msg
        )
      }
    }));
  },

  /**
   * Remove a message by ID from a chat room
   * @param {string} chatId - The ID of the chat room
   * @param {string} messageId - The ID of the message to remove
   */
  removeMessage: (chatId, messageId) => {
    if (!chatId) return;
    set((state) => ({
      roomMessages: {
        ...state.roomMessages,
        [chatId]: (state.roomMessages[chatId] || []).filter(msg => msg.id !== messageId)
      }
    }));
  },

  /**
   * Clear all messages for a specific room
   * @param {string} chatId - The ID of the chat room
   */
  clearRoomMessages: (chatId) => {
    if (!chatId) return;
    set((state) => {
      const newRoomMessages = { ...state.roomMessages };
      delete newRoomMessages[chatId];
      return { roomMessages: newRoomMessages };
    });
  },

  /**
   * Replace a temp message with the real one in a specific room
   * @param {string} chatId - The ID of the chat room
   * @param {string|number} tempId - The temp ID of the message
   * @param {Object} realMessage - The real message from the server
   */
  replaceTempMessage: (chatId, tempId, realMessage) => {
    if (!chatId) return;
    set((state) => ({
      roomMessages: {
        ...state.roomMessages,
        [chatId]: (state.roomMessages[chatId] || []).map(msg =>
          msg.tempId === tempId ? realMessage : msg
        )
      }
    }));
  },

  /**
   * Save the scroll position for a specific chat room
   * @param {string} chatId 
   * @param {number} index 
   */
  saveScrollPosition: (chatId, index) => {
    if (!chatId) return;
    set((state) => ({
      roomScrollPositions: {
        ...state.roomScrollPositions,
        [chatId]: index
      }
    }));
  },

  setSyncing: (status) => set({ isSyncing: status }),
}));

// ─── SELECTORS ──────────────────────────────────────────────────────────
// These selectors are designed for PERFECT granular re-render control

const EMPTY_ARRAY = [];

/**
 * Select the messages array for a specific chatId
 */
export const selectRoomMessages = (chatId) => (state) => state.roomMessages[chatId] || EMPTY_ARRAY;

/**
 * Select only the addMessage function
 * Use this in MessageInput - this selector NEVER changes
 * so the component will NEVER re-render when messages change
 */
export const selectAddMessage = (state) => state.addMessage;

/**
 * Select the setMessages function for direct calling
 * Use this when you need to update the store from outside a component
 */
export const selectSetMessages = (state) => state.setMessages;

/**
 * Select the entire store (for debugging)
 */
export const selectAll = (state) => state;

/**
 * Select the scroll position for a specific chatId
 */
export const selectRoomScrollPosition = (chatId) => (state) => state.roomScrollPositions[chatId];

/**
 * Select the sync status
 */
export const selectIsSyncing = (state) => state.isSyncing;

export default useChatStore;
