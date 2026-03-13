import React from 'react';
import { MessageCircle } from 'lucide-react';

const ChatPlaceholder = () => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      color: 'var(--text-secondary)',
      textAlign: 'center',
      padding: '2rem',
      backgroundColor: 'var(--bg-color)'
    }}>
      <MessageCircle size={64} strokeWidth={1.5} />
      <h2 style={{
        fontSize: '1.5rem',
        fontWeight: '600',
        marginTop: '1.5rem',
        color: 'var(--text-primary)'
      }}>
        Welcome to Elevengram
      </h2>
      <p style={{ marginTop: '0.5rem', maxWidth: '300px' }}>
        Select a conversation from the list on the left to start messaging.
      </p>
    </div>
  );
};

export default ChatPlaceholder;
