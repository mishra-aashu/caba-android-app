import React, { useState, useEffect } from 'react';
import { useGroupCall } from '../../context/GroupCallContext';
import { Phone, PhoneOff, Video, VideoOff, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import '../../styles/group-call-notification.css';

const GroupIncomingCallNotification = () => {
    const { incomingGroupCall, clearIncomingGroupCall, joinGroupCall } = useGroupCall();
    const [isVideoEnabled, setIsVideoEnabled] = useState(true);

    // Auto-hide after 30 seconds if not acted upon
    useEffect(() => {
        if (incomingGroupCall) {
            console.log('🔔 Notification component received incoming call:', incomingGroupCall);
            toast.success('Incoming Call UI Active!', { id: 'ui-active' });
            const timer = setTimeout(() => {
                console.log('🔔 Auto-clearing notification after timeout');
                clearIncomingGroupCall();
            }, 30000);
            return () => clearTimeout(timer);
        }
    }, [incomingGroupCall, clearIncomingGroupCall]);

    if (!incomingGroupCall) return null;

    const handleJoin = () => {
        // Join logic with video toggle preference
        joinGroupCall(incomingGroupCall.id, isVideoEnabled);
        clearIncomingGroupCall();
    };

    return (
        <div className="group-call-notification-overlay">
            <div className="group-call-notification">
                <div className="notification-header">
                    <div className="caller-avatar">
                        {incomingGroupCall.callerAvatar ? (
                            <img src={incomingGroupCall.callerAvatar} alt={incomingGroupCall.callerName} />
                        ) : (
                            incomingGroupCall.callerName.charAt(0)
                        )}
                    </div>
                    <div className="call-info">
                        <h4 className="caller-name">{incomingGroupCall.callerName} calling...</h4>
                        <div className="group-call-label">
                            In group <span className="group-name-tag">{incomingGroupCall.groupName}</span>
                        </div>
                    </div>
                    <button className="icon-btn close-btn" onClick={clearIncomingGroupCall}>
                        <X size={18} />
                    </button>
                </div>

                <div className="notification-actions">
                    <button className="notif-btn ignore" onClick={clearIncomingGroupCall}>
                        <PhoneOff size={18} />
                        Ignore
                    </button>

                    {incomingGroupCall.call_type === 'video' && (
                        <button
                            className={`notif-btn video-toggle ${isVideoEnabled ? 'active' : ''}`}
                            onClick={() => setIsVideoEnabled(!isVideoEnabled)}
                            title={isVideoEnabled ? "Disable Camera" : "Enable Camera"}
                        >
                            {isVideoEnabled ? <Video size={18} /> : <VideoOff size={18} />}
                        </button>
                    )}

                    <button className="notif-btn accept" onClick={handleJoin}>
                        <Phone size={18} />
                        Accept
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GroupIncomingCallNotification;
