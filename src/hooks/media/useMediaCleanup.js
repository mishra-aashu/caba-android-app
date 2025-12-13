import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../../utils/supabase';

/**
 * React hook for media cleanup functionality
 * Adapted from media-cleanup.js
 */
export const useMediaCleanup = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [lastCleanup, setLastCleanup] = useState(null);
  const [cleanupStats, setCleanupStats] = useState({
    expiredTransfers: 0,
    oldSignals: 0,
    offlineUsers: 0
  });

  /**
   * Start automatic cleanup
   */
  const startCleanup = useCallback(() => {
    console.log('🧹 Starting media cleanup service...');
    setIsRunning(true);
    runCleanup();
  }, []);

  /**
   * Stop automatic cleanup
   */
  const stopCleanup = useCallback(() => {
    setIsRunning(false);
    console.log('🛑 Media cleanup service stopped');
  }, []);

  /**
   * Run cleanup process
   */
  const runCleanup = useCallback(async () => {
    try {
      console.log('🧹 Running cleanup...');

      // 1. Cleanup expired transfers (DB + Storage)
      const expiredCount = await cleanupExpiredTransfers();

      // 2. Cleanup old WebRTC signals
      const signalsCount = await cleanupOldSignals();

      // 3. Mark inactive users offline
      const offlineCount = await markInactiveUsersOffline();

      const stats = {
        expiredTransfers: expiredCount,
        oldSignals: signalsCount,
        offlineUsers: offlineCount
      };

      setCleanupStats(stats);
      setLastCleanup(new Date());

      console.log(`✅ Cleanup complete: ${expiredCount} transfers, ${signalsCount} signals, ${offlineCount} users marked offline`);

    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }, []);

  /**
   * Cleanup expired transfers
   */
  const cleanupExpiredTransfers = useCallback(async () => {
    try {
      // Call database function
      const { data, error } = await supabase.rpc('cleanup_expired_transfers');

      if (error) {
        console.error('Cleanup expired transfers error:', error);
        return 0;
      }

      if (data > 0) {
        console.log(`🗑️ Deleted ${data} expired transfers`);
      }

      return data || 0;

    } catch (error) {
      console.error('Cleanup transfers error:', error);
      return 0;
    }
  }, []);

  /**
   * Cleanup old WebRTC signals
   */
  const cleanupOldSignals = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('cleanup_old_signals');

      if (error) {
        console.error('Cleanup signals error:', error);
        return 0;
      }

      if (data > 0) {
        console.log(`🗑️ Deleted ${data} old signals`);
      }

      return data || 0;

    } catch (error) {
      console.error('Cleanup signals error:', error);
      return 0;
    }
  }, []);

  /**
   * Mark inactive users as offline
   */
  const markInactiveUsersOffline = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('mark_inactive_users_offline');

      if (error) {
        console.error('Mark offline error:', error);
        return 0;
      }

      return data || 0;

    } catch (error) {
      console.error('Mark offline error:', error);
      return 0;
    }
  }, []);

  /**
   * Manual cleanup of specific transfer
   */
  const cleanupTransfer = useCallback(async (transferId) => {
    try {
      // Get transfer info
      const { data: transfer, error } = await supabase
        .from('media_transfers')
        .select('*')
        .eq('id', transferId)
        .single();

      if (error || !transfer) {
        console.warn('Transfer not found:', transferId);
        return;
      }

      // Delete from storage if exists
      if (transfer.storage_path) {
        const { error: storageError } = await supabase.storage
          .from('media')
          .remove([transfer.storage_path]);

        if (storageError) {
          console.error('Storage delete error:', storageError);
        }
      }

      // Mark as deleted in DB
      await supabase
        .from('media_transfers')
        .update({
          deleted_at: new Date().toISOString(),
          status: 'expired'
        })
        .eq('id', transferId);

      console.log('🗑️ Transfer cleaned up:', transferId);

    } catch (error) {
      console.error('Manual cleanup error:', error);
    }
  }, []);

  // Auto-start cleanup on mount if enabled
  useEffect(() => {
    if (isRunning) {
      const interval = setInterval(runCleanup, 5 * 60 * 1000); // 5 minutes
      return () => clearInterval(interval);
    }
  }, [isRunning, runCleanup]);

  return {
    isRunning,
    lastCleanup,
    cleanupStats,
    startCleanup,
    stopCleanup,
    runCleanup,
    cleanupExpiredTransfers,
    cleanupOldSignals,
    markInactiveUsersOffline,
    cleanupTransfer
  };
};