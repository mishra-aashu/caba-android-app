/**
 * MemberItem - Individual row for a member (with Admin actions)
 */

import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useGroupActions } from '../../hooks/useGroupActions';
import { isUserOnline } from '../../utils/timeUtils';
import { MoreVertical, Crown, User, Phone, Trash2, ArrowUp } from 'lucide-react';
import toast from 'react-hot-toast';

const MemberItem = ({ member, groupId, currentUserId, isCurrentUserAdmin }) => {
  const { useRemoveMember, useMakeAdmin, useDemoteAdmin } = useGroupActions();
  
  const [showMenu, setShowMenu] = useState(false);
  
  const memberUserId = member.user?.id || member.user_id;
  const memberName = member.user?.name || 'Unknown';
  const memberAvatar = member.user?.avatar;
  const memberRole = member.role;
  const memberPhone = member.user?.phone;
  const isOnline = isUserOnline(Boolean(member.user?.is_online), member.user?.last_seen);
  const isCurrentUser = memberUserId === currentUserId;

  const removeMemberMutation = useRemoveMember();
  const makeAdminMutation = useMakeAdmin();
  const demoteAdminMutation = useDemoteAdmin();

  // Handle remove member
  const handleRemove = async () => {
    if (!window.confirm(`Remove ${memberName} from the group?`)) return;

    try {
      await removeMemberMutation.mutateAsync({ groupId, userId: memberUserId });
      toast.success(`${memberName} removed from group`);
    } catch (error) {
      console.error('Error removing member:', error);
    }
    setShowMenu(false);
  };

  // Handle make admin
  const handleMakeAdmin = async () => {
    try {
      await makeAdminMutation.mutateAsync({ groupId, userId: memberUserId });
      toast.success(`${memberName} promoted to admin`);
    } catch (error) {
      console.error('Error making admin:', error);
    }
    setShowMenu(false);
  };

  // Handle demote admin
  const handleDemote = async () => {
    try {
      await demoteAdminMutation.mutateAsync({ groupId, userId: memberUserId });
      toast.success(`${memberName} demoted to member`);
    } catch (error) {
      console.error('Error demoting admin:', error);
    }
    setShowMenu(false);
  };

  // Don't show admin menu for yourself
  const showAdminMenu = isCurrentUserAdmin && !isCurrentUser;

  return (
    <div className="member-item">
      <div className="member-avatar">
        {memberAvatar ? (
          <img src={memberAvatar} alt={memberName} />
        ) : (
          <div className="avatar-placeholder">
            {memberName?.charAt(0)?.toUpperCase() || '?'}
          </div>
        )}
        {isOnline && <span className="online-dot"></span>}
      </div>

      <div className="member-info">
        <div className="member-name-row">
          <span className="member-name">
            {isCurrentUser ? 'You' : memberName}
          </span>
          {memberRole === 'admin' && (
            <span className="admin-badge" title="Admin">
              <Crown size={12} />
            </span>
          )}
        </div>
        <div className="member-status">
          {isOnline ? 'Online' : memberPhone || ''}
        </div>
      </div>

      {showAdminMenu && (
        <div className="member-actions">
          <button 
            className="menu-trigger" 
            onClick={() => setShowMenu(!showMenu)}
          >
            <MoreVertical size={18} />
          </button>

          {showMenu && (
            <div className="member-menu">
              {memberRole !== 'admin' && (
                <button className="menu-item" onClick={handleMakeAdmin}>
                  <ArrowUp size={16} />
                  <span>Make Admin</span>
                </button>
              )}
              {memberRole === 'admin' && (
                <button className="menu-item" onClick={handleDemote}>
                  <User size={16} />
                  <span>Demote to Member</span>
                </button>
              )}
              <button className="menu-item danger" onClick={handleRemove}>
                <Trash2 size={16} />
                <span>Remove</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MemberItem;
