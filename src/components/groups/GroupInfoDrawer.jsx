/**
 * GroupInfoDrawer - Right sidebar showing group members & settings
 */

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useGroup, useGroupMembers, useIsAdmin, useLeaveGroup, useUpdateGroup } from '../../hooks/useGroupActions';
import MemberItem from './MemberItem';
import DpPicker from '../common/DpPicker';
import AddMembersModal from './AddMembersModal';

import { X, Edit, Users, Info, Phone, Video, Bell, BellOff, LogOut, Settings, Crown, Calendar, User as UserIcon, Camera, Shield, Lock, MessageSquare, ArrowLeft, LoaderCircle, Upload, Image, Check, UserPlus } from 'lucide-react';
import dayjs from 'dayjs';
import toast from 'react-hot-toast';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useDialog } from '../../contexts/DialogContext';
import useIsDesktop from '../../hooks/useIsDesktop';
import { uploadGroupAvatar } from '../../services/groupService';
import { resolveAvatarUrl } from '../../utils/avatarHelpers';
import { dpOptions } from '../../utils/dpOptions';
import './GroupInfoDrawer.css';

const GroupInfoDrawer = ({ isOpen, onClose, group, onCallStart }) => {
  const { user } = useAuth();
  const { showAlert, showConfirm } = useDialog();
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();

  const [showDpPicker, setShowDpPicker] = useState(false);
  const [showAddMembersModal, setShowAddMembersModal] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [selectedDp, setSelectedDp] = useState(null);
  const avatarInputRef = useRef(null);

  const { chatId } = useParams();
  // Robust ID resolution: group.id > group.group_id > URL param (chatId)
  // We prioritize the prop ID because on Desktop the URL might be a different chat 
  // while the drawer is showing info for a group from the sidebar.
  const groupId = group?.id || group?.group_id || chatId;

  const { data: fetchedGroup, isLoading: loadingGroup } = useGroup(groupId);
  const { data: members = [], isLoading: loadingMembers, refetch: refetchMembers } = useGroupMembers(groupId);
  const { data: isAdmin = false } = useIsAdmin(groupId, user?.id);

  const activeGroup = fetchedGroup || group;

  const leaveGroupMutation = useLeaveGroup();
  const updateGroupMutation = useUpdateGroup();

  // Load mute state
  useEffect(() => {
    if (groupId) {
      const mutedGroups = JSON.parse(localStorage.getItem('mutedGroups') || '{}');
      setIsMuted(!!mutedGroups[groupId]);
    }
  }, [groupId]);

  // Update edit fields when group changes
  useEffect(() => {
    if (activeGroup) {
      setEditName(activeGroup.name || '');
      setEditDescription(activeGroup.description || '');
      setAvatarPreview(resolveAvatarUrl(activeGroup.avatar_url || activeGroup.avatar));
    }
  }, [activeGroup]);

  // Handle leave group
  const handleLeaveGroup = async () => {
    const confirmed = await showConfirm(
      'Leave Group',
      'Are you sure you want to leave this group? You will need to be re-invited to join again.',
      'Leave',
      'Cancel'
    );
    if (!confirmed) return;

    try {
      await leaveGroupMutation.mutateAsync({ groupId, userId: user.id });
      toast.success('Left group successfully');
      onClose();
    } catch (error) {
      console.error('Error leaving group:', error);
      toast.error(error.message || 'Failed to leave group');
    }
  };

  // Handle mute toggle
  const handleMuteToggle = () => {
    const mutedGroups = JSON.parse(localStorage.getItem('mutedGroups') || '{}');
    const newMutedState = !isMuted;

    if (newMutedState) {
      mutedGroups[groupId] = true;
    } else {
      delete mutedGroups[groupId];
    }

    localStorage.setItem('mutedGroups', JSON.stringify(mutedGroups));
    setIsMuted(newMutedState);
    toast.success(newMutedState ? 'Group muted' : 'Group unmuted', {
      icon: newMutedState ? '🔕' : '🔔',
    });
  };

  // Handle save edits
  const handleSaveEdit = async () => {
    if (!editName.trim()) {
      toast.error('Group name cannot be empty');
      return;
    }

    setIsUpdating(true);

    try {
      const updates = {
        name: editName.trim(),
        description: editDescription.trim() || null,
      };

      // If DP selected, update avatar_url
      if (selectedDp) {
        updates.avatar_url = selectedDp;
      }

      await updateGroupMutation.mutateAsync({
        groupId,
        updates,
      });

      toast.success('Group info updated!');
      setIsEditing(false);
      setSelectedDp(null);
    } catch (error) {
      console.error('Error updating group:', error);
      toast.error(error.message || 'Failed to update group');
    } finally {
      setIsUpdating(false);
    }
  };

  // Handle cancel edit
  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditName(activeGroup?.name || '');
    setEditDescription(activeGroup?.description || '');
    setAvatarPreview(resolveAvatarUrl(activeGroup?.avatar_url || activeGroup?.avatar));
    setSelectedDp(null);
  };

  // Handle avatar file upload
  const handleAvatarFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

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

    setIsUploadingAvatar(true);

    try {
      const uploadedUrl = await uploadGroupAvatar(file, groupId, user.id);

      await updateGroupMutation.mutateAsync({
        groupId,
        updates: { avatar_url: uploadedUrl },
      });

      setAvatarPreview(uploadedUrl);
      setSelectedDp(null);
      toast.success('Group avatar updated!');
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast.error(error.message || 'Failed to update avatar');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  // Handle DP selection
  const handleDpSelect = (dpPath) => {
    setSelectedDp(dpPath);
    setAvatarPreview(dpPath);
    setShowDpPicker(false);
  };

  // Handle toggle settings
  const handleToggleSetting = async (settingName, currentValue) => {
    try {
      await updateGroupMutation.mutateAsync({
        groupId,
        updates: { [settingName]: !currentValue },
      });
      
      const settingLabels = {
        admins_only_edit_info: 'Group info editing',
        admins_only_add_members: 'Member adding',
        admins_only_messages: 'Messaging',
      };
      
      toast.success(
        `${settingLabels[settingName]} ${!currentValue ? 'restricted to admins' : 'allowed for all members'}`
      );
    } catch (error) {
      console.error('Error updating setting:', error);
      toast.error(error.message || 'Failed to update setting');
    }
  };

  // Check if user can edit based on permissions
  const canEdit = isAdmin || !activeGroup?.admins_only_edit_info;
  const isCreator = user?.id === activeGroup?.created_by;
  const canAddMembers = isAdmin || isCreator || !activeGroup?.admins_only_add_members;

  // Render avatar
  const renderAvatar = () => {
    if (avatarPreview) {
      return <img src={avatarPreview} alt={activeGroup?.name} />;
    }
    return (
      <div className="avatar-placeholder">
        {activeGroup?.name?.charAt(0)?.toUpperCase() || 'G'}
      </div>
    );
  };

  return (
    <>
      <div className={`group-info-drawer ${isOpen ? 'open' : ''}`} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="drawer-header">
          {!isDesktop && (
            <button className="close-btn mobile-back-btn" onClick={onClose}>
              <ArrowLeft size={20} />
            </button>
          )}
          <h2>Group Info ({members.length})</h2>
          {isDesktop && (
            <button className="close-btn desktop-close-btn" onClick={onClose}>
              <X size={20} />
            </button>
          )}
        </div>

        {/* Scrollable Content Area */}
        <div className="drawer-content">
          {/* Group Info */}
          <div className="group-info-section">
            {loadingGroup ? (
              <div className="loading">
                <LoaderCircle className="animate-spin" size={32} />
                <span>Loading group info...</span>
              </div>
            ) : (
              <>
                {isEditing ? (
                  <div className="avatar-edit-container">
                    <div className="group-avatar-large editable">
                      {renderAvatar()}
                      <div className="avatar-edit-overlay">
                        <Camera size={24} />
                      </div>
                    </div>
                    <div className="avatar-edit-buttons">
                      <button
                        className="btn-avatar-option"
                        onClick={() => setShowDpPicker(true)}
                        type="button"
                      >
                        <Image size={16} />
                        Choose from Gallery
                      </button>
                      <button
                        className="btn-avatar-option"
                        onClick={() => avatarInputRef.current?.click()}
                        disabled={isUploadingAvatar}
                        type="button"
                      >
                        {isUploadingAvatar ? (
                          <LoaderCircle className="animate-spin" size={16} />
                        ) : (
                          <Upload size={16} />
                        )}
                        Upload Photo
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    className={`group-avatar-large ${isAdmin ? 'editable' : ''}`}
                    onClick={() => isAdmin && avatarInputRef.current?.click()}
                  >
                    {renderAvatar()}
                    {isAdmin && (
                      <div className="avatar-edit-overlay">
                        {isUploadingAvatar ? (
                          <LoaderCircle className="animate-spin" size={24} />
                        ) : (
                          <Camera size={24} />
                        )}
                      </div>
                    )}
                  </div>
                )}

                <input
                  type="file"
                  ref={avatarInputRef}
                  onChange={handleAvatarFileChange}
                  accept="image/*"
                  style={{ display: 'none' }}
                  disabled={isUploadingAvatar}
                />
              </>
            )}

            {isEditing ? (
              <div className="edit-form">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Group name"
                  maxLength={50}
                  autoFocus
                />
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Group description (optional)"
                  maxLength={100}
                />
                <div className="edit-actions">
                  <button 
                    className="btn-cancel" 
                    onClick={handleCancelEdit}
                    disabled={isUpdating}
                  >
                    Cancel
                  </button>
                  <button 
                    className={`btn-save ${isUpdating ? 'loading' : ''}`}
                    onClick={handleSaveEdit}
                    disabled={isUpdating || !editName.trim()}
                  >
                    {isUpdating ? <LoaderCircle className="animate-spin" size={16} /> : <Check size={16} />}
                    {isUpdating ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="group-details">
                <h3 className="group-name">{activeGroup?.name}</h3>
                {activeGroup?.description && (
                  <p className="group-description">{activeGroup.description}</p>
                )}

                <div className="group-meta-info">
                  <p className="member-count">
                    <Users size={14} />
                    {members.length} {members.length === 1 ? 'participant' : 'participants'}
                  </p>
                  {activeGroup?.created_at && (
                    <p className="creation-date">
                      <Calendar size={14} />
                      Created {dayjs(activeGroup.created_at).format('MMM D, YYYY')}
                    </p>
                  )}
                  {activeGroup?.creator?.name && (
                    <p className="creator-info">
                      <UserIcon size={14} />
                      Created by {activeGroup.creator.name === user?.name ? 'You' : activeGroup.creator.name}
                    </p>
                  )}
                </div>

                {canEdit && (
                  <button className="edit-group-btn" onClick={() => setIsEditing(true)}>
                    <Edit size={14} />
                    Edit Group Info
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="quick-actions">
            <button className="action-btn" onClick={() => onCallStart?.('voice')}>
              <Phone size={18} />
              <span>Audio</span>
            </button>
            <button className="action-btn" onClick={() => onCallStart?.('video')}>
              <Video size={18} />
              <span>Video</span>
            </button>
            <button className="action-btn" onClick={handleMuteToggle}>
              {isMuted ? <BellOff size={18} /> : <Bell size={18} />}
              <span>{isMuted ? 'Unmute' : 'Mute'}</span>
            </button>
          </div>

          {/* Group Settings Section (Admins Only) */}
          {isAdmin && (
            <div className="settings-section">
              <div className="section-header">
                <h3>
                  <Shield size={14} />
                  Group Permissions
                </h3>
              </div>
              <div className="settings-list">
                <div className="setting-item">
                  <div className="setting-info">
                    <div className="setting-label">
                      <Edit size={16} />
                      <span>Edit Group Info</span>
                    </div>
                    <p className="setting-desc">
                      Only admins can change group name, description and avatar
                    </p>
                  </div>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={!!activeGroup?.admins_only_edit_info}
                      onChange={() =>
                        handleToggleSetting('admins_only_edit_info', activeGroup?.admins_only_edit_info)
                      }
                    />
                    <span className="slider round"></span>
                  </label>
                </div>

                <div className="setting-item">
                  <div className="setting-info">
                    <div className="setting-label">
                      <Users size={16} />
                      <span>Add Participants</span>
                    </div>
                    <p className="setting-desc">Only admins can add new members to this group</p>
                  </div>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={!!activeGroup?.admins_only_add_members}
                      onChange={() =>
                        handleToggleSetting('admins_only_add_members', activeGroup?.admins_only_add_members)
                      }
                    />
                    <span className="slider round"></span>
                  </label>
                </div>

                <div className="setting-item">
                  <div className="setting-info">
                    <div className="setting-label">
                      <MessageSquare size={16} />
                      <span>Send Messages</span>
                    </div>
                    <p className="setting-desc">
                      Only admins can send messages (Members will have read-only access)
                    </p>
                  </div>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={!!activeGroup?.admins_only_messages}
                      onChange={() =>
                        handleToggleSetting('admins_only_messages', activeGroup?.admins_only_messages)
                      }
                    />
                    <span className="slider round"></span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Members List */}
          <div className="members-section">
            <div className="section-header">
              <h3>{members.length} Participants</h3>
              {canAddMembers && groupId && (
                <button
                  className="add-member-btn-link"
                  onClick={() => setShowAddMembersModal(true)}
                >
                  <UserPlus size={14} />
                  Add
                </button>
              )}

            </div>

            <div className="members-list">
              {loadingMembers ? (
                <div className="loading">
                  <LoaderCircle className="animate-spin" size={24} />
                  <span>Loading members...</span>
                </div>
              ) : members.length > 0 ? (
                members.map((member) => (
                  <MemberItem
                    key={member.user_id}
                    member={member}
                    groupId={groupId}
                    currentUserId={user?.id}
                    isCurrentUserAdmin={isAdmin}
                    creatorId={activeGroup?.created_by || activeGroup?.creator?.id}
                  />
                ))
              ) : (
                <div className="no-members">
                  <Users size={48} />
                  <span>No members yet</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Leave Group */}
        <div className="leave-section">
          <button className="leave-btn" onClick={handleLeaveGroup}>
            <LogOut size={18} />
            Exit Group
          </button>
        </div>
      </div>



      {/* DP Picker Modal */}
      <DpPicker
        isOpen={showDpPicker}
        onClose={() => setShowDpPicker(false)}
        onSelect={handleDpSelect}
        currentDp={selectedDp}
      />

      {/* Add Members Modal */}
      <AddMembersModal
        isOpen={showAddMembersModal}
        onClose={() => setShowAddMembersModal(false)}
        groupId={groupId}
        existingMemberIds={members.map(m => m.user_id)}
        onSuccess={() => {
          refetchMembers();
          setShowAddMembersModal(false);
        }}
      />
    </>
  );
};

export default GroupInfoDrawer;