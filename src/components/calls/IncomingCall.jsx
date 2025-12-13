import React, { useState, useEffect } from 'react';
import { supabase, getValidAvatarUrl } from '../../utils/supabase';

const IncomingCall = ({ callData, onAccept, onReject, onClose }) => {
  const [caller, setCaller] = useState(null);
  const [ringing, setRinging] = useState(true);

  useEffect(() => {
    loadCallerInfo();
  }, []);

  const loadCallerInfo = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', callData.caller_id)
        .single();

      if (error) throw error;
      setCaller(data);
    } catch (error) {
      console.error('Error loading caller info:', error);
    }
  };

  const handleAccept = () => {
    setRinging(false);
    onAccept(callData);
  };

  const handleReject = () => {
    setRinging(false);
    onReject(callData.id);
  };

  if (!caller) {
    return (
      <div className="incoming-call-overlay">
        <div className="incoming-call">
          <p>Loading caller info...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="incoming-call-overlay">
      <div className="incoming-call">
        <div className="caller-info">
          <div className="caller-avatar">
            <div className="avatar-circle-large">
              {getValidAvatarUrl(caller.avatar) ? (
                <img src={getValidAvatarUrl(caller.avatar)} alt={caller.name} />
              ) : (
                caller.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
              )}
            </div>
          </div>
          <h3>{caller.name}</h3>
          <p className="call-type">
            {callData.call_type === 'video' ? '📹 Video call' : '📞 Voice call'}
          </p>
          <p className="ringing-text">is calling...</p>
        </div>

        <div className="call-actions">
          <button
            className="reject-btn"
            onClick={handleReject}
            disabled={!ringing}
          >
            <i className="fas fa-phone-slash"></i>
            <span>Decline</span>
          </button>

          <button
            className="accept-btn"
            onClick={handleAccept}
            disabled={!ringing}
          >
            <i className="fas fa-phone"></i>
            <span>Accept</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default IncomingCall;