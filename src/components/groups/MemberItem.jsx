/**
 * MemberItem - Individual row for a member (with Admin actions)
 */

import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useGroupActions } from '../../hooks/useGroupActions';
import { getDpById } from '../../utils/dpOptions';
import { isUserOnline } from '../../utils/timeUtils';
import { useSupabase } from '../../contexts/SupabaseContext';
import { MoreVertical, Crown, User, Phone, Trash2, ArrowUp, Flag } from 'lucide-react';
import { useDialog } from '../../contexts/DialogContext';
import toast from 'react-hot-toast';

const MemberItem = ({ member, groupId, currentUserId, isCurrentUserAdmin, creatorId }) => {
  const { showAlert, showConfirm } = useDialog();
  const { useRemoveMember, useMakeAdmin, useDemoteAdmin } = useGroupActions();
  const { supabase } = useSupabase();

  const [showMenu, setShowMenu] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');

  const memberUserId = member.users?.id || member.user_id;
  const memberName = member.users?.name || 'Unknown';
  const memberAvatar = member.users?.avatar;
  const memberRole = member.role;
  const memberPhone = member.users?.phone;
  const isOnline = isUserOnline(Boolean(member.users?.is_online), member.users?.last_seen);
  const isCurrentUser = memberUserId === currentUserId;
  const isCreator = memberUserId === creatorId;
  const joinDate = member.created_at;

  const removeMemberMutation = useRemoveMember();
  const makeAdminMutation = useMakeAdmin();
  const demoteAdminMutation = useDemoteAdmin();

  // Helper to get avatar source
  const getAvatarSrc = () => {
    if (!memberAvatar) return null;

    // If it's an integer ID (preset DP)
    if (!isNaN(parseInt(memberAvatar)) && parseInt(memberAvatar).toString() === memberAvatar.toString()) {
      return getDpById(memberAvatar)?.path;
    }

    // Regular URL
    return memberAvatar;
  };

  const avatarSrc = getAvatarSrc();

  // Handle remove member
  const handleRemove = async () => {
    if (!(await showConfirm(`Remove ${memberName} from the group?`))) return;

    try {
      await removeMemberMutation.mutateAsync({ groupId, userId: memberUserId });
      toast.success(`${memberName} removed from group`);
    } catch (error) {
      console.error('Error removing member:', error);
    }
    setShowMenu(false);
  };

  // ... (rest of the handlers same)

  // ... handleMakeAdmin, handleDemote ...
  // (Adding them back for context in the chunk)
  const handleMakeAdmin = async () => {
    try {
      await makeAdminMutation.mutateAsync({ groupId, userId: memberUserId });
      toast.success(`${memberName} promoted to admin`);
    } catch (error) {
      console.error('Error making admin:', error);
    }
    setShowMenu(false);
  };

  const handleDemote = async () => {
    try {
      await demoteAdminMutation.mutateAsync({ groupId, userId: memberUserId });
      toast.success(`${memberName} demoted to member`);
    } catch (error) {
      console.error('Error demoting admin:', error);
    }
    setShowMenu(false);
  };

  // Report member handler
  const handleReport = async () => {
    if (!reportReason.trim()) {
      toast.error('Please select a reason');
      return;
    }
    try {
      const { error } = await supabase.from('reports').insert({
        reporter_id: currentUserId,
        reported_id: memberUserId,
        reason: reportReason,
        details: `Reported in group context (group: ${groupId})`,
      });
      if (error) throw error;
      toast.success('Report submitted');
    } catch (err) {
      console.error('Error submitting report:', err);
      toast.error('Failed to submit report');
    }
    setShowReportModal(false);
    setReportReason('');
    setShowMenu(false);
  };

  const showAdminMenu = isCurrentUserAdmin && !isCurrentUser;
  // Non-admin members can also report other members
  const showReportOption = !isCurrentUser;

  return (
    <div className="member-item">
      <div className="member-avatar">
        {avatarSrc ? (
          <img src={avatarSrc} alt={memberName} />
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
          <div className="member-badges">
            {isCreator && (
              <span className="creator-badge" title="Group Creator">
                Creator
              </span>
            )}
            {memberRole === 'admin' && (
              <span className="admin-badge" title="Admin">
                <Crown size={12} />
              </span>
            )}
          </div>
        </div>
        <div className="member-status-row">
          <span className={`status-text ${isOnline ? 'online' : ''}`}>
            {isOnline ? 'Online' : (member.users?.phone || 'Offline')}
          </span>
          {joinDate && (
            <span className="join-date">
              Joined {new Date(joinDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          )}
        </div>
      </div>

      {(showAdminMenu || showReportOption) && (
        <div className="member-actions">
          <button
            className="menu-trigger"
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
          >
            <MoreVertical size={18} />
          </button>

          {showMenu && (
            <div className="member-menu" onClick={(e) => e.stopPropagation()}>
              {showAdminMenu && memberRole !== 'admin' && (
                <button className="menu-item" onClick={handleMakeAdmin}>
                  <ArrowUp size={16} />
                  <span>Make Admin</span>
                </button>
              )}
              {showAdminMenu && memberRole === 'admin' && (
                <button className="menu-item" onClick={handleDemote}>
                  <User size={16} />
                  <span>Demote to Member</span>
                </button>
              )}
              {showAdminMenu && (
                <button className="menu-item danger" onClick={handleRemove}>
                  <Trash2 size={16} />
                  <span>Remove from Group</span>
                </button>
              )}
              {showReportOption && (
                <button className="menu-item" onClick={() => { setShowMenu(false); setShowReportModal(true); }}>
                  <Flag size={16} />
                  <span>Report Member</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Report Modal */}
      {showReportModal && (
        <div className="report-modal-overlay" onClick={() => setShowReportModal(false)}>
          <div className="report-modal" onClick={(e) => e.stopPropagation()}>
            <h4>Report {memberName}</h4>
            <p>Choose a reason for your report:</p>
            <select
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              className="report-select"
            >
              <option value="">Select a reason...</option>
              <option value="spam">Spam</option>
              <option value="harassment">Harassment</option>
              <option value="hate_speech">Hate Speech</option>
              <option value="inappropriate_content">Inappropriate Content</option>
              <option value="other">Other</option>
            </select>
            <div className="report-modal-actions">
              <button className="btn-cancel" onClick={() => setShowReportModal(false)}>Cancel</button>
              <button className="btn-submit" onClick={handleReport}>Submit Report</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MemberItem;
