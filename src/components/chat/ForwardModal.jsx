import React from 'react';
import Modal from '../common/Modal';
import { ArrowRight, MessageCircle } from 'lucide-react';
import { dpOptions } from '../../utils/dpOptions';
import { getInitials } from '../../utils/stringUtils';
import { isUserOnline } from '../../utils/dateFormatter';
import styles from './ForwardModal.module.css';

const ForwardModal = ({
  isOpen,
  onClose,
  chats = [],
  messagesToForward = [],
  onForward,
  currentUser
}) => {
  const handleForward = async (chat) => {
    await onForward(messagesToForward, chat);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Forward ${(messagesToForward || []).length} message${(messagesToForward || []).length > 1 ? 's' : ''}`}
      size="medium"
    >
      <div className={styles['forward-modal-content']}>
        <div className={styles['forward-modal-list']}>
          {chats && chats.length > 0 ? (
            chats.map(chat => {
              const contact = null; // We'll need to pass savedContacts if we want contact names
              const isGroup = chat.isGroup || chat.is_group || false;
              const displayName = isGroup
                ? (chat.name || chat.groupName || 'Group Chat')
                : (contact?.contact_name || chat.otherUser?.name || 'Unknown');

              return (
                <div key={chat.id} className={styles['forward-modal-item']}>
                  <div className={styles['forward-modal-info']}>
                    <div className={styles['forward-modal-avatar']}>
                      {isGroup ? (
                        chat.avatar || chat.groupAvatar || chat.avatar_url ? (
                          <img
                            src={chat.avatar || chat.groupAvatar || chat.avatar_url}
                            alt={displayName}
                            className={styles['forward-modal-avatar-img']}
                          />
                        ) : (
                          <div>{getInitials(displayName)}</div>
                        )
                      ) : (
                        <>
                          {chat.otherUser?.avatar ? (
                            parseInt(chat.otherUser.avatar) ? (
                              <img
                                src={dpOptions.find(dp => dp.id === parseInt(chat.otherUser.avatar))?.path || chat.otherUser.avatar}
                                alt={displayName}
                                className={styles['forward-modal-avatar-img']}
                              />
                            ) : (
                              <img src={chat.otherUser.avatar} alt={displayName} className={styles['forward-modal-avatar-img']} />
                            )
                          ) : (
                            <div>{getInitials(displayName)}</div>
                          )}
                          <span className={`${styles['forward-modal-online-status']} ${isUserOnline(Boolean(chat.otherUser?.is_online), chat.otherUser?.last_seen) ? styles.online : ''}`}></span>
                        </>
                      )}
                    </div>
                    <div className={styles['forward-modal-details']}>
                      <div className={styles['forward-modal-name']}>
                        {displayName}
                        {isGroup && <span className={styles['forward-modal-group-badge']}>Group</span>}
                      </div>
                      <div className={styles['forward-modal-last-message']}>
                        {chat.last_message || 'No messages yet'}
                      </div>
                    </div>
                  </div>
                  <button
                    className={styles['forward-modal-btn']}
                    onClick={() => handleForward(chat)}
                    title="Forward message"
                  >
                    <ArrowRight size={16} />
                  </button>
                </div>
              );
            })
          ) : (
            <div className={styles['forward-modal-no-chats']}>
              <MessageCircle className={styles['forward-modal-no-chats-icon']} size={48} />
              <p className={styles['forward-modal-no-chats-text']}>No chats available</p>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default ForwardModal;