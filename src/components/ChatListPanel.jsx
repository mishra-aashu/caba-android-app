import React, { useRef, useState } from 'react';
import { useSupabase } from '../contexts/SupabaseContext';
import { MessageCircle, Phone, Newspaper, Settings, User, Search, MoreVertical, Plus, Bell, Info, HelpCircle, LogOut, Crown, X, Eye, EyeOff, ShieldCheck, Edit, Trash2, Ban, ArrowDown, ArrowLeft, ArrowRight, Copy, QrCode, MessageSquarePlus, Users } from 'lucide-react';
import DropdownMenu from './common/DropdownMenu';
import Modal from './common/Modal';
import ChatListItem from './chat/ChatListItem';
import { getInitials } from '../utils/stringUtils';
import { isUserOnline } from '../utils/timeUtils';
import CreateGroupModal from './groups/CreateGroupModal';

const ChatListPanel = ({
  searchTerm,
  setSearchTerm,
  showSearch,
  setShowSearch,
  searchSuggestions,
  showSuggestions = false,
  setShowSuggestions,
  handleSearchChange,
  handleSuggestionClick,
  handleChatClick,
  filteredChats,
  handleChatListScroll,
  chatListRef,
  loadingMore,
  hasMoreChats,
  dpOptions,
  formatTime,
  setShowNewContactModal,
  currentUser,
  handleNavigation,
  handleAboutApp,
  handleHelp,
  handleLogout,
  isAdmin,
  savedContacts,
  showNewContactModal,
  showContactForm,
  setShowContactForm,
  showSelectContact,
  setShowSelectContact,
  contactName,
  setContactName,
  contactPhone,
  setContactPhone,
  handleSaveContact,
  contactMenuOpen,
  handleContactMenuToggle,
  handleContactClick,
  handleEditContact,
  handleDeleteContact,
  handleStartChatWithContact,
  isDesktop,
  currentChatId,
}) => {
  const { supabase } = useSupabase();

  // State for Create Group Modal
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);

  const dropdownItems = [
    {
      icon: <User size={16} className="profile-icon" />,
      label: 'Profile',
      onClick: () => handleNavigation('/profile')
    },
    {
      icon: <Settings size={16} className="settings-icon" />,
      label: 'Settings',
      onClick: () => handleNavigation('/settings')
    },
    {
      icon: <Users size={16} className="groups-icon" />,
      label: 'Groups',
      onClick: () => handleNavigation('/groups')
    },
    {
      icon: <Bell size={16} className="reminders-icon" />,
      label: 'Check Reminders',
      onClick: () => handleNavigation('/reminders')
    },

    ,
    ...(isAdmin ? [{
      icon: <Crown size={16} className="admin-icon" />,
      label: 'Admin Panel',
      onClick: () => handleNavigation('/admin')
    }] : []),
    { divider: true },
    {
      icon: <Info size={16} className="about-icon" />,
      label: 'About App',
      onClick: handleAboutApp
    },
    {
      icon: <HelpCircle size={16} className="help-icon" />,
      label: 'Help',
      onClick: handleHelp
    },
    { divider: true },
    {
      icon: <LogOut size={16} className="logout-icon" />,
      label: 'Logout',
      onClick: handleLogout
    }
  ];

  return (
    <main className="main-content">
      <header className="top-header">
        <div className="header-left">
          <h1 className="chats-title">Chats</h1>
        </div>
        <div className="header-right">
          <button
            className="icon-btn"
            onClick={() => setShowCreateGroupModal(true)}
            title="Create Group"
          >
            <Users size={20} className="create-group-icon" />
          </button>
          <button
            className="icon-btn"
            onClick={() => setShowNewContactModal(true)}
            title="Contacts"
          >
            <User size={20} className="contacts-icon" />
          </button>
          <button
            className="icon-btn"
            onClick={() => setShowSearch(!showSearch)}
            title="Search"
          >
            <Search size={20} className="search-toggle-icon" />
          </button>

          <DropdownMenu
            items={dropdownItems}
          />
        </div>
      </header>

      {showSearch && (
        <div className="search-bar">
          <Search size={16} className="search-input-icon" />
          <input
            type="text"
            placeholder="Search by phone number..."
            value={searchTerm}
            onChange={handleSearchChange}
          />
          <button
            className="close-search"
            onClick={() => {
              setShowSearch(false);
              setSearchTerm('');
              setSearchSuggestions([]);
              setShowSuggestions(false);
            }}
          >
            ×
          </button>
        </div>
      )}

      {showSearch && showSuggestions && searchSuggestions.length > 0 && (
        <div className="search-suggestions">
          {searchSuggestions.map(user => (
            <div
              key={user.id}
              className="search-suggestion-item"
              onClick={() => handleSuggestionClick(user)}
            >
              <div className="suggestion-avatar">
                {user.avatar ? (
                  parseInt(user.avatar) ? (
                    <img src={dpOptions.find(dp => dp.id === parseInt(user.avatar))?.path || user.avatar} alt={user.name} />
                  ) : (
                    <img src={user.avatar} alt={user.name} />
                  )
                ) : (
                  <div>{getInitials(user.name)}</div>
                )}
                <span className={`online-status ${isUserOnline(Boolean(user.is_online), user.last_seen) ? 'online' : ''}`}></span>
              </div>
              <div className="suggestion-info">
                <div className="suggestion-name">{user.name}</div>
                <div className="suggestion-phone">{user.phone}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div
        className="chat-list-wrapper chat-list-container"
        onScroll={handleChatListScroll}
        ref={chatListRef}
      >
        {filteredChats.length > 0 ? (
          filteredChats.map(chat => {
            const contact = savedContacts.find(c => c.contact_user_id === chat.otherUser?.id);
            const displayName = contact?.contact_name || chat.otherUser?.name || 'Unknown';
            return (
              <ChatListItem
                key={chat.id}
                chat={{
                  name: displayName,
                  avatar: chat.otherUser?.avatar
                    ? (parseInt(chat.otherUser.avatar)
                      ? dpOptions.find(dp => dp.id === parseInt(chat.otherUser.avatar))?.path
                      : chat.otherUser.avatar)
                    : null, // Pass null to ChatListItem to use its internal default
                  lastMessage: chat.last_message || 'No messages yet',
                  time: formatTime(chat.last_message_time),
                  unreadCount: chat.unreadCount,
                  is_online: chat.otherUser?.is_online,
                  last_seen: chat.otherUser?.last_seen,
                  isMyMessage: false, // Placeholder: need logic to determine
                  status: null, // Placeholder: need logic to determine
                  type: 'text', // Placeholder: need logic to determine
                  isGroup: chat.isGroup || chat.chatType === 'group' || false,
                  member_count: chat.member_count,
                  member_preview: chat.member_preview
                }}
                onClick={() => handleChatClick(chat)}
                isActive={chat.id == currentChatId}
              />
            );
          })
        ) : (
          <div className="empty-state">
            <MessageCircle size={48} className="empty-state-icon" />
            <h3>No conversations yet</h3>
            <p>Start messaging your contacts</p>
          </div>
        )}

        {loadingMore && (
          <div className="load-more-chats">
            <div className="loading-spinner"></div>
            <p>Loading more chats...</p>
          </div>
        )}
      </div>



      <Modal
        isOpen={showNewContactModal}
        onClose={() => {
          setShowNewContactModal(false);
          setShowContactForm(false);
          setShowSelectContact(false);
          setContactName('');
          setContactPhone('');
        }}
        title={showSelectContact ? "Select Contact" : "New Contact"}
        size="medium"
      >
        <div className="new-contact-modal">
          <div className="modal-mode-toggle">
            <button
              className={`mode-btn ${!showSelectContact ? 'active' : ''}`}
              onClick={() => setShowSelectContact(false)}
            >
              Manage Contacts
            </button>
            <button
              className={`mode-btn ${showSelectContact ? 'active' : ''}`}
              onClick={() => setShowSelectContact(true)}
            >
              Select Contact
            </button>
          </div>

          {showSelectContact ? (
            <div className="select-contact-section">
              <h3>Start Chat With</h3>
              <div className="saved-contacts-list">
                {savedContacts.length > 0 ? (
                  savedContacts.map(contact => (
                    <div key={contact.id} className="saved-contact-item">
                      <div className="contact-info">
                        <div className="contact-avatar">
                          {contact.otherUser?.avatar ? (
                            parseInt(contact.otherUser.avatar) ? (
                              <img src={dpOptions.find(dp => dp.id === parseInt(contact.otherUser.avatar))?.path || contact.otherUser.avatar} alt={contact.contact_name || contact.otherUser?.name} />
                            ) : (
                              <img src={contact.otherUser.avatar} alt={contact.contact_name || contact.otherUser?.name} />
                            )
                          ) : (
                            <div>{getInitials(contact.contact_name || contact.otherUser?.name)}</div>
                          )}
                        </div>
                        <div>
                          <div className="contact-name">{contact.contact_name || contact.otherUser?.name || 'Unknown'}</div>
                          <div className="contact-phone">{contact.otherUser?.phone || 'N/A'}</div>
                        </div>
                      </div>
                      <button
                        className="start-chat-btn"
                        onClick={() => handleStartChatWithContact(contact)}
                        title="Start Chat"
                      >
                        <MessageCircle size={16} className="start-chat-icon" />
                        Chat
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="no-contacts">No saved contacts yet. Add contacts first.</p>
                )}
              </div>
            </div>
          ) : (
            <>
              <button
                className="add-contact-btn"
                onClick={() => setShowContactForm(!showContactForm)}
              >
                <Plus size={20} className="add-contact-icon" />
                Add New Contact
              </button>

              {showContactForm && (
                <div className="contact-form">
                  <input
                    type="text"
                    placeholder="Contact name"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    className="contact-input"
                  />
                  <input
                    type="tel"
                    placeholder="Phone number (10 digits)"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    className="contact-input"
                  />
                  <div className="contact-form-actions">
                    <button className="btn-primary" onClick={handleSaveContact}>
                      Save Contact
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={() => {
                        setShowContactForm(false);
                        setContactName('');
                        setContactPhone('');
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div className="saved-contacts-section">
                <h3>Saved Contacts</h3>
                <div className="saved-contacts-list">
                  {savedContacts.length > 0 ? (
                    savedContacts.map((contact, index) => (
                      <div
                        key={contact.id}
                        className={`saved-contact-item ${contactMenuOpen?.id === contact.id ? 'menu-open' : ''}`}
                        onClick={() => handleContactClick(contact)}
                      >
                        <div className="contact-info">
                          <div className="contact-avatar">
                            {contact.otherUser?.avatar ? (
                              parseInt(contact.otherUser.avatar) ? (
                                <img src={dpOptions.find(dp => dp.id === parseInt(contact.otherUser.avatar))?.path || contact.otherUser.avatar} alt={contact.contact_name || contact.otherUser?.name} />
                              ) : (
                                <img src={contact.otherUser.avatar} alt={contact.contact_name || contact.otherUser?.name} />
                              )
                            ) : (
                              <div>{getInitials(contact.contact_name || contact.otherUser?.name)}</div>
                            )}
                          </div>
                          <div className="contact-details">
                            <div className="contact-name">{contact.contact_name || contact.otherUser?.name || 'Unknown'}</div>
                            <div className="contact-phone">{contact.otherUser?.phone || 'N/A'}</div>
                          </div>
                        </div>
                        <button
                          className="contact-menu-btn"
                          onClick={(e) => handleContactMenuToggle(contact.id, e, index)}
                          title="Options"
                        >
                          <MoreVertical size={18} className="contact-menu-icon" />
                        </button>
                        {contactMenuOpen?.id === contact.id && (
                          <div className={`contact-menu ${contactMenuOpen.showAbove ? 'show-above' : 'show-below'}`}>
                            <button
                              className="menu-item edit-item"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditContact(contact);
                              }}
                            >
                              <Edit size={16} className="edit-contact-icon" />
                              Edit
                            </button>
                            <button
                              className="menu-item delete-item"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteContact(contact.id);
                              }}
                            >
                              <Trash2 size={16} className="delete-contact-icon" />
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="no-contacts">No saved contacts yet</p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Create Group Modal */}
      <CreateGroupModal
        isOpen={showCreateGroupModal}
        onClose={() => setShowCreateGroupModal(false)}
        onSuccess={() => {
          // Refresh chat list after creating group
          console.log('Group created successfully');
        }}
        savedContacts={savedContacts}
      />
    </main>
  );
};

export default ChatListPanel;
