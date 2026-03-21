import React, { useCallback, useMemo } from 'react';
import { useCallHistory } from '../hooks/useCallHistory';
import { useCall } from '../contexts/CallContext';
import { dpOptions } from '../utils/dpOptions';
import { Phone, PhoneIncoming, PhoneMissed, PhoneOutgoing, Video } from 'lucide-react';

// [FIX #5] Extracted shared avatar renderer — was duplicated 2x
const CallAvatar = ({ avatar, name, size = 48 }) => {
    const resolvedSrc = avatar
        ? (parseInt(avatar)
            ? dpOptions.find(dp => dp.id === parseInt(avatar))?.path || avatar
            : avatar)
        : null;

    return (
        <div className="call-avatar" style={{ width: size, height: size, minWidth: size }}>
            {resolvedSrc ? (
                <img src={resolvedSrc} alt={name || 'User'} />
            ) : (
                <span>{name?.charAt(0) || '?'}</span>
            )}
        </div>
    );
};

export function CallHistory({ userId, userAvatar, userName }) {
    const { history, loading, error, missedCount } = useCallHistory(userId);
    const { startCall, callState } = useCall();

    // [FIX #2] REMOVED: formatDuration — was defined but never used anywhere
    // If needed in the future, it can be added back when call duration is displayed

    const formatTime = useCallback((timestamp) => {
        if (!timestamp) return '';
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
    }, []);

    // [FIX #1 + #3] REMOVED: getCallIcon function
    // Was defined but NEVER called — icon logic was duplicated inline in JSX
    // Also had Tailwind classes (w-5, h-5, text-red-500) which don't work in this project

    const handleCall = useCallback(async (otherUserId, callType) => {
        if (callState !== 'idle') return;

        try {
            await startCall(otherUserId, callType);
        } catch (error) {
            console.error('Failed to start call:', error);
        }
    }, [callState, startCall]);
    
    // 🔥 Grouping logic for cleaner call history
    const groupedHistory = useMemo(() => {
        if (!history || history.length === 0) return [];
        
        const groups = [];
        let currentGroup = null;

        history.forEach((call) => {
            // Group criteria: same user + same status + same type (consecutive)
            const canGroup = currentGroup && 
                            currentGroup.other_user_id === call.other_user_id &&
                            currentGroup.call_status === call.call_status &&
                            currentGroup.call_type === call.call_type;

            if (canGroup) {
                currentGroup.count += 1;
            } else {
                currentGroup = { ...call, count: 1 };
                groups.push(currentGroup);
            }
        });

        return groups;
    }, [history]);

    // [FIX #6] Guard for missing userId
    if (!userId) {
        return (
            <div className="empty-state">
                <Phone size={48} />
                <h3>No user selected</h3>
                <p>Select a user to view call history</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="calls-loading" style={{ height: 'auto', padding: '2rem' }}>
                <div className="loading-spinner"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="empty-state">
                <p style={{ color: '#D32F2F' }}>Error loading call history</p>
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
                    {/* [FIX #4 + #5] Simplified — removed dead ternary branch,
                        using shared CallAvatar component */}
                    {userAvatar && (
                        <div className="user-avatar-header">
                            <div className="avatar-circle">
                                <CallAvatar avatar={userAvatar} name={userName} />
                            </div>
                        </div>
                    )}
                </div>

                {/* Call List */}
                <div>
                    {groupedHistory.length > 0 ? (
                        groupedHistory.map((call) => (
                            <div key={`${call.id}-${call.count}`} className="call-item">
                                {/* [FIX #5] Using shared CallAvatar */}
                                <CallAvatar
                                    avatar={call.other_user_avatar}
                                    name={call.other_user_name}
                                />

                                {/* Info */}
                                <div className="call-details">
                                    <h3 className="call-name">
                                        {call.other_user_name || 'Unknown'} {call.count > 1 && `(${call.count})`}
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
                                    title={call.call_type === 'video' ? 'Video Call' : 'Voice Call'}
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