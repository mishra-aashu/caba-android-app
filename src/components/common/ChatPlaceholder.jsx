import { ShieldCheck, MessageSquare } from 'lucide-react';
import AppName from './AppName';
import { motion } from 'framer-motion';

const ChatPlaceholder = () => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      width: '100%',
      color: 'var(--text-secondary)',
      textAlign: 'center',
      padding: '2rem',
      backgroundColor: 'var(--bg-color)',
      background: 'radial-gradient(circle at center, var(--surface-color) 0%, var(--bg-color) 100%)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Decorative background element */}
      <div style={{
        position: 'absolute',
        width: '300px',
        height: '300px',
        background: 'var(--brand-primary)',
        filter: 'blur(150px)',
        opacity: 0.05,
        borderRadius: '50%',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none'
      }} />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        style={{ zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}
      >
        <div style={{
          width: '80px',
          height: '80px',
          borderRadius: '24px',
          background: 'rgba(0, 168, 132, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--brand-primary)',
          marginBottom: '2rem',
          boxShadow: '0 8px 32px rgba(0, 168, 132, 0.1)'
        }}>
          <MessageSquare size={40} strokeWidth={1.5} />
        </div>

        <h2 style={{
          fontSize: '1.75rem',
          fontWeight: '700',
          color: 'var(--text-primary)',
          margin: '0 0 1rem 0',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <span style={{ fontSize: '1rem', fontWeight: '500', opacity: 0.6, letterSpacing: '0.05em' }}>WELCOME TO</span>
          <AppName size="large" />
        </h2>

        <div style={{ 
          marginTop: '1.5rem', 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          gap: '1.25rem' 
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.85rem',
            padding: '10px 22px',
            background: 'rgba(0, 168, 132, 0.08)',
            border: '1px solid rgba(0, 168, 132, 0.15)',
            borderRadius: '30px',
            color: 'var(--text-secondary)',
            fontWeight: '500',
            letterSpacing: '0.02em',
            backdropFilter: 'blur(10px)'
          }}>
            <ShieldCheck size={18} color="var(--brand-primary)" />
            <span>End-to-end encrypted system active</span>
          </div>

          <p style={{ 
            maxWidth: '380px', 
            lineHeight: '1.6',
            fontSize: '1rem',
            color: 'var(--text-secondary)',
            opacity: 0.7,
            margin: 0
          }}>
            Select a chat to start a private conversation.
          </p>
        </div>
      </motion.div>
      

    </div>
  );
};

export default ChatPlaceholder;
