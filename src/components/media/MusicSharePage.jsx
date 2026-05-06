import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Send, MessageCircle, Users, ArrowLeft, Search, CheckCircle2 } from 'lucide-react';
import { dpOptions } from '../../utils/dpOptions';
import { getInitials } from '../../utils/stringUtils';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { toast } from 'react-hot-toast';

const MusicSharePage = ({ onShare, onBack }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sendingId, setSendingId] = useState(null);
  const [sentIds, setSentIds] = useState(new Set());

  const chats = useLiveQuery(async () => {
    const rawChats = await db.chats_list.toArray();
    const contacts = await db.contacts.toArray();
    const profiles = await db.user_profiles.toArray();
    
    const contactMap = new Map(contacts.map(c => [c.id, c]));
    const profileMap = new Map(profiles.map(p => [p.id, p]));

    // Sort by most recent interaction (recency)
    const sorted = rawChats.sort((a, b) => {
      const timeA = new Date(a.lastMessageAt || a.timestamp || a.last_message_at || 0).getTime();
      const timeB = new Date(b.lastMessageAt || b.timestamp || b.last_message_at || 0).getTime();
      return timeB - timeA;
    });

    return sorted.map(chat => {
      const isGroup = !!(chat.isGroup || chat.is_group);
      if (isGroup) return { ...chat, resolvedName: chat.name, resolvedAvatar: chat.avatar };
      
      const otherId = chat.otherUserId || chat.id;
      const contact = contactMap.get(otherId);
      const profile = profileMap.get(otherId);

      return {
        ...chat,
        resolvedName: contact?.contactName || contact?.contact_name || profile?.name || chat.name || chat.otherUser?.name,
        resolvedAvatar: profile?.avatar || chat.avatar || chat.otherUser?.avatar
      };
    });
  }) || [];

  const filteredChats = chats.filter(chat => {
    const displayName = chat.resolvedName || (chat.isGroup ? 'Group Chat' : 'Unknown User');
    return displayName.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const handleSend = async (chat) => {
    setSendingId(chat.id);
    await onShare(chat);
    setSendingId(null);
    setSentIds(prev => new Set(prev).add(chat.id));
    
    // Auto-reset "Sent" status after 2 seconds
    setTimeout(() => {
      setSentIds(prev => {
        const next = new Set(prev);
        next.delete(chat.id);
        return next;
      });
    }, 2000);
  };

  return (
    <div className="music-share-page" style={{ paddingTop: '10px' }}>
      {/* Search Bar */}
      <div style={{ position: 'relative', marginBottom: '28px' }}>
        <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', opacity: 0.8, color: 'var(--brand-primary, #00ff88)' }} />
        <input 
          type="text" 
          placeholder="Search friends or groups..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ 
            width: '100%', 
            padding: '16px 16px 16px 48px', 
            borderRadius: '18px', 
            background: 'rgba(255,255,255,0.08)', 
            border: '1px solid rgba(255,255,255,0.15)', 
            color: '#fff',
            fontSize: '1rem',
            outline: 'none',
            boxSizing: 'border-box',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
          }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {filteredChats.length > 0 ? (
          filteredChats.map((chat, idx) => {
            const isGroup = !!(chat.isGroup || chat.is_group);
            const displayName = chat.resolvedName || (isGroup ? 'Group Chat' : 'Unknown User');
            const isSent = sentIds.has(chat.id);
            const isSending = sendingId === chat.id;
            const avatarUrl = chat.resolvedAvatar;

            return (
              <motion.div 
                key={chat.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.03 }}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '14px', 
                  padding: '14px', 
                  borderRadius: '20px', 
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}
              >
                <div style={{ position: 'relative', width: '52px', height: '52px' }}>
                  {isGroup ? (
                    avatarUrl ? (
                      <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', borderRadius: '18px', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', borderRadius: '18px', background: 'var(--brand-primary)', color: '#0b141a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Users size={22} />
                      </div>
                    )
                  ) : (
                    avatarUrl ? (
                      <img 
                        src={parseInt(avatarUrl) ? (dpOptions.find(dp => dp.id === parseInt(avatarUrl))?.path || avatarUrl) : avatarUrl} 
                        alt="" 
                        style={{ width: '100%', height: '100%', borderRadius: '18px', objectFit: 'cover' }} 
                      />
                    ) : (
                      <div style={{ width: '100%', height: '100%', borderRadius: '18px', background: 'rgba(255,255,255,0.15)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                        {getInitials(displayName)}
                      </div>
                    )
                  )}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: '1rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {displayName}
                    {isGroup && <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '6px', background: 'rgba(0, 255, 136, 0.15)', color: '#00ff88', fontWeight: 900 }}>GROUP</span>}
                  </div>
                  <div style={{ fontSize: '0.85rem', opacity: 0.6, color: '#fff', marginTop: '2px' }}>{isGroup ? 'Group Session' : 'Direct Invite'}</div>
                </div>

                <button
                  onClick={() => handleSend(chat)}
                  disabled={isSending || isSent}
                  style={{ 
                    padding: '10px 20px', 
                    borderRadius: '12px', 
                    background: isSent ? 'rgba(0, 255, 136, 0.2)' : isSending ? 'rgba(255,255,255,0.1)' : 'var(--brand-primary)', 
                    color: isSent ? '#00ff88' : isSending ? '#fff' : '#0b141a',
                    border: 'none',
                    fontWeight: 900,
                    fontSize: '0.8rem',
                    cursor: (isSending || isSent) ? 'default' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    minWidth: '80px',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {isSending ? '...' : isSent ? <><CheckCircle2 size={14} /> Sent</> : <><Send size={14} /> Send</>}
                </button>
              </motion.div>
            );
          })
        ) : (
          <div style={{ textAlign: 'center', padding: '60px 20px', opacity: 0.3 }}>
            <MessageCircle size={48} style={{ marginBottom: '16px' }} />
            <p>No chats found</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MusicSharePage;
