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

  addMessage: (chatId, newMessage) => {
    if (!chatId) return;
    set((state) => {
      const currentMessages = state.roomMessages[chatId] || [];

      const map = new Map();
      const clientIdMap = new Map(); // client_id -> messageId

      // Load existing
      currentMessages.forEach(msg => {
        const id = msg.id || msg.clientId || msg.client_id || msg.tempId;
        if (!id) return;
        map.set(id, msg);

        const cId = msg.clientId || msg.client_id || msg.tempId;
        if (cId) clientIdMap.set(cId, id);
      });

      // Correlation Logic (Rule 6)
      // If this is a server message that has a correlation ID, find and remove the optimistic version
      const incomingClientId = newMessage.clientId || newMessage.client_id || newMessage.tempId;
      if (newMessage.id && incomingClientId && clientIdMap.has(incomingClientId)) {
        const oldId = clientIdMap.get(incomingClientId);
        if (oldId !== newMessage.id) {
          map.delete(oldId);
        }
      }

      // Add/Update
      map.set(newMessage.id || incomingClientId, newMessage);

      // Rule 1: Map-based sort and back to array
      const merged = Array.from(map.values()).sort((a, b) => {
        const dateA = new Date(a.createdAt || a.created_at || 0);
        const dateB = new Date(b.createdAt || b.created_at || 0);
        const timeA = isNaN(dateA.getTime()) ? 0 : dateA.getTime();
        const timeB = isNaN(dateB.getTime()) ? 0 : dateB.getTime();

        if (timeA !== timeB) return timeA - timeB;

        // Tiebreaker: stable IDs
        const idA = String(a.id || a.clientId || a.client_id || a.tempId || '');
        const idB = String(b.id || b.clientId || b.client_id || b.tempId || '');
        return idA.localeCompare(idB);
      });

      return {
        roomMessages: {
          ...state.roomMessages,
          [chatId]: merged
        }
      };
    });
  },

  setMessages: (chatId, newMessages) => {
    if (!chatId) return;
    set((state) => {
      const current = state.roomMessages[chatId] || [];
      const now = new Date();

      const map = new Map();
      const clientIdMap = new Map();

      // 1. Identify "Protected" messages (Optimistic or very recent)
      current.forEach(msg => {
        const hasId = !!msg.id;
        const cId = msg.clientId || msg.client_id || msg.tempId;
        const isOptimistic = !!cId && !hasId;

        const msgTime = new Date(msg.createdAt || msg.created_at || now);
        const timeValue = isNaN(msgTime.getTime()) ? now.getTime() : msgTime.getTime();
        const isVeryRecent = (now.getTime() - timeValue) < 1000 * 60 * 5; // 5 min grace

        if (isOptimistic || isVeryRecent) {
          const id = msg.id || cId;
          if (id) {
            map.set(id, msg);
            if (cId) clientIdMap.set(cId, id);
          }
        }
      });

      // 2. Merge Server batch
      newMessages.forEach(msg => {
        const incomingClientId = msg.clientId || msg.client_id || msg.tempId;
        // Reconcile
        if (msg.id && incomingClientId && clientIdMap.has(incomingClientId)) {
          const oldId = clientIdMap.get(incomingClientId);
          if (oldId !== msg.id) {
            map.delete(oldId);
          }
        }
        map.set(msg.id || incomingClientId, msg);
      });

      const merged = Array.from(map.values()).sort((a, b) => {
        const dateA = new Date(a.createdAt || a.created_at || 0);
        const dateB = new Date(b.createdAt || b.created_at || 0);
        const timeA = isNaN(dateA.getTime()) ? 0 : dateA.getTime();
        const timeB = isNaN(dateB.getTime()) ? 0 : dateB.getTime();

        if (timeA !== timeB) return timeA - timeB;

        const idA = String(a.id || a.clientId || a.client_id || a.tempId || '');
        const idB = String(b.id || b.clientId || b.client_id || b.tempId || '');
        return idA.localeCompare(idB);
      });

      return {
        roomMessages: {
          ...state.roomMessages,
          [chatId]: merged
        }
      };
    });
  },

  updateMessage: (chatId, messageId, updates) => {
    if (!chatId) return;
    set((state) => ({
      roomMessages: {
        ...state.roomMessages,
        [chatId]: (state.roomMessages[chatId] || []).map(msg =>
          // Match by real id OR by correlation id
          (msg.id === messageId || msg.client_id === messageId || msg.tempId === messageId)
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
