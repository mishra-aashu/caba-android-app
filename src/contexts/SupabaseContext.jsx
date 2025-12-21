import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../config/supabase.js';
import IncomingCall from '../components/calls/IncomingCall';
import ConnectionToast from '../components/common/ConnectionToast';
import useAutoReconnect from '../hooks/useAutoReconnect';

const SupabaseContext = createContext(); 

export const SupabaseProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null);
  const [incomingCallChannel, setIncomingCallChannel] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [showConnectionToast, setShowConnectionToast] = useState(false);
  const [lastResumeAt, setLastResumeAt] = useState(null);

  // Use auto reconnect hook with callback to resubscribe channels
  useAutoReconnect(() => {
    if (user && !incomingCallChannel) {
      setupGlobalIncomingCallListener();
    }
  });

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        console.error('Error getting session:', error);
      } else {
        setSession(session);
        setUser(session?.user ?? null);
      }
      setLoading(false);
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session);
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // Update localStorage for compatibility with existing code
        if (session?.user) {
          const userData = {
            id: session.user.id,
            name: session.user.user_metadata?.name || 'User',
            email: session.user.email,
            phone: session.user.user_metadata?.phone || '',
            avatar: session.user.user_metadata?.avatar || null
          };
          localStorage.setItem('currentUser', JSON.stringify(userData));
          localStorage.setItem('authType', 'google');
        } else {
          localStorage.removeItem('currentUser');
          localStorage.removeItem('authType');
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Listen for localStorage changes to sync auth state
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'currentUser' || e.key === 'authType') {
        // Trigger a re-check of auth state
        const currentUser = localStorage.getItem('currentUser');
        if (currentUser) {
          try {
            const userData = JSON.parse(currentUser);
            setUser(userData);
            setIsAuthenticated(true);
          } catch (error) {
            console.error('Error parsing user data:', error);
            setUser(null);
            setIsAuthenticated(false);
          }
        } else {
          setUser(null);
          setIsAuthenticated(false);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Setup global incoming call listener
  useEffect(() => {
    if (user && !incomingCallChannel) {
      setupGlobalIncomingCallListener();
    }

    return () => {
      if (incomingCallChannel) {
        supabase.removeChannel(incomingCallChannel);
        setIncomingCallChannel(null);
      }
    };
  }, [user]);

  const setupGlobalIncomingCallListener = () => {
    console.log('📡 Setting up global incoming call listener for user:', user.id);

    const channel = supabase
      .channel('global-incoming-calls')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'call_history',
          filter: `receiver_id=eq.${user.id}`
        },
        (payload) => {
          console.log('📞 Global incoming call event received:', payload);
          const call = payload.new;
          console.log('📞 Call data:', call);
          if (call.call_status === 'initiated') {
            console.log('📞 Showing global incoming call popup for call:', call.id);
            setIncomingCall(call);
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Global incoming call listener status:', status);
        if (status === 'SUBSCRIBED') {
          setIncomingCallChannel(channel);
        }
      });
  };

  const handleAcceptCall = async (callData) => {
    console.log('📞 Accepting call:', callData.id);
    setIncomingCall(null);

    // Navigate to calls page with call data
    window.location.href = `#/calls?incoming=true&callId=${callData.call_id}&roomId=${callData.call_id}&callType=${callData.call_type}`;
  };

  const handleRejectCall = async (callId) => {
    console.log('📞 Rejecting call:', callId);
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

  const validateSessionAndRefresh = async () => {
    console.log('Starting validateSessionAndRefresh');
    if (isConnecting) {
      console.log('Already connecting, skipping');
      return;
    }
    setIsConnecting(true);
    try {
      const { data: { session: currentSession }, error } = await supabase.auth.getSession();
      if (error) {
        console.warn('Session check error:', error);
      }
      let activeSession = currentSession;
      console.log('Current session:', !!activeSession);
      console.log('Refreshing session on resume...');
      try {
        const { data, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
          console.error('Refresh session error:', refreshError);
        } else {
          activeSession = data?.session || activeSession;
          console.log('Session refreshed');
        }
      } catch (e) {
        console.error('Refresh session exception:', e);
      }
      console.log('Disconnecting realtime...');
      try { await supabase.realtime.disconnect(); } catch (e) { console.log('Disconnect error:', e); }
      console.log('Connecting realtime...');
      try { await supabase.realtime.connect(); console.log('Realtime connected successfully'); } catch (e) { console.log('Connect error:', e); }
      try {
        const channels = supabase.getChannels ? supabase.getChannels() : [];
        console.log('Re-subscribing channels:', channels.length);
        channels.forEach((ch) => {
          try { ch.subscribe(); console.log('Re-subscribed channel:', ch.topic); } catch (e) { console.log('Subscribe error:', e); }
        });
      } catch (e) { console.log('Get channels error:', e); }
      setLastResumeAt(Date.now());
      console.log('validateSessionAndRefresh completed');
    } finally {
      setIsConnecting(false);
    }
  };

  const ensureConnected = () => {
    if (isConnecting) {
      setShowConnectionToast(true);
      setTimeout(() => setShowConnectionToast(false), 1500);
      return false;
    }
    return true;
  };

  const value = {
    supabase,
    user,
    session,
    loading,
    signOut: () => supabase.auth.signOut(),
    isConnecting,
    lastResumeAt,
    validateSessionAndRefresh,
    ensureConnected,
  };

  return (
    <SupabaseContext.Provider value={value}>
      {children}

      {(isConnecting || showConnectionToast) && (
        <ConnectionToast text="Connecting..." />
      )}

      {/* Global Incoming Call Overlay */}
      {incomingCall && (
        <IncomingCall
          callData={incomingCall}
          onAccept={handleAcceptCall}
          onReject={handleRejectCall}
          onClose={() => setIncomingCall(null)}
        />
      )}
    </SupabaseContext.Provider>
  );
};

export const useSupabase = () => {
  const context = useContext(SupabaseContext);
  if (!context) {
    throw new Error('useSupabase must be used within a SupabaseProvider');
  }
  return context;
};

export default SupabaseContext;
