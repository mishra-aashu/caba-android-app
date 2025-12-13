import { useState, useEffect, useCallback } from 'react';
import { callService } from '../services/callService';

export function useCallHistory(userId) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [missedCount, setMissedCount] = useState(0);

  const fetchHistory = useCallback(async () => {
    if (!userId) return;

    try {
      setLoading(true);
      const data = await callService.getCallHistory(userId);
      setHistory(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const fetchMissedCount = useCallback(async () => {
    if (!userId) return;

    try {
      const count = await callService.getMissedCallsCount(userId);
      setMissedCount(count || 0);
    } catch (err) {
      console.error('Error fetching missed count:', err);
    }
  }, [userId]);

  useEffect(() => {
    fetchHistory();
    fetchMissedCount();
  }, [fetchHistory, fetchMissedCount]);

  return {
    history,
    loading,
    error,
    missedCount,
    refetch: fetchHistory
  };
}

export default useCallHistory;