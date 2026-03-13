// ━━━ ChatFeed.jsx ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import React, { useRef, useEffect } from 'react';
import MediaMessage from './MediaMessage';

export default function ChatFeed({ messages, userId, mediaProgress, onMediaClick }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  return (
    <div className="chat">
      <div className="chat__feed">
        {messages.length === 0 && (
          <div className="chat__empty">
            <p>🎉 Room is live! Say hello or start the game.</p>
          </div>
        )}

        {messages.map((msg, i) => {
          const isMe = msg.senderId === userId || msg.isLocal;
          const time = new Date(msg.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          });

          return (
            <div
              key={msg.id || i}
              className={`chat__bubble ${isMe ? 'chat__bubble--me' : 'chat__bubble--them'}`}
            >
              {!isMe && <span className="chat__sender">{msg.senderName}</span>}

              {msg.type === 'text' ? (
                <p className="chat__text">{msg.text}</p>
              ) : (
                <MediaMessage
                  url={msg.url}
                  mediaType={msg.mediaType}
                  progress={mediaProgress[msg.id]}
                  onClick={() => onMediaClick(msg.url)}
                />
              )}

              <span className="chat__time">{time}</span>
            </div>
          );
        })}

        {/* ── Incoming transfer progress bars ────────── */}
        {Object.entries(mediaProgress).map(([id, progress]) => (
          <div key={id} className="chat__progress-bar">
            <div
              className="chat__progress-fill"
              style={{ width: `${progress * 100}%` }}
            />
            <span className="chat__progress-text">
              Receiving… {Math.round(progress * 100)}%
            </span>
          </div>
        ))}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
