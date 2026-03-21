import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { callService } from '../services/callService';
import { db } from '../db/db';
import { useLiveQuery } from 'dexie-react-hooks';

/**
 * Hook for fetching call history using TanStack Query + Dexie for offline
 * Provides caching, automatic refetching, and persistent offline support
 */
export function useCallHistory(userId) {
  const queryClient = useQueryClient();

  // 1. Live Query from Dexie for instant offline access
  const cachedHistory = useLiveQuery(
    () => {
      if (!userId) return [];
      return db.call_history
        .where('caller_id').equals(userId)
        .or('receiver_id').equals(userId)
        .reverse()
        .sortBy('started_at');
    },
    [userId]
  ) || [];

  // Set up real-time subscription
  useEffect(() => {
    if (!userId) return;

    console.log('🔔 Subscribing to call history for user:', userId);
    const channelName = callService.subscribeToCallHistory(userId, async (payload) => {
      console.log('🚀 Real-time call history update detected:', payload);
      
      // Update Dexie if it's a new or updated call
      if (payload.new && payload.new.id) {
        try {
          // Note: callService handles transformation (otherUserInfo) in getCallHistory.
          // For realtime, we might just trigger a refetch or do a single fetch.
          // Simplest is to invalidate and let useQuery fetch + save.
          queryClient.invalidateQueries({ queryKey: ['callHistory', userId] });
          queryClient.invalidateQueries({ queryKey: ['missedCallsCount', userId] });
        } catch (err) {
          console.warn('Realtime Dexie update failed', err);
        }
      }
    });

    return () => {
      console.log('🔕 Unsubscribing from call history:', channelName);
      callService.unsubscribe(channelName);
    };
  }, [userId, queryClient]);

  // 2. Query for call history with caching + Sync to Dexie
  const {
    isLoading,
    error,
    refetch,
    data: queryData
  } = useQuery({
    queryKey: ['callHistory', userId],
    queryFn: async () => {
      if (!userId) return { calls: [], hasMore: false };
      
      try {
        const result = await callService.getCallHistory(userId, 50, null);
        
        // Sync to Dexie
        if (result.calls?.length > 0) {
          await db.call_history.bulkPut(result.calls);
        }
        
        return result;
      } catch (err) {
        console.warn('[Sync] Call history sync failed:', err);
        // If offline, React Query will retry or use its own cache.
        // Component will use cachedHistory from useLiveQuery anyway.
        throw err;
      }
    },
    enabled: !!userId,
    staleTime: 1000 * 10, // 10 seconds
    gcTime: 1000 * 60 * 5,
  });

  // 3. Missed calls query
  const { data: missedData } = useQuery({
    queryKey: ['missedCallsCount', userId],
    queryFn: async () => {
      if (!userId) return 0;
      return await callService.getMissedCallsCount(userId);
    },
    enabled: !!userId,
  });

  return {
    // Return cachedHistory for instant UI, falling back to query results if Dexie is empty
    history: cachedHistory.length > 0 ? cachedHistory : (queryData?.calls || []),
    loading: isLoading && cachedHistory.length === 0, // Only "loading" if we have NOTHING
    error: error?.message || null,
    missedCount: missedData || 0,
    refetch,
    hasMore: queryData?.hasMore || false,
  };
}

export default useCallHistory;