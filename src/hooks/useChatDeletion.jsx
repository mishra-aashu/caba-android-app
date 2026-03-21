import { useState, useCallback, useRef, useEffect } from 'react';
import { chatDeletionService } from '../services/chatDeletionService';
import toast from 'react-hot-toast';
import { isNativeWithPlugins, safePluginCall } from '../utils/platformCheck';

export const useChatDeletion = (currentUserId) => {
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedChats, setSelectedChats] = useState([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [undoTimer, setUndoTimer] = useState(null);
  const [pendingDeletions, setPendingDeletions] = useState([]);
  
  // Ref to track if deletion was cancelled
  const isCancelledRef = useRef({});

  // Refs for touch handlers
  const longPressTimerRef = useRef(null);

  const triggerHaptic = (styleName = 'Medium') => {
    if (!isNativeWithPlugins()) {
      if (navigator.vibrate) navigator.vibrate(50);
      return;
    }

    safePluginCall(
      () => import('@capacitor/haptics'),
      (mod, { ImpactStyle }) => mod.Haptics.impact({
        style: ImpactStyle[styleName] || ImpactStyle.Medium
      })
    ).catch(() => {
      if (navigator.vibrate) navigator.vibrate(50);
    });
  };

  const toggleSelectionMode = useCallback(() => {
    setSelectionMode(prev => {
      if (prev) {
        setSelectedChats([]); // Clear selection when exiting
      }
      return !prev;
    });
  }, []);

  const toggleChatSelection = useCallback((chatId) => {
    setSelectedChats(prev => {
      const isSelected = prev.includes(chatId);
      if (isSelected) {
        const next = prev.filter(id => id !== chatId);
        if (next.length === 0) setSelectionMode(false);
        return next;
      } else {
        return [...prev, chatId];
      }
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedChats([]);
    setSelectionMode(false);
  }, []);

  const handleUndo = useCallback(() => {
    setPendingDeletions([]);
    toast.success('Restored');
  }, []);

  const executeDelete = useCallback(async (chatIds) => {
    if (chatIds.length === 0) return;
    
    setIsDeleting(true);
    try {
      await chatDeletionService.deleteBulkChats(chatIds, currentUserId);
      setPendingDeletions(prev => prev.filter(id => !chatIds.includes(id)));
    } catch (error) {
      toast.error('Failed to delete chat');
    } finally {
      setIsDeleting(false);
      clearSelection();
    }
  }, [currentUserId, clearSelection]);

  /**
   * Starts deletion process with a 5s undo delay
   * This logic saves to local storage temporarily to allow undo
   */
  const initiateDelete = useCallback(async (chats) => {
    // chats can be a single chat object or an array of chat IDs
    const chatArray = Array.isArray(chats) ? chats : [chats];
    const chatIds = chatArray.map(c => typeof c === 'string' ? c : c.id);

    setPendingDeletions(chatIds);
    chatIds.forEach(id => { isCancelledRef.current[id] = false; });
    
    // Optimistically update UI
    const toastId = toast.loading('Deleting chat...', {
      duration: 5000,
      position: 'top-center'
    });

    // We'll use a timeout because toast.onClose is inconsistent for action clicks
    const timer = setTimeout(() => {
      const activeDeletions = chatIds.filter(id => !isCancelledRef.current[id]);
      if (activeDeletions.length > 0) {
        executeDelete(activeDeletions);
      }
      toast.dismiss(toastId);
    }, 5000);

    toast.success('Chat deleted', {
      id: toastId,
      icon: '🗑️',
      duration: 5000,
      action: (
        <button 
          onClick={() => {
            chatIds.forEach(id => { isCancelledRef.current[id] = true; });
            clearTimeout(timer);
            handleUndo();
            toast.dismiss(toastId);
          }}
          style={{
            background: 'var(--brand-primary, #00a884)',
            color: 'white',
            border: 'none',
            padding: '6px 12px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: '600'
          }}
        >
          Undo
        </button>
      )
    });
  }, [executeDelete, handleUndo]);

  // Touch event handlers for Mobile Long Press
  const handleTouchStart = useCallback((chatId) => {
    longPressTimerRef.current = setTimeout(() => {
      triggerHaptic('Heavy');
      setSelectionMode(true);
      toggleChatSelection(chatId);
    }, 500);
  }, [toggleChatSelection]);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
  }, []);

  const handleTouchMove = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
  }, []);

  return {
    selectionMode,
    selectedChats,
    isDeleting,
    pendingDeletions,
    toggleSelectionMode,
    toggleChatSelection,
    clearSelection,
    initiateDelete,
    handleUndo,
    handleTouchStart,
    handleTouchEnd,
    handleTouchMove
  };
};
