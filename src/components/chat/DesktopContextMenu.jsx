import React from 'react';
import { Reply, Copy, Share2, Edit, Trash2, MousePointer } from 'lucide-react';

const DesktopContextMenu = ({
  position,
  isVisible,
  onReply,
  onCopy,
  onForward,
  onEdit,
  onDelete,
  onSelect,
  isSent,
  onClose
}) => {
  if (!isVisible) return null;

  return (
    <div
      className="context-menu"
      style={{
        top: position.y,
        left: position.x
      }}
    >
      <div className="menu-item" onClick={() => { onSelect(); onClose(); }}>
        <span className="icon"><MousePointer size={16} /></span>
        <span>Select</span>
      </div>

      <div className="menu-item" onClick={() => { onReply(); onClose(); }}>
        <span className="icon"><Reply size={16} /></span>
        <span>Reply</span>
      </div>

      <div className="menu-item" onClick={() => { onCopy(); onClose(); }}>
        <span className="icon"><Copy size={16} /></span>
        <span>Copy</span>
      </div>

      <div className="menu-item" onClick={() => { onForward(); onClose(); }}>
        <span className="icon"><Share2 size={16} /></span>
        <span>Forward</span>
      </div>

      {/* Line Separator */}
      <div className="menu-divider"></div>

      {isSent && (
        <>
          <div className="menu-item" onClick={() => { onEdit(); onClose(); }}>
            <span className="icon"><Edit size={16} /></span>
            <span>Edit</span>
          </div>

          <div className="menu-item delete" onClick={() => { onDelete(); onClose(); }}>
            <span className="icon"><Trash2 size={16} /></span>
            <span>Delete</span>
          </div>
        </>
      )}
    </div>
  );
};

export default DesktopContextMenu;