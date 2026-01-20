import React from 'react';
import EmojiRenderer from '../common/EmojiRenderer';
import './MessageBubble.css'; // CSS file import

// Icon ke liye (agar aapke paas icon library nahi hai to ye SVG use karein)
const BlockIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="#8696a0" style={{marginRight: '5px', verticalAlign: 'middle'}}>
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8 0-4.41 3.59-8 8-8 4.41 0 8 3.59 8 8 0 4.41-3.59 8-8 8zm3.88-11.71L10.7 13.47l-1.59-1.59L7.7 13.3l4.59 4.59 6.6-6.6-1.42-1.42zM12 4c-1.86 0-3.57.65-4.93 1.74l9.67 9.67C17.91 13.88 18.5 12.02 18.5 10c0-4.41-3.59-8-8-8zM5.26 8.26C4.48 9.38 4 10.63 4 12c0 4.41 3.59 8 8 8 1.37 0 2.62-.48 3.74-1.26L5.26 8.26z"></path>
    <path fill="none" d="M0 0h24v24H0z"></path>
    {/* Ye simple block symbol hai (generic) */}
    <circle cx="12" cy="12" r="10" stroke="#667781" strokeWidth="2" fill="none" />
    <line x1="5" y1="5" x2="19" y2="19" stroke="#667781" strokeWidth="2" />
  </svg>
);

const MessageBubble = ({ text, repliedMsg, currentUserId, time, isMine, isDeleted }) => {

  return (
    <div className={`message-container ${isMine ? 'mine' : 'theirs'}`}>
      
      {/* Bubble Box */}
      <div className="bubble">

        {/* Reply Block */}
        {repliedMsg && (
          <div
            className="reply-quote-container"
            onClick={() => {
              const element = document.getElementById(`message-${repliedMsg.id}`);
              if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                element.classList.add('highlight');
                setTimeout(() => element.classList.remove('highlight'), 2000);
              }
            }}
          >
            {/* Green/Accent Bar */}
            <div className="reply-quote-bar"></div>

            <div className="reply-quote-content">
              {/* Name Logic: Agar sender_id meri hai to 'You', nahi to 'User' */}
              <span className="reply-quote-user">
                {repliedMsg.sender_id === currentUserId ? "You" : "User"}
              </span>

              {/* Content Logic: Image hai ya text? */}
              <p className="reply-quote-text">
                {repliedMsg.message_type === 'image'
                  ? <EmojiRenderer text="📷 Photo" />
                  : <EmojiRenderer text={repliedMsg.content?.substring(0, 60) || "..."} />}
              </p>
            </div>
          </div>
        )}

        {/* Actual Message Content */}
        <div className="message-content">

          {/* Text Area */}
          <span className={`text ${isDeleted ? 'deleted-text' : ''}`}>
            {isDeleted && <BlockIcon />}
            <EmojiRenderer text={text} />
          </span>

          {/* Time Area (Ye Float karke end me adjust hoga) */}
          <span className="timestamp">
            {time}
            {/* Blue Ticks (Sirf agar mera message hai) */}
            {isMine && <span className="tick">✓✓</span>}
          </span>

        </div>

        {isMine && <div className="tail-mine"></div>}
      </div>
    </div>
  );
};

export default MessageBubble;