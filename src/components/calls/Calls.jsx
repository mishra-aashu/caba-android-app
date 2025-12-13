import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../utils/supabase';
import { useTheme } from '../../contexts/ThemeContext';
import { useCall } from '../../context/CallContext';
import { dpOptions } from '../../utils/dpOptions';
import { CallHistory } from '../CallHistory';
import { CallButton } from '../CallButton';
import { IncomingCallModal } from '../IncomingCallModal';
import BottomNavigation from '../common/BottomNavigation';
import '../../styles/calls.css';
import '../../styles/calls-improved.css';

const Calls = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { startCall, answerCall } = useCall();
  const [currentUser, setCurrentUser] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [callHistory, setCallHistory] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [incomingCall, setIncomingCall] = useState(null);

  useEffect(() => {
    initializeCalls();
    checkPendingCall();
  }, []);

  // Note: Incoming call listener is now global in SupabaseContext

  const initializeCalls = async () => {
    try {
      const userStr = localStorage.getItem('currentUser');
      if (!userStr) {
        alert('No user logged in');
        setLoading(false);
        return;
      }
      const user = JSON.parse(userStr);

      // Add default DP if user doesn't have one - use same logic as Home component

      // Handle DP assignment same as Home component
      if (!user.avatar) {
        // Assign a random DP ID (1-46)
        user.avatar = Math.floor(Math.random() * 46) + 1;
      } else if (typeof user.avatar === 'string' && !user.avatar.startsWith('http')) {
        // If avatar is a string but not a URL, try to parse as number
        const avatarId = parseInt(user.avatar);
        if (isNaN(avatarId)) {
          user.avatar = Math.floor(Math.random() * 46) + 1;
        }
      }

      setCurrentUser(user);

      await Promise.all([
        loadContacts(user),
        loadCallHistory(user)
      ]);
      setLoading(false);
    } catch (error) {
      console.error('Error initializing calls:', error);
      setLoading(false);
    }
  };

  const loadContacts = async (user) => {
    try {
      // Load contacts with explicit user fetching to handle data type issues
      const { data: contactsList, error: contactsError } = await supabase
        .from('contacts')
        .select('contact_user_id')
        .eq('user_id', user.id);

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
            contactsData = users;
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
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);

      if (chats) {
        chats.forEach(chat => {
          const otherUser = chat.user1.id === user.id ? chat.user2 : chat.user1;
          if (otherUser && otherUser.id && !contactsData.find(c => c.id === otherUser.id)) {
            contactsData.push(otherUser);
          }
        });
      }

      setContacts(contactsData);
    } catch (error) {
      console.error('Error loading contacts:', error);
    }
  };

  const loadCallHistory = async (user) => {
    try {
      const { data, error } = await supabase
        .from('call_history')
        .select(`
          *,
          caller:users!call_history_caller_id_fkey(name, avatar),
          receiver:users!call_history_receiver_id_fkey(name, avatar)
        `)
        .or(`caller_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const historyData = data.map(call => ({
        ...call,
        otherUser: call.caller_id === user.id ? call.receiver : call.caller
      })).filter(call => call.otherUser && call.otherUser.id); // Filter out calls with invalid otherUser

      setCallHistory(historyData);
    } catch (error) {
      console.error('Error loading call history:', error);
    }
  };

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

  const filteredContacts = contacts.filter(contact => {
    // First ensure contact has valid ID
    if (!contact || !contact.id) return false;

    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return contact.name.toLowerCase().includes(search) ||
            (contact.phone && contact.phone.includes(search));
  });

  const handleCall = async (contact, type = 'video') => {
    console.log('handleCall called with contact:', contact, 'type:', type);
    if (!contact) {
      console.error('handleCall: contact is null/undefined');
      alert('Invalid contact: contact not found');
      return;
    }
    if (!contact.id) {
      console.error('handleCall: contact.id is null/undefined', contact);
      alert('Invalid contact: contact ID missing');
      return;
    }
    console.log('handleCall: validation passed, proceeding with call');
    setCallType(type);
    try {
      await startCall(contact.id, type);
    } catch (error) {
      console.error('Error starting call:', error);
      alert('Failed to start call: ' + error.message);
    }
  };

  const handleAcceptCall = async (callData) => {
    try {
      setIncomingCall(null);
      await answerCall();
      navigate(`/call/${callData.call_id}`);
    } catch (error) {
      console.error('Error accepting call:', error);
      alert('Failed to accept call: ' + error.message);
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
    // Reload call history
    if (currentUser) {
      loadCallHistory(currentUser);
    }
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
            {/* Empty for balance */}
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

        {/* Call History */}
        <div className="call-history-section">
          <CallHistory
            userId={currentUser?.id}
            userAvatar={currentUser?.avatar}
            userName={currentUser?.name}
          />
        </div>

        {/* Contacts List */}
        <div className="contacts-section">
          <h3>Contacts</h3>
          <div className="contacts-list">
            {filteredContacts.length > 0 ? (
              filteredContacts.map(contact => (
                <div key={contact.id} className="contact-item">
                  <div className="contact-avatar">
                    <div className="avatar-circle">
                      {contact.avatar ? (
                        parseInt(contact.avatar) ? (
                          <img src={dpOptions.find(dp => dp.id === parseInt(contact.avatar))?.path || contact.avatar} alt={contact.name} />
                        ) : (
                          <img src={contact.avatar} alt={contact.name} />
                        )
                      ) : (
                        getInitials(contact.name)
                      )}
                    </div>
                    <span className={`online-status ${contact.is_online ? 'online' : ''}`}></span>
                  </div>
                  <div className="contact-info">
                    <h4>{contact.name}</h4>
                    <p>{contact.phone || 'No phone'}</p>
                  </div>
                  <div className="call-buttons">
                    <CallButton
                      receiverId={contact.id}
                      callType="voice"
                      size="md"
                    />
                    <CallButton
                      receiverId={contact.id}
                      callType="video"
                      size="md"
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <i className="fas fa-user-slash"></i>
                <h3>No contacts found</h3>
                <p>Add contacts to start making calls</p>
              </div>
            )}
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