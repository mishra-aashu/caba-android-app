import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { callService } from '../services/callService';

/**
 * Hook for fetching call history using TanStack Query
 * Provides caching, automatic refetching, and offline support
 */
export function useCallHistory(userId) {
  const queryClient = useQueryClient();

  // Set up real-time subscription
  useEffect(() => {
    if (!userId) return;

    console.log('🔔 Subscribing to call history for user:', userId);
    const channelName = callService.subscribeToCallHistory(userId, (payload) => {
      console.log('🚀 Real-time call history update detected:', payload);
      // Invalidate queries to trigger refetch
      queryClient.invalidateQueries({ queryKey: ['callHistory', userId] });
      queryClient.invalidateQueries({ queryKey: ['missedCallsCount', userId] });
    });

    return () => {
      console.log('🔕 Unsubscribing from call history:', channelName);
      callService.unsubscribe(channelName);
    };
  }, [userId, queryClient]);

  // Query for call history with caching
  const {
    data: historyData,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['callHistory', userId],
    queryFn: async () => {
      if (!userId) return { calls: [], hasMore: false };
      const result = await callService.getCallHistory(userId, 20, null);
      return result;
    },
    enabled: !!userId,
    staleTime: 1000 * 5, // Reduced staleTime to 5 seconds for better reactivity
    gcTime: 1000 * 60 * 5, // 5 minutes - keep in cache
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  // Separate query for missed calls count
  const {
    data: missedData,
  } = useQuery({
    queryKey: ['missedCallsCount', userId],
    queryFn: async () => {
      if (!userId) return 0;
      return await callService.getMissedCallsCount(userId);
    },
    enabled: !!userId,
    staleTime: 1000 * 30, // 30 seconds
    gcTime: 1000 * 60 * 2, // 2 minutes
  });

  return {
    history: historyData?.calls || [],
    loading: isLoading,
    error: error?.message || null,
    missedCount: missedData || 0,
    refetch,
    hasMore: historyData?.hasMore || false,
  };
}

export default useCallHistory;