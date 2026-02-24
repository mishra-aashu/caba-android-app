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
  messages: [],
  isSyncing: false,

  // ─── ACTIONS ──────────────────────────────────────────────────────────

  /**
   * Add a new message to the messages array
   * @param {Object} newMessage - The message object to add
   */
  addMessage: (newMessage) => {
    set((state) => {
      // Prevent duplicates
      const exists = state.messages.some(msg => msg.id === newMessage.id);
      if (exists) return state;

      return {
        messages: [...state.messages, newMessage]
      };
    });
  },

  /**
   * Add multiple messages at once (for initial load)
   * @param {Array} newMessages - Array of message objects
   */
  setMessages: (newMessages) => {
    set({ messages: newMessages });
  },

  /**
   * Update a specific message
   * @param {string} messageId - The ID of the message to update
   * @param {Object} updates - The updates to apply
   */
  updateMessage: (messageId, updates) => {
    set((state) => ({
      messages: state.messages.map(msg =>
        msg.id === messageId ? { ...msg, ...updates } : msg
      )
    }));
  },

  /**
   * Remove a message by ID
   * @param {string} messageId - The ID of the message to remove
   */
  removeMessage: (messageId) => {
    set((state) => ({
      messages: state.messages.filter(msg => msg.id !== messageId)
    }));
  },

  /**
   * Clear all messages (when switching chats)
   */
  clearMessages: () => {
    set({ messages: [] });
  },

  /**
   * Replace a temp message with the real one
   * @param {string|number} tempId - The temp ID of the message
   * @param {Object} realMessage - The real message from the server
   */
  replaceTempMessage: (tempId, realMessage) => {
    set((state) => ({
      messages: state.messages.map(msg =>
        msg.tempId === tempId ? realMessage : msg
      )
    }));
  },

  setSyncing: (status) => set({ isSyncing: status }),
}));

// ─── SELECTORS ──────────────────────────────────────────────────────────
// These selectors are designed for PERFECT granular re-render control

/**
 * Select only the messages array
 * Use this in VirtualizedMessageList to only re-render when messages change
 */
export const selectMessages = (state) => state.messages;

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
 * Select the sync status
 */
export const selectIsSyncing = (state) => state.isSyncing;

export default useChatStore;
