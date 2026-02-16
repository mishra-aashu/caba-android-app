// components/TruthDareModal.jsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Flame, MessageCircle, Send, Mail, SendToBack } from 'lucide-react';
import { useSupabase } from '../../contexts/SupabaseContext';
import { useAuth } from '../../hooks/useAuth';

const TruthDareModal = ({ isOpen, onClose, gameState, userId, partnerId, onPick, onSend, onComplete, onCloseModal, chatId }) => {
  const { supabase } = useSupabase();
  const { user } = useAuth();
  const [invitationMessage, setInvitationMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [invitationSent, setInvitationSent] = useState(false);

  // Use props if provided, otherwise use hook state
  const actualUserId = userId || user?.id;
  const actualPartnerId = partnerId;
  const actualChatId = chatId;

  const handleSendInvitation = async () => {
    if (!actualUserId || !actualPartnerId || !actualChatId) return;

    setIsSending(true);
    try {
      // 1. Create game invitation in the database
      const { data: invitation, error: inviteError } = await supabase
        .from('game_invitations')
        .insert({
          chat_id: actualChatId,
          sender_id: actualUserId,
          receiver_id: actualPartnerId,
          game_type: 'truth_or_dare',
          status: 'pending',
          invitation_message: invitationMessage || `Let's play Truth or Dare! Pick your choice.`,
          game_room_id: null
        })
        .select()
        .single();

      if (inviteError) throw inviteError;

      // 2. Send invitation message to chat
      const { error: messageError } = await supabase
        .from('messages')
        .insert({
          chat_id: actualChatId,
          sender_id: actualUserId,
          receiver_id: actualPartnerId,
          content: invitationMessage || `Let's play Truth or Dare! Pick your choice.`,
          media_path: null,
          media_type: null,
          reply_to: null,
          type: 'game_invite',
          status: 'pending',
          game_invitation_id: invitation.id
        });

      if (messageError) throw messageError;

      setInvitationSent(true);
      setInvitationMessage('');
      
      // Close modal after sending invitation
      if (onCloseModal) {
        onCloseModal();
      } else {
        onClose();
      }
    } catch (error) {
      console.error('Error sending invitation:', error);
      alert('Failed to send game invitation. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  // Animation variants
  const modalVariants = {
    hidden: { y: "100%", opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: "spring", damping: 25, stiffness: 500 } },
    exit: { y: "100%", opacity: 0 }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="game-overlay">
          <div className="game-card">
            <button className="close-game-btn" onClick={onClose}>×</button>
            
            {/* Invitation Section */}
            <div className="space-y-4">
              <h2 className="text-2xl font-bold mb-4">🎮 Play Games</h2>
              <p className="text-lg mb-6">Send game invitation to your friend</p>
              
              <div className="invitation-form space-y-4">
                <div className="invitation-message">
                  <label htmlFor="invitation-message" className="block text-sm font-medium text-gray-300 mb-2">
                    Invitation Message
                  </label>
                  <textarea
                    id="invitation-message"
                    value={invitationMessage}
                    onChange={(e) => setInvitationMessage(e.target.value)}
                    placeholder="Let's play Truth or Dare! Pick your choice..."
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-pink-500 outline-none resize-none h-24"
                  />
                </div>
                
                <button
                  onClick={handleSendInvitation}
                  disabled={isSending || invitationSent}
                  className="w-full py-3 bg-gradient-to-r from-pink-600 to-violet-600 rounded-lg font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSending ? (
                    <>
                      <SendToBack size={18} className="animate-spin" />
                      Sending...
                    </>
                  ) : invitationSent ? (
                    <>
                      <Check size={18} />
                      Sent!
                    </>
                  ) : (
                    <>
                      <SendToBack size={18} />
                      Send Invitation
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default TruthDareModal;