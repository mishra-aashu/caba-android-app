import React from 'react';
import { useCallHistory } from '../hooks/useCallHistory';
import { useCall } from '../context/CallContext';
import { dpOptions } from '../utils/dpOptions';
import { Phone, PhoneIncoming, PhoneMissed, PhoneOutgoing, Video } from 'lucide-react';
import '../styles/clean-cards.css';

export function CallHistory({ userId, userAvatar, userName }) {
  const { history, loading, error, missedCount } = useCallHistory(userId);
  const { startCall, callState } = useCall();

  const formatDuration = (seconds) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const getCallIcon = (call) => {
    const isOutgoing = call.caller_id === userId;
    const isMissed = call.call_status === 'missed';
    const isVideo = call.call_type === 'video';

    if (isMissed) {
      return <PhoneMissed className="w-5 h-5 text-red-500" />;
    }
    if (isOutgoing) {
      return <PhoneOutgoing className="w-5 h-5 text-green-500" />;
    }
    return <PhoneIncoming className="w-5 h-5 text-blue-500" />;
  };

  const handleCall = async (otherUserId, callType) => {
    if (callState !== 'idle') {
      console.log('Already in a call');
      return;
    }

    try {
      await startCall(otherUserId, callType);
    } catch (error) {
      console.error('Failed to start call:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-8 text-red-500">
        Error loading call history
      </div>
    );
  }

  return (
    <div className="call-history-wrapper">
      <div className="call-history-card">
        {/* Header */}
        <div className="call-history-header">
          <div className="header-content">
            <h2 className="call-history-title">Call History</h2>
            {missedCount > 0 && (
              <span className="missed-calls-badge">
                {missedCount} missed
              </span>
            )}
          </div>
          {userAvatar && (
            <div className="user-avatar-header">
              <div className="avatar-circle">
                {userAvatar ? (
                  parseInt(userAvatar) ? (
                    <img src={dpOptions.find(dp => dp.id === parseInt(userAvatar))?.path || userAvatar} alt={userName || 'User'} />
                  ) : (
                    <img src={userAvatar} alt={userName || 'User'} />
                  )
                ) : (
                  userName?.charAt(0) || '?'
                )}
              </div>
            </div>
          )}
        </div>

        {/* Call List */}
        <div>
          {history.length > 0 ? (
            history.map((call) => (
              <div key={call.id} className="call-item">
                {/* Avatar */}
                <div className="call-avatar">
                  {call.other_user_avatar ? (
                    parseInt(call.other_user_avatar) ? (
                      <img
                        src={dpOptions.find(dp => dp.id === parseInt(call.other_user_avatar))?.path || call.other_user_avatar}
                        alt={call.other_user_name}
                      />
                    ) : (
                      <img
                        src={call.other_user_avatar}
                        alt={call.other_user_name}
                      />
                    )
                  ) : (
                    call.other_user_name?.charAt(0) || '?'
                  )}
                </div>

                {/* Info */}
                <div className="call-details">
                  <h3 className="call-name">
                    {call.other_user_name || 'Unknown'}
                  </h3>
                  <div className="call-status-row">
                    {call.call_status === 'missed' ? (
                      <PhoneMissed size={14} className="status-icon missed" />
                    ) : call.caller_id === userId ? (
                      <PhoneOutgoing size={14} className="status-icon outgoing" />
                    ) : (
                      <PhoneIncoming size={14} className="status-icon incoming" />
                    )}
                    <span className="call-time-text">{formatTime(call.started_at)}</span>
                  </div>
                </div>

                {/* Call Button */}
                <button
                  className="call-action-btn"
                  onClick={() => handleCall(call.other_user_id, call.call_type)}
                  disabled={callState !== 'idle'}
                >
                  {call.call_type === 'video' ? (
                    <Video size={22} />
                  ) : (
                    <Phone size={22} />
                  )}
                </button>
              </div>
            ))
          ) : (
            <div className="empty-state">
              <Phone size={48} />
              <h3>No call history</h3>
              <p>Your calls will appear here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default CallHistory;