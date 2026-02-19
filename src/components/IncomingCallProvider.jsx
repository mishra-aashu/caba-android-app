import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import useAuthStore from '../store/authStore';
import IncomingCall from './calls/IncomingCall';

const IncomingCallContext = createContext();

export const IncomingCallProvider = ({ children }) => {
  const [incomingCall, setIncomingCall] = useState(null);
  const currentUser = useAuthStore((state) => state.dbUser);

  useEffect(() => {
    if (currentUser) {
      setupIncomingCallListener();
    }
  }, [currentUser]);

  const setupIncomingCallListener = () => {
    if (!currentUser) return;

    const channel = supabase
      .channel('global-incoming-calls')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'call_history',
          filter: `receiver_id=eq.${currentUser.id}`
        },
        (payload) => {
          const call = payload.new;
          if (call.call_status === 'initiated' && !incomingCall) {
            console.log('📞 Incoming call detected:', call);
            setIncomingCall(call);
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Global incoming call listener:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleAcceptCall = async (callData) => {
    setIncomingCall(null);
    // Navigate to calls page with call data
    const callInfo = {
      contact: { id: callData.caller_id, name: 'Caller' },
      type: callData.call_type,
      incoming: true,
      callId: callData.call_id,
      roomId: callData.call_id
    };
    localStorage.setItem('pendingIncomingCall', JSON.stringify(callInfo));
    window.location.href = '/#/calls';
  };

  const handleRejectCall = async (callId) => {
    try {
      await supabase
        .from('call_history')
        .update({ call_status: 'rejected', ended_at: new Date().toISOString() })
        .eq('call_id', callId);

      // Send hangup signal if needed
      console.log('📵 Call rejected');
    } catch (error) {
      console.error('Reject call error:', error);
    }
    setIncomingCall(null);
  };

  const value = {
    incomingCall,
    setIncomingCall,
    handleAcceptCall,
    handleRejectCall
  };

  return (
    <IncomingCallContext.Provider value={value}>
      {children}
      {incomingCall && (
        <IncomingCall
          callData={incomingCall}
          onAccept={handleAcceptCall}
          onReject={handleRejectCall}
          onClose={() => setIncomingCall(null)}
        />
      )}
    </IncomingCallContext.Provider>
  );
};

export const useIncomingCall = () => {
  const context = useContext(IncomingCallContext);
  if (!context) {
    throw new Error('useIncomingCall must be used within an IncomingCallProvider');
  }
  return context;
};