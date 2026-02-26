import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../config/supabase';
import { useTheme } from '../../contexts/ThemeContext';
import { useCall } from '../../context/CallContext';
import { dpOptions } from '../../utils/dpOptions';
import { CallHistory } from '../CallHistory';
import { useDialog } from '../../contexts/DialogContext';
import { CallButton } from '../CallButton';
import { IncomingCallModal } from '../IncomingCallModal';
import BottomNavigation from '../common/BottomNavigation';
import { isUserOnline } from '../../utils/timeUtils';
import useAuthStore from '../../store/authStore';
import '../../styles/calls.css';

const Calls = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { showAlert } = useDialog();
  const { startCall, answerCall } = useCall();
  const [searchTerm, setSearchTerm] = useState('');
  const [incomingCall, setIncomingCall] = useState(null);
  const [activeCall, setActiveCall] = useState(null);
  const [callType, setCallType] = useState('video');

  // Get current user from auth store
  const authState = useAuthStore.getState();
  const { dbUser, isAuthenticated } = authState;
  const userId = dbUser?.id;

  // React Query for contacts - cached for 10 minutes
  const {
    data: contactsData,
    isLoading: contactsLoading,
    refetch: refetchContacts
  } = useQuery({
    queryKey: ['callContacts', userId],
    queryFn: async () => {
      if (!userId) return [];
      return await fetchContacts(userId);
    },
    enabled: !!userId && !!isAuthenticated,
    staleTime: 1000 * 60 * 10, // 10 minutes
    gcTime: 1000 * 60 * 60, // 1 hour
  });

  // React Query for call history - cached for 10 minutes
  const {
    data: callHistoryData,
    isLoading: historyLoading,
    refetch: refetchHistory
  } = useQuery({
    queryKey: ['callHistoryList', userId],
    queryFn: async () => {
      if (!userId) return [];
      return await fetchCallHistory(userId);
    },
    enabled: !!userId && !!isAuthenticated,
    staleTime: 1000 * 60 * 10, // 10 minutes
    gcTime: 1000 * 60 * 60, // 1 hour
  });

  // Helper function to fetch contacts
  const fetchContacts = async (userId) => {
    try {
      // Load contacts with explicit user fetching to handle data type issues
      const { data: contactsList, error: contactsError } = await supabase
        .from('contacts')
        .select('contact_user_id, contact_name')
        .eq('user_id', userId);

      if (contactsError) throw contactsError;

      let contactsData = [];
      if (contactsList && contactsList.length > 0) {
        // Fetch user details for each contact
        const userIds = contactsList.map(c => c.contact_user_id).filter(id => id);
        if (userIds.length > 0) {
          const { data: users, error: usersError } = await supabase
            .from('users')
            .select('*')
            .in('id', userIds);

          if (!usersError && users) {
            contactsData = users.map(u => {
              const contact = contactsList.find(c => c.contact_user_id === u.id);
              return { ...u, contact_name: contact?.contact_name };
            });
          }
        }
      }

      // Also load from chats
      const { data: chats } = await supabase
        .from('chats')
        .select(`
          user1:users!chats_user1_id_fkey(*),
          user2:users!chats_user2_id_fkey(*)
        `)
        .or(`user1_id.eq.${userId},user2_id.eq.${userId}`);

      if (chats) {
        chats.forEach(chat => {
          const otherUser = chat.user1.id === userId ? chat.user2 : chat.user1;
          if (otherUser && otherUser.id && !contactsData.find(c => c.id === otherUser.id)) {
            contactsData.push(otherUser);
          }
        });
      }

      return contactsData;
    } catch (error) {
      console.error('Error loading contacts:', error);
      return [];
    }
  };

  // Helper function to fetch call history
  const fetchCallHistory = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('call_history')
        .select(`
          *,
          caller:users!call_history_caller_id_fkey(name, avatar),
          receiver:users!call_history_receiver_id_fkey(name, avatar)
        `)
        .or(`caller_id.eq.${userId},receiver_id.eq.${userId}`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const historyData = data.map(call => ({
        ...call,
        otherUser: call.caller_id === userId ? call.receiver : call.caller
      })).filter(call => call.otherUser && call.otherUser.id); // Filter out calls with invalid otherUser

      return historyData;
    } catch (error) {
      console.error('Error loading call history:', error);
      return [];
    }
  };

  const contacts = contactsData || [];
  const callHistory = callHistoryData || [];
  const loading = contactsLoading || historyLoading || !isAuthenticated;

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

  const filteredContacts = contacts.filter(contact => {
    // First ensure contact has valid ID
    if (!contact || !contact.id) return false;

    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (contact.contact_name || contact.name).toLowerCase().includes(search) ||
      (contact.phone && contact.phone.includes(search));
  });

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
    // Refetch call history
    refetchHistory();
  };

  const getInitials = (name) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatCallTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="calls-loading">
        <div className="loading-spinner"></div>
        <p>Loading contacts...</p>
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

        {/* Search */}
        <div className="search-container">
          <div className="search-box">
            <i className="fas fa-search"></i>
            <input
              type="text"
              placeholder="Search contacts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

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
