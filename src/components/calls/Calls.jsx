import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../config/supabase';
import { useTheme } from '../../contexts/ThemeContext';
import { useCall } from '../../contexts/CallContext';
import { dpOptions } from '../../utils/dpOptions';
import { CallHistory } from '../CallHistory';
import { useDialog } from '../../contexts/DialogContext';
import { CallButton } from '../CallButton';
import { IncomingCallModal } from '../IncomingCallModal';
import BottomNavigation from '../common/BottomNavigation';
import { isUserOnline } from '../../utils/dateFormatter';
import useAuthStore from '../../store/authStore';
import '../../styles/calls.css';

const Calls = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { showAlert } = useDialog();
  const { startCall, answerCall } = useCall();
  // Removed unused state
  const [incomingCall, setIncomingCall] = useState(null);
  const [activeCall, setActiveCall] = useState(null);
  const [callType, setCallType] = useState('video');
  const queryClient = useQueryClient();

  // Get current user from auth store reactively
  const { dbUser, isAuthenticated } = useAuthStore();
  const userId = dbUser?.id;

  // Unused queries removed to prevent double requests
  // Data is now handled by the child CallHistory component

  // Unused helper functions removed

  const loading = !isAuthenticated;

  useEffect(() => {
    checkPendingCall();
  }, []);

  // Note: Incoming call listener is now global in SupabaseContext



  const checkPendingCall = async () => {
    // Check for regular pending calls
    const pendingCallStr = localStorage.getItem('pendingCall');
    if (pendingCallStr) {
      try {
        const pendingCall = JSON.parse(pendingCallStr);
        localStorage.removeItem('pendingCall');
        await startCall(pendingCall.contact.id, pendingCall.type);
      } catch (error) {
        console.error('Error parsing pending call:', error);
      }
    }

    // Check for incoming calls from global handler
    const pendingIncomingCallStr = localStorage.getItem('pendingIncomingCall');
    if (pendingIncomingCallStr) {
      try {
        const callInfo = JSON.parse(pendingIncomingCallStr);
        localStorage.removeItem('pendingIncomingCall');
        setActiveCall(callInfo);
      } catch (error) {
        console.error('Error parsing pending incoming call:', error);
      }
    }
  };

  // Incoming call listener moved to global SupabaseContext

  // Incoming call listener moved to global SupabaseContext

  // Removed unused filteredContacts

  const handleCall = async (contact, type = 'video') => {
    console.log('handleCall called with contact:', contact, 'type:', type);
    if (!contact) {
      console.error('handleCall: contact is null/undefined');
      showAlert('Invalid contact: contact not found');
      return;
    }
    if (!contact.id) {
      console.error('handleCall: contact.id is null/undefined', contact);
      showAlert('Invalid contact: contact ID missing');
      return;
    }
    console.log('handleCall: validation passed, proceeding with call');
    setCallType(type);
    try {
      await startCall(contact.id, type);
    } catch (error) {
      console.error('Error starting call:', error);
      showAlert('Failed to start call: ' + error.message);
    }
  };

  const handleAcceptCall = async (callData) => {
    try {
      setIncomingCall(null);
      await answerCall();
      navigate(`/call/${callData.call_id}`);
    } catch (error) {
      console.error('Error accepting call:', error);
      showAlert('Failed to accept call: ' + error.message);
    }
  };

  const handleRejectCall = async (callId) => {
    try {
      if (window.WebRTCCall) {
        const callInstance = new window.WebRTCCall();
        await callInstance.rejectCall(callId);
      }
    } catch (error) {
      console.error('Error rejecting call:', error);
    }
    setIncomingCall(null);
  };

  const handleCallEnd = () => {
    setActiveCall(null);
    // Invalidate queries to refetch fresh data
    queryClient.invalidateQueries({ queryKey: ['callHistory', userId] });
    queryClient.invalidateQueries({ queryKey: ['missedCallsCount', userId] });
  };

  const getInitials = (name) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Removed unused formatCallTime

  if (loading) {
    return (
      <div className="calls-loading">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <>
      <div className="calls-container">
        <header className="app-header">
          <div className="header-left">
            <button className="back-btn" onClick={() => window.history.back()}>
              <i className="fas fa-arrow-left"></i>
            </button>
          </div>
          <div className="header-center">
            <h1>Calls</h1>
          </div>
          <div className="header-right">
            {activeCall && (
              <div className="header-call-notification" title="Click to view active call">
                <div className="call-info">
                  <svg className="call-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5"></path>
                    <rect x="2" y="6" width="14" height="12" rx="2"></rect>
                  </svg>
                  <span className="call-text">On Call</span>
                </div>
                <span className="caller-name">{activeCall.caller_name || 'Unknown'}</span>
                <button className="end-call-btn" title="End Call" onClick={handleCallEnd}>
                  <svg className="end-call-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M10.1 13.9a14 14 0 0 0 3.732 2.668 1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2 18 18 0 0 1-12.728-5.272"></path>
                    <path d="M22 2 2 22"></path>
                    <path d="M4.76 13.582A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 .244.473"></path>
                  </svg>
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Search functionality removed as it was disconnected and causing issues */}

        {/* Scrollable Content: Call History */}
        <div className="calls-scroll-area" style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <div className="call-history-section">
            <CallHistory
              userId={dbUser?.id}
              userAvatar={dbUser?.avatar}
              userName={dbUser?.name}
            />
          </div>
        </div>
      </div>


      {/* Incoming Call Modal */}
      <IncomingCallModal />

      {/* Bottom Navigation */}
      <BottomNavigation />
    </>
  );
};

export default Calls;
