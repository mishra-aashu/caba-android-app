/**
 * CreateGroupModal - Modal to create a new group
 * Select multiple contacts -> Name Group -> Upload Avatar -> Create
 */

import React, { useState, useEffect } from 'react';
import { useSupabase } from '../../contexts/SupabaseContext';
import { useAuth } from '../../hooks/useAuth';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { useGroupActions } from '../../hooks/useGroupActions';
import Modal from '../common/Modal';
import DpPicker from '../common/DpPicker';
import { Search, Check, Image, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { dpOptions } from '../../utils/dpOptions';
import { getInitials } from '../../utils/stringUtils';
import './CreateGroupModal.css';

const CreateGroupModal = ({ isOpen, onClose, onSuccess, savedContacts: propContacts = [] }) => {
  const { supabase } = useSupabase();
  const { user } = useAuth();
  const { useCreateGroup } = useGroupActions();

  const createGroupMutation = useCreateGroup();

  const cachedContacts = useLiveQuery(() => db.contacts.toArray()) || [];
  const [step, setStep] = useState(1); // 1: Select members, 2: Group info
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [selectedDp, setSelectedDp] = useState(null); // For DP picker
  const [showDpPicker, setShowDpPicker] = useState(false);
  const [loading, setLoading] = useState(false);

  // Use provided contacts or cached ones
  const baseContacts = propContacts.length > 0 ? propContacts : (cachedContacts || []);

  // Transform baseContacts to contact format
  const contacts = baseContacts.map(contact => {
    const userData = contact.otherUser || {};
    // Handle avatar - can be number (DP ID), URL, or null
    let avatarUrl = userData?.avatar || null;
    if (avatarUrl && parseInt(avatarUrl)) {
      // It's a DP ID, get the path from dpOptions
      const dp = dpOptions.find(dp => dp.id === parseInt(avatarUrl));
      avatarUrl = dp?.path || null;
    }
    return {
      id: contact.contactUserId,
      name: contact.contactName || userData?.name || userData?.phone || 'Unknown',
      avatar: avatarUrl,
      phone: userData?.phone || contact.contactUserId || 'N/A',
      is_online: userData?.is_online || false,
      last_seen: userData?.last_seen || null,
    };
  }).filter(c => c.id && c.id !== user?.id);

  // Filter contacts by search
  const filteredContacts = contacts.filter(contact =>
    contact.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.phone?.includes(searchQuery)
  );

  // Toggle contact selection
  const toggleContact = (contact) => {
    setSelectedContacts(prev => {
      const isSelected = prev.some(c => c.id === contact.id);
      if (isSelected) {
        return prev.filter(c => c.id !== contact.id);
      } else {
        return [...prev, contact];
      }
    });
  };

  // Handle avatar selection - file upload
  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAvatarFile(file);
      setSelectedDp(null); // Clear DP selection
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle DP selection from picker
  const handleDpSelect = (dpPath) => {
    setSelectedDp(dpPath);
    setAvatarPreview(dpPath);
    setAvatarFile(null); // Clear file upload
  };

  // Create group
  const handleCreate = async () => {
    if (!groupName.trim()) {
      toast.error('Please enter a group name');
      return;
    }

    if (selectedContacts.length < 1) {
      toast.error('Please select at least 1 member');
      return;
    }

    setLoading(true);

    try {
      const memberIds = selectedContacts.map(c => c.id);

      // If selectedDp is set, use it as avatar; otherwise use avatarFile
      await createGroupMutation.mutateAsync({
        name: groupName.trim(),
        description: groupDescription.trim() || null,
        avatarFile: selectedDp ? null : avatarFile, // Use file OR DP URL
        avatarUrl: selectedDp, // Pass DP URL if selected
        createdBy: user.id,
        memberIds,
      });

      // Reset form
      resetForm();
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Error creating group:', error);
      toast.error('Failed to create group');
    } finally {
      setLoading(false);
    }
  };

  // Reset form
  const resetForm = () => {
    setStep(1);
    setSearchQuery('');
    setSelectedContacts([]);
    setGroupName('');
    setGroupDescription('');
    setAvatarPreview(null);
    setAvatarFile(null);
  };

  // Handle close
  const handleClose = () => {
    resetForm();
    onClose();
  };

  // Go to next step
  const goToNextStep = () => {
    if (selectedContacts.length < 1) {
      toast.error('Please select at least 1 member');
      return;
    }
    setStep(2);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={step === 1 ? 'Add Group Participants' : 'Create Group'}
      size="medium"
    >
      <div className="create-group-modal">
        {/* Step 1: Select Members */}
        {step === 1 && (
          <div className="step-1">
            <div className="search-container">
              <Search size={18} className="search-icon" />
              <input
                type="text"
                placeholder="Search contacts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
            </div>

            <div className="selected-preview">
              <span>{selectedContacts.length} selected</span>
              {selectedContacts.length > 0 && (
                <button className="clear-btn" onClick={() => setSelectedContacts([])}>
                  Clear
                </button>
              )}
            </div>

            <div className="contacts-list">
              {baseContacts.length === 0 ? (
                <div className="no-contacts">
                  No contacts yet. Add contacts first to create a group.
                </div>
              ) : filteredContacts.length > 0 ? (
                filteredContacts.map(contact => {
                  const isSelected = selectedContacts.some(c => c.id === contact.id);
                  return (
                    <div
                      key={contact.id}
                      className={`contact-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => toggleContact(contact)}
                    >
                      <div className="contact-avatar">
                        {contact.avatar ? (
                          parseInt(contact.avatar) ? (
                            <img src={dpOptions.find(dp => dp.id === parseInt(contact.avatar))?.path || contact.avatar} alt={contact.name} />
                          ) : (
                            <img src={contact.avatar} alt={contact.name} />
                          )
                        ) : (
                          <div className="avatar-placeholder">
                            {getInitials(contact.name) || '?'}
                          </div>
                        )}
                        {isSelected && (
                          <div className="check-icon">
                            <Check size={14} />
                          </div>
                        )}
                      </div>
                      <div className="contact-info">
                        <div className="contact-name">{contact.name}</div>
                        <div className="contact-phone">{contact.phone}</div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="no-contacts">
                  {searchQuery ? 'No contacts found' : 'No contacts yet'}
                </div>
              )}
            </div>

            <div className="step-actions">
              <button className="btn-primary" onClick={goToNextStep}>
                Next
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Group Info */}
        {step === 2 && (
          <div className="step-2">
            <div className="avatar-section">
              <div className="avatar-preview" onClick={() => setShowDpPicker(true)}>
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Group avatar" />
                ) : (
                  <div className="avatar-placeholder-large">
                    <Image size={32} />
                    <span>Choose Photo</span>
                  </div>
                )}
              </div>
              <input
                type="file"
                id="group-avatar-input"
                accept="image/*"
                onChange={handleAvatarChange}
                style={{ display: 'none' }}
              />
              <div className="avatar-buttons">
                <button
                  className="btn-secondary avatar-btn"
                  onClick={() => setShowDpPicker(true)}
                >
                  <Image size={16} />
                  Choose from Gallery
                </button>
              </div>
            </div>

            <div className="group-info-form">
              <input
                type="text"
                placeholder="Group Name (required)"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="group-name-input"
                maxLength={50}
              />

              <input
                type="text"
                placeholder="Group Description (optional)"
                value={groupDescription}
                onChange={(e) => setGroupDescription(e.target.value)}
                className="group-description-input"
                maxLength={100}
              />
            </div>

            <div className="members-preview">
              <div className="members-header">
                <Users size={16} />
                <span>{selectedContacts.length + 1} participants</span>
              </div>
              <div className="members-list">
                {/* Show creator */}
                <div className="member-chip you">
                  <span>You (Admin)</span>
                </div>
                {/* Show selected contacts */}
                {selectedContacts.slice(0, 5).map(contact => (
                  <div key={contact.id} className="member-chip">
                    {contact.avatar ? (
                      <img src={contact.avatar} alt={contact.name} className="chip-avatar" />
                    ) : (
                      <div className="chip-avatar-placeholder">
                        {contact.name?.charAt(0)?.toUpperCase()}
                      </div>
                    )}
                    <span>{contact.name}</span>
                  </div>
                ))}
                {selectedContacts.length > 5 && (
                  <div className="member-chip more">
                    +{selectedContacts.length - 5} more
                  </div>
                )}
              </div>
            </div>

            <div className="step-actions">
              <button className="btn-secondary" onClick={() => setStep(1)}>
                Back
              </button>
              <button
                className="btn-primary"
                onClick={handleCreate}
                disabled={loading || !groupName.trim()}
              >
                {loading ? 'Creating...' : 'Create Group'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* DP Picker Modal */}
      <DpPicker
        isOpen={showDpPicker}
        onClose={() => setShowDpPicker(false)}
        onSelect={handleDpSelect}
        currentDp={selectedDp}
      />
    </Modal>
  );
};

export default CreateGroupModal;
