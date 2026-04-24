/**
 * CreateGroupModal - Modal to create a new group
 * Select multiple contacts -> Name Group -> Upload Avatar -> Create
 */

import React, { useState, useEffect, Suspense } from 'react';
import { useSupabase } from '../../contexts/SupabaseContext';
import { useAuth } from '../../hooks/useAuth';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { useCreateGroup } from '../../hooks/useGroupActions';
import Modal from '../common/Modal';
import DpPicker from '../common/DpPicker';
import { Search, Check, Image, Users, Upload, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import { dpOptions } from '../../utils/dpOptions';
import { getInitials } from '../../utils/stringUtils';
import './CreateGroupModal.css';

const CreateGroupModal = ({ isOpen, onClose, onSuccess, savedContacts: propContacts = [], inline = false }) => {
  const { supabase } = useSupabase();
  const { user } = useAuth();
  const createGroupMutation = useCreateGroup();

  const cachedContacts = useLiveQuery(() => db.contacts.toArray()) || [];
  const [step, setStep] = useState(1); // 1: Select members, 2: Group info
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [selectedDp, setSelectedDp] = useState(null);
  const [showDpPicker, setShowDpPicker] = useState(false);
  const [loading, setLoading] = useState(false);

  // Use provided contacts or cached ones
  const baseContacts = propContacts.length > 0 ? propContacts : (cachedContacts || []);

  // Transform baseContacts to contact format with robust mapping
  const contacts = baseContacts.map(contact => {
    const userData = contact.otherUser || contact.contact_user || contact.contactUser || {};
    
    let avatarUrl = userData?.avatar || userData?.avatar_url || null;
    if (avatarUrl && !isNaN(parseInt(avatarUrl)) && parseInt(avatarUrl) < 100) {
      const dp = dpOptions.find(dp => dp.id === parseInt(avatarUrl));
      avatarUrl = dp?.path || avatarUrl;
    }
    
    const phone = userData?.phone || 
                  userData?.phone_number || 
                  userData?.phoneNumber || 
                  '';

    const about = userData?.about || 
                  userData?.status || 
                  (phone ? '' : 'Hey there! I am using ELEVENGRAM');

    return {
      id: contact.contactUserId || userData?.id,
      name: contact.contactName || userData?.name || phone || 'Unknown',
      avatar: avatarUrl,
      phone: phone || about,
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

  // Handle avatar file upload
  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error('Please select a valid image file');
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image size should be less than 5MB');
        return;
      }

      setAvatarFile(file);
      setSelectedDp(null);
      
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
    setAvatarFile(null);
    setShowDpPicker(false);
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

      const group = await createGroupMutation.mutateAsync({
        name: groupName.trim(),
        description: groupDescription.trim() || null,
        avatarFile: selectedDp ? null : avatarFile,
        avatarUrl: selectedDp,
        createdBy: user.id,
        memberIds,
      });

      toast.success('Group created successfully!');
      resetForm();
      onSuccess?.(group);
      onClose();
    } catch (error) {
      console.error('Error creating group:', error);
      toast.error(error.message || 'Failed to create group');
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
    setSelectedDp(null);
  };

  // Handle close
  const handleClose = () => {
    if (loading) return;
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

  // Render avatar for contact
  const renderContactAvatar = (contact) => {
    if (contact.avatar) {
      // Check if avatar is a number (DP ID)
      if (!isNaN(parseInt(contact.avatar)) && parseInt(contact.avatar) < 100) {
        const dp = dpOptions.find(dp => dp.id === parseInt(contact.avatar));
        return <img src={dp?.path || contact.avatar} alt={contact.name} />;
      }
      return <img src={contact.avatar} alt={contact.name} />;
    }
    return (
      <div className="avatar-placeholder">
        {getInitials(contact.name) || '?'}
      </div>
    );
  };

  // Render member chip avatar
  const renderChipAvatar = (contact) => {
    if (contact.avatar) {
      if (!isNaN(parseInt(contact.avatar)) && parseInt(contact.avatar) < 100) {
        const dp = dpOptions.find(dp => dp.id === parseInt(contact.avatar));
        return <img src={dp?.path || contact.avatar} alt={contact.name} className="chip-avatar" />;
      }
      return <img src={contact.avatar} alt={contact.name} className="chip-avatar" />;
    }
    return (
      <div className="chip-avatar-placeholder">
        {contact.name?.charAt(0)?.toUpperCase() || '?'}
      </div>
    );
  };

  const ModalContent = (
    <div className={`create-group-modal ${inline ? 'inline-mode' : ''}`}>
      {/* Step 1: Select Members */}
      {step === 1 && (
        <div className="step-1">
          <div className={inline ? "search-container-inline" : "search-container"}>
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder="Search contacts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
              autoFocus
            />
          </div>

          <div className="selected-preview">
            <span>{selectedContacts.length} selected</span>
            {selectedContacts.length > 0 && (
              <button 
                className="clear-btn" 
                onClick={() => setSelectedContacts([])}
                type="button"
              >
                Clear
              </button>
            )}
          </div>

          <div className="contacts-list">
            {baseContacts.length === 0 ? (
              <div className="no-contacts">
                <UserPlus size={48} />
                <span>No contacts yet. Add contacts first to create a group.</span>
              </div>
            ) : filteredContacts.length > 0 ? (
              filteredContacts.map((contact, index) => {
                const isSelected = selectedContacts.some(c => c.id === contact.id);
                return (
                  <div
                    key={contact.id}
                    className={`contact-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => toggleContact(contact)}
                    style={{ animationDelay: `${index * 0.05}s` }}
                  >
                    <div className="contact-avatar">
                      {renderContactAvatar(contact)}
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
                <Search size={48} />
                <span>No contacts found matching "{searchQuery}"</span>
              </div>
            )}
          </div>

          <div className="step-actions">
            <button 
              className="btn-primary" 
              onClick={goToNextStep}
              disabled={selectedContacts.length === 0}
              type="button"
            >
              Next ({selectedContacts.length})
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Group Info */}
      {step === 2 && (
        <div className="step-2">
          <div className="avatar-section">
            <div 
              className="avatar-preview" 
              onClick={() => setShowDpPicker(true)}
              role="button"
              tabIndex={0}
            >
              {avatarPreview ? (
                <img src={avatarPreview} alt="Group avatar" />
              ) : (
                <div className="avatar-placeholder-large">
                  <Image size={32} />
                  <span>Add Photo</span>
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
                type="button"
              >
                <Image size={16} />
                Choose from Gallery
              </button>
              <button
                className="btn-secondary avatar-btn"
                onClick={() => document.getElementById('group-avatar-input').click()}
                type="button"
              >
                <Upload size={16} />
                Upload Photo
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
              autoFocus
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
                  {renderChipAvatar(contact)}
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
            <button 
              className="btn-secondary" 
              onClick={() => setStep(1)}
              disabled={loading}
              type="button"
            >
              Back
            </button>
            <button
              className={`btn-primary ${loading ? 'loading' : ''}`}
              onClick={handleCreate}
              disabled={loading || !groupName.trim()}
              type="button"
            >
              {loading ? '' : 'Create Group'}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const DpPickerModal = (
    <Suspense fallback={null}>
      <DpPicker
        isOpen={showDpPicker}
        onClose={() => setShowDpPicker(false)}
        onSelect={handleDpSelect}
        currentDp={selectedDp}
      />
    </Suspense>
  );

  if (inline) {
    return (
      <>
        {ModalContent}
        {DpPickerModal}
      </>
    );
  }

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        title={step === 1 ? 'Add Group Participants' : 'Create Group'}
        size="medium"
      >
        {ModalContent}
      </Modal>
      {DpPickerModal}
    </>
  );
};

export default CreateGroupModal;