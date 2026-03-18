/**
 * useSessionManager.js
 *
 * Hook that manages the session lifecycle inside AuthenticatedApp.
 * Responsibilities:
 *   1. Initialize session record on mount
 *   2. Start heartbeat (update last_active every 2 min)
 *   3. Subscribe to session revocation (remote logout)
 *   4. Cleanup on unmount
 */

import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { sessionService } from '../services/sessionService';
import { supabase } from '../config/supabase';
import useAuthStore from '../store/authStore';
import toast from 'react-hot-toast';

const useSessionManager = (userId) => {
  const navigate = useNavigate();
  const cleanupRef = useRef(null);
  const unsubRef = useRef(null);

  useEffect(() => {
    if (!userId) return;

    let isMounted = true;

    const setup = async () => {
      // 1. Register/update session
      await sessionService.initSession(userId);

      if (!isMounted) return;

      // 2. Start heartbeat
      cleanupRef.current = sessionService.startHeartbeat(userId);

      // 3. Subscribe to session revocation
      unsubRef.current = sessionService.subscribeToSessionRevocation(userId, async () => {
        if (!isMounted) return;

        // This session was revoked by another device!
        toast.error('Session ended from another device', {
          duration: 5000,
          icon: '🔒',
        });

        // Wait briefly for toast to show
        await new Promise(r => setTimeout(r, 1500));

        // Sign out
        await useAuthStore.getState().signOut();
        navigate('/login', { replace: true });
        window.location.reload(); // Ensure clean state
      });
    };

    setup();

    return () => {
      isMounted = false;
      if (cleanupRef.current) cleanupRef.current();
      if (unsubRef.current) unsubRef.current();
    };
  }, [userId, navigate]);
};

export default useSessionManager;
