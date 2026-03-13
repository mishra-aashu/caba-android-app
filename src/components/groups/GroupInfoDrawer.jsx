/**
 * GroupInfoDrawer - Right sidebar showing group members & settings
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useGroupActions } from '../../hooks/useGroupActions';
import MemberItem from './MemberItem';
import AddMembersModal from './AddMembersModal';
import { X, Edit, Users, Info, Phone, Video, Bell, BellOff, LogOut, Settings, Crown, Calendar, User as UserIcon, Camera, Shield, Lock, MessageSquare, ArrowLeft, LoaderCircle } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { useDialog } from '../../contexts/DialogContext';
import useIsDesktop from '../../hooks/useIsDesktop';
import { uploadGroupAvatar } from '../../services/groupService';
import './GroupInfoDrawer.css';

const GroupInfoDrawer = ({ isOpen, onClose, group, onCallStart }) => {
  const { user } = useAuth();
  const { showAlert, showConfirm } = useDialog();
  const isDesktop = useIsDesktop();
  const { useGroup, useGroupMembers, useIsAdmin, useLeaveGroup, useUpdateGroup } = useGroupActions();

  const [showAddMembers, setShowAddMembers] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const avatarInputRef = React.useRef(null);

  const groupId = group?.id;

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
    }
  }, [activeGroup]);

  // Handle leave group
  const handleLeaveGroup = async () => {
    const confirmed = await showConfirm('Are you sure you want to leave this group?');
    if (!confirmed) return;

    try {
      await leaveGroupMutation.mutateAsync({ groupId, userId: user.id });
      onClose();
    } catch (error) {
      console.error('Error leaving group:', error);
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
    toast.success(newMutedState ? 'Notifications muted' : 'Notifications unmuted');
  };

  // Handle save edits
  const handleSaveEdit = async () => {
    if (!editName.trim()) {
      toast.error('Group name cannot be empty');
      return;
    }

    try {
      await updateGroupMutation.mutateAsync({
        groupId,
        updates: {
          name: editName.trim(),
          description: editDescription.trim() || null,
        },
      });
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating group:', error);
    }
  };

  // Handle avatar change
  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingAvatar(true);
    try {
      const avatarUrl = await uploadGroupAvatar(file, groupId);

      await updateGroupMutation.mutateAsync({
        groupId,
        updates: { avatar_url: avatarUrl },
      });

      toast.success('Group avatar updated!');
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast.error('Failed to update avatar');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  // Handle toggle settings
  const handleToggleSetting = async (settingName, currentValue) => {
    try {
      await updateGroupMutation.mutateAsync({
        groupId,
        updates: { [settingName]: !currentValue },
      });
      toast.success('Group setting updated');
    } catch (error) {
      console.error('Error updating setting:', error);
      toast.error('Failed to update setting');
    }
  };

  return (
    <div className={`group-info-drawer ${isOpen ? 'open' : ''}`} onClick={(e) => e.stopPropagation()}>
      {/* Header */}
      <div className="drawer-header">
        {!isDesktop && (
          <button className="close-btn mobile-back-btn" onClick={onClose}>
            <ArrowLeft size={20} />
          </button>
        )}
        <h2>Group Info</h2>
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
            <div className="loading">Updating...</div>
          ) : (
            <div className={`group-avatar-large ${isAdmin ? 'editable' : ''}`} onClick={() => isAdmin && avatarInputRef.current?.click()}>
              {activeGroup?.avatar_url ? (
                <img src={activeGroup.avatar_url} alt={activeGroup.name} />
              ) : (
                <div className="avatar-placeholder">
                  {activeGroup?.name?.charAt(0)?.toUpperCase() || 'G'}
                </div>
              )}
              {isAdmin && (
                <div className="avatar-edit-overlay">
                  {isUploadingAvatar ? <LoaderCircle className="animate-spin" /> : <Camera size={24} />}
                </div>
              )}
              <input
                type="file"
                ref={avatarInputRef}
                onChange={handleAvatarChange}
                accept="image/*"
                style={{ display: 'none' }}
              />
            </div>
          )}

          {isEditing ? (
            <div className="edit-form">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Group name"
                maxLength={50}
              />
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Group description (optional)"
                maxLength={100}
              />
              <div className="edit-actions">
                <button className="btn-cancel" onClick={() => setIsEditing(false)}>
                  Cancel
                </button>
                <button className="btn-save" onClick={handleSaveEdit}>
                  Save
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
                  {members.length} members
                </p>
                {activeGroup?.created_at && (
                  <p className="creation-date">
                    <Calendar size={14} />
                    Created on {format(new Date(activeGroup.created_at), 'MMM d, yyyy')}
                  </p>
                )}
                {activeGroup?.creator?.name && (
                  <p className="creator-info">
                    <UserIcon size={14} />
                    Created by {activeGroup.creator.name}
                  </p>
                )}
              </div>

              {(isAdmin || !activeGroup?.admins_only_edit_info) && (
                <button className="edit-group-btn" onClick={() => setIsEditing(true)}>
                  <Edit size={14} />
                  Edit Group
                </button>
              )}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="quick-actions">
          <button className="action-btn" onClick={() => onCallStart?.('voice')}>
            <Phone size={18} />
            <span>Voice Call</span>
          </button>
          <button className="action-btn" onClick={() => onCallStart?.('video')}>
            <Video size={18} />
            <span>Video Call</span>
          </button>
          <button className="action-btn" onClick={handleMuteToggle}>
            {isMuted ? <BellOff size={18} /> : <Bell size={18} />}
            <span>{isMuted ? 'Unmute' : 'Mute'}</span>
          </button>
        </div>

        {/* Group Settings Section (Group Admins Only) */}
        {isAdmin && (
          <div className="settings-section">
            <div className="section-header">
              <h3>Group Settings</h3>
            </div>
            <div className="settings-list">
              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-label">
                    <Edit size={16} />
                    <span>Edit Group Info</span>
                  </div>
                  <p className="setting-desc">Only admins can change group name, description and image</p>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={!!activeGroup?.admins_only_edit_info}
                    onChange={() => handleToggleSetting('admins_only_edit_info', activeGroup?.admins_only_edit_info)}
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
                    onChange={() => handleToggleSetting('admins_only_add_members', activeGroup?.admins_only_add_members)}
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
                  <p className="setting-desc">Only admins can send messages (Members will be read-only)</p>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={!!activeGroup?.admins_only_messages}
                    onChange={() => handleToggleSetting('admins_only_messages', activeGroup?.admins_only_messages)}
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
            <h3>Participants</h3>
            {(isAdmin || !activeGroup?.admins_only_add_members) && (
              <button className="add-member-btn" onClick={() => setShowAddMembers(true)}>
                Add Member
              </button>
            )}
          </div>

          <div className="members-list">
            {loadingMembers ? (
              <div className="loading">Loading members...</div>
            ) : (
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
            )}
          </div>
        </div>
      </div>

      {/* Leave Group */}
      <div className="leave-section">
        <button className="leave-btn" onClick={handleLeaveGroup}>
          <LogOut size={18} />
          Leave Group
        </button>
      </div>

      {/* Add Members Modal */}
      <AddMembersModal
        isOpen={showAddMembers}
        onClose={() => setShowAddMembers(false)}
        groupId={groupId}
        existingMemberIds={members.map(m => m.user_id)}
        onSuccess={() => {
          refetchMembers();
          setShowAddMembers(false);
        }}
      />
    </div>
  );
};

export default GroupInfoDrawer;
