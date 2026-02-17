import { useQuery } from '@tanstack/react-query';
import { callService } from '../services/callService';

/**
 * Hook for fetching call history using TanStack Query
 * Provides caching, automatic refetching, and offline support
 */
export function useCallHistory(userId) {
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
    staleTime: 1000 * 60 * 2, // 2 minutes - data stays fresh
    gcTime: 1000 * 60 * 30, // 30 minutes - keep in cache
    refetchOnWindowFocus: false,
    refetchOnMount: false,
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
    staleTime: 1000 * 60 * 1, // 1 minute
    gcTime: 1000 * 60 * 10, // 10 minutes
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