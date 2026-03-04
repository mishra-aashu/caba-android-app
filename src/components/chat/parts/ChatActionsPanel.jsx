/**
 * ChatActionsPanel.jsx
 *
 * Presentational component for the Selection Mode toolbar in a chat.
 * Extracted from Chat.jsx to keep it focused on layout.
 */
import React from 'react';
import { Reply, Copy, ArrowRight, Trash2 } from 'lucide-react';

const ChatActionsPanel = ({
    isSelectionMode,
    selectedMessages,
    messages,
    currentUserId,
    onExit,
    onReply,
    onCopy,
    onForward,
    onDelete,
}) => {
    if (!isSelectionMode) return null;

    const selectedCount = selectedMessages.size;

    const allMine = Array.from(selectedMessages).every(msgId => {
        const msg = messages.find(m => m.id === msgId);
        return msg && (msg.senderId || msg.sender_id) === currentUserId;
    });

    const handleReply = () => {
        const messageId = Array.from(selectedMessages)[0];
        const message = messages.find(msg => msg.id === messageId);
        if (message) onReply(message);
    };

    return (
        <div className="selection-toolbar">
            <button className="selection-close-btn" onClick={onExit}>✕</button>
            <div className="selection-info">{selectedCount} selected</div>
            <div className="selection-actions">
                {selectedCount === 1 && (
                    <>
                        <button className="selection-action-btn" title="Reply" onClick={handleReply}>
                            <Reply size={16} />
                        </button>
                        <button className="selection-action-btn" title="Copy" onClick={onCopy}>
                            <Copy size={16} />
                        </button>
                        <button className="selection-action-btn" title="Forward" onClick={onForward}>
                            <ArrowRight size={16} />
                        </button>
                        {allMine && (
                            <button className="selection-action-btn" title="Delete" onClick={onDelete}>
                                <Trash2 size={16} />
                            </button>
                        )}
                    </>
                )}
                {selectedCount > 1 && (
                    <>
                        <button className="selection-action-btn" title="Copy" onClick={onCopy}>
                            <Copy size={16} />
                        </button>
                        <button className="selection-action-btn" title="Forward" onClick={onForward}>
                            <ArrowRight size={16} />
                        </button>
                        <button className="selection-action-btn" title="Delete" onClick={onDelete}>
                            <Trash2 size={16} />
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

export default ChatActionsPanel;
