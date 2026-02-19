/**
 * GroupsPage - Shows all groups in a sidebar/drawer format
 * Displays user's groups with options to view info and manage
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useGroupActions } from '../../hooks/useGroupActions';
import GroupInfoDrawer from './GroupInfoDrawer';
import CreateGroupModal from './CreateGroupModal';
import { Users, Search, Plus, MoreVertical, MessageCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import './GroupsPage.css';

const GroupsPage = ({ onClose, onGroupClick, isDrawer = true }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { useUserGroups } = useGroupActions();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [groupMenuOpen, setGroupMenuOpen] = useState(null);

  const { data: groupsData = [], isLoading, refetch } = useUserGroups(user?.id);

  // Format groups data
  const groups = (groupsData || []).map(g => ({
    id: g.group_id,
    name: g.group?.name || 'Unnamed Group',
    avatar_url: g.group?.avatar_url,
    description: g.group?.description,
    member_count: g.group?.member_count || 0,
    role: g.role,
    created_at: g.group?.created_at,
  }));

  // Filter by search
  const filteredGroups = groups.filter(group =>
    group.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handle group click
  const handleGroupClick = (group) => {
    if (onGroupClick) {
      onGroupClick(group);
    } else {
      // Navigate to chat
      navigate(`/chat/${group.id}/group`);
      if (onClose) onClose();
    }
  };

  // Handle group info click
  const handleGroupInfoClick = (group, e) => {
    e.stopPropagation();
    setSelectedGroup(group);
    setShowGroupInfo(true);
  };

  // Get initials from group name
  const getInitials = (name) => {
    if (!name) return 'G';
    const words = name.split(' ');
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <>
      <div className={`groups-page ${isDrawer ? 'drawer-mode' : 'page-mode'}`}>
        {/* Header */}
        <div className="groups-header">
          <div className="groups-header-left">
            <h2>Groups</h2>
            <span className="groups-count">{groups.length}</span>
          </div>
          {isDrawer && (
            <button className="close-groups-btn" onClick={onClose}>
              ×
            </button>
          )}
        </div>

        {/* Search */}
        <div className="groups-search">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search groups..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Groups List */}
        <div className="groups-list">
          {isLoading ? (
            <div className="groups-loading">
              <div className="loading-spinner"></div>
              <p>Loading groups...</p>
            </div>
          ) : filteredGroups.length > 0 ? (
            filteredGroups.map(group => (
              <div
                key={group.id}
                className="group-item"
                onClick={() => handleGroupClick(group)}
              >
                <div className="group-avatar">
                  {group.avatar_url ? (
                    <img src={group.avatar_url} alt={group.name} />
                  ) : (
                    <div className="avatar-placeholder">
                      {getInitials(group.name)}
                    </div>
                  )}
                </div>
                <div className="group-info">
                  <div className="group-name-row">
                    <span className="group-name">{group.name}</span>
                    {group.role === 'admin' && (
                      <span className="admin-badge">Admin</span>
                    )}
                  </div>
                  <div className="group-meta">
                    <Users size={12} />
                    <span>{group.member_count} members</span>
                  </div>
                </div>
                <button
                  className="group-info-btn"
                  onClick={(e) => handleGroupInfoClick(group, e)}
                  title="Group Info"
                >
                  <MoreVertical size={18} />
                </button>
              </div>
            ))
          ) : (
            <div className="groups-empty">
              <MessageCircle size={48} />
              <h3>No groups yet</h3>
              <p>Create a group to start chatting with multiple contacts</p>
            </div>
          )}
        </div>

        {/* Create Group Button */}
        <div className="groups-footer">
          <button
            className="create-group-btn"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus size={20} />
            Create New Group
          </button>
        </div>
      </div>

      {/* Group Info Drawer */}
      {showGroupInfo && selectedGroup && (
        <GroupInfoDrawer
          isOpen={showGroupInfo}
          onClose={() => {
            setShowGroupInfo(false);
            setSelectedGroup(null);
          }}
          group={selectedGroup}
        />
      )}
      {/* Create Group Modal */}
      <CreateGroupModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          refetch();
          setShowCreateModal(false);
        }}
      />
    </>
  );
};

export default GroupsPage;
