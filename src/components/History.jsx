import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useCall } from '../context/CallContext';
import { dpOptions } from '../utils/dpOptions';
import { Phone, PhoneIncoming, PhoneMissed, PhoneOutgoing, Video, ArrowLeft } from 'lucide-react';
import { callService } from '../services/callService';
import BottomNavigation from './common/BottomNavigation';
import { isUserOnline } from '../utils/timeUtils';
import useAuthStore from '../store/authStore';
import '../styles/calls.css';
import '../styles/history.css';

const History = () => {
  const navigate = useNavigate();
  const { startCall, callState } = useCall();

  // Get current user from auth store
  const authState = useAuthStore.getState();
  const { dbUser, isAuthenticated } = authState;
  const userId = dbUser?.id;

  // React Query for call history - cached for 10 minutes
  const {
    data: queryData,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['callHistory', userId],
    queryFn: async () => {
      if (!userId || !isAuthenticated) {
        return { calls: [], hasMore: false, lastCallId: null };
      }
      const result = await callService.getCallHistory(userId, 20, null);
      return result;
    },
    enabled: !!userId && !!isAuthenticated,
    staleTime: 1000 * 60 * 10, // 10 minutes - keep this specific list fresh for 10 mins
    gcTime: 1000 * 60 * 60, // 1 hour - keep in cache for 1 hour
  });

  // Local state for grouped history and pagination
  const [history, setHistory] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [lastCallId, setLastCallId] = useState(null);
  const [loadingLocked, setLoadingLocked] = useState(false);
  const loaderRef = useRef(null);

  // Update history when query data changes
  useEffect(() => {
    if (queryData?.calls) {
      const groupedCalls = groupCallsByUser(queryData.calls);
      setHistory(groupedCalls);
      setHasMore(queryData.hasMore || false);
      setLastCallId(queryData.lastCallId);
    }
  }, [queryData]);

  // Set current user when available
  useEffect(() => {
    if (dbUser && isAuthenticated) {
      setCurrentUser(dbUser);
    }
  }, [dbUser, isAuthenticated]);

  // Infinite scroll with IntersectionObserver - with lock to prevent rapid fires
  useEffect(() => {
    if (!hasMore || isLoadingMore || !currentUser || loadingLocked) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore && !loadingLocked) {
          loadMoreCalls();
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    );

    if (loaderRef.current) {
      observer.observe(loaderRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, currentUser, lastCallId]);

  const loadCallHistory = async (userId) => {
    try {
      console.log('Loading call history for user:', userId);

      // Load user-specific history with pagination (20 at a time) - SERVER SIDE
      const result = await callService.getCallHistory(userId, 20, null);
      console.log('Call history data for user:', result.calls);

      // Group calls by other_user_id to show count
      const groupedCalls = groupCallsByUser(result.calls);
      console.log('Grouped calls:', groupedCalls);

      setHistory(groupedCalls);
      setHasMore(result.hasMore);
      setLastCallId(result.lastCallId);
    } catch (err) {
      console.error('Error loading call history:', err);
    }
  };

  // WhatsApp-style grouping: Today, Yesterday, This Week, This Year, Last Year
  const getWhatsAppGroupKey = (date) => {
    const now = new Date();
    const callDate = new Date(date);
    const diffTime = now - callDate;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `week_${callDate.getDay()}`; // Same day of week
    if (callDate.getFullYear() === now.getFullYear()) return `year_${callDate.getMonth()}_${callDate.getDate()}`; // Same date this year
    return `year_${callDate.getFullYear()}_${callDate.getMonth()}_${callDate.getDate()}`; // Different year
  };

  const formatWhatsAppGroup = (date) => {
    const now = new Date();
    const callDate = new Date(date);
    const diffTime = now - callDate;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return callDate.toLocaleDateString('en', { weekday: 'long' }); // Monday, Tuesday
    if (callDate.getFullYear() === now.getFullYear()) return callDate.toLocaleDateString('en', { month: 'short', day: 'numeric' }); // Dec 28
    return callDate.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' }); // Dec 28 2024
  };

  // Group calls by user + WhatsApp-style time period
  const groupCallsByUser = (calls) => {
    const grouped = {};

    calls.forEach(call => {
      const otherUserId = call.other_user_id;
      const groupKey = getWhatsAppGroupKey(call.started_at);
      const compositeKey = `${otherUserId}_${groupKey}`;

      if (!grouped[compositeKey]) {
        grouped[compositeKey] = {
          ...call,
          callCount: 1,
          groupLabel: formatWhatsAppGroup(call.started_at)
        };
      } else {
        grouped[compositeKey].callCount += 1;
        if (new Date(call.started_at) > new Date(grouped[compositeKey].started_at)) {
          grouped[compositeKey].started_at = call.started_at;
          grouped[compositeKey].id = call.id;
        }
      }
    });

    return Object.values(grouped).sort((a, b) => {
      const dateA = a.started_at ? new Date(a.started_at).getTime() : 0;
      const dateB = b.started_at ? new Date(b.started_at).getTime() : 0;
      return dateB - dateA; // Newest first
    });
  };

  const loadMoreCalls = async () => {
    if (!currentUser || isLoadingMore || !hasMore || loadingLocked) return;

    console.log('Loading more calls, current history count:', history.length);

    // Lock to prevent rapid multiple loads
    setLoadingLocked(true);
    setIsLoadingMore(true);

    try {
      const result = await callService.getCallHistory(currentUser.id, 20, lastCallId);
      console.log('Loaded more calls:', result.calls.length, 'hasMore:', result.hasMore);

      if (!result.calls || result.calls.length === 0) {
        setHasMore(false);
        return;
      }

      // Group new calls by user
      const groupedNewCalls = groupCallsByUser(result.calls);
      console.log('Grouped new calls:', groupedNewCalls.length);

      // Merge with existing grouped calls - use WhatsApp-style grouping
      setHistory(prev => {
        const mergedMap = new Map();

        // Add existing entries
        prev.forEach(call => {
          const groupKey = `${call.other_user_id}_${getWhatsAppGroupKey(call.started_at)}`;
          mergedMap.set(groupKey, call);
        });

        // Update or add new calls
        groupedNewCalls.forEach(newCall => {
          const groupKey = `${newCall.other_user_id}_${getWhatsAppGroupKey(newCall.started_at)}`;
          if (mergedMap.has(groupKey)) {
            const existing = mergedMap.get(groupKey);
            existing.callCount += newCall.callCount;
            if (new Date(newCall.started_at) > new Date(existing.started_at)) {
              existing.started_at = newCall.started_at;
              existing.id = newCall.id;
            }
          } else {
            mergedMap.set(groupKey, newCall);
          }
        });

        const merged = Array.from(mergedMap.values());
        return merged.sort((a, b) => {
          const dateA = a.started_at ? new Date(a.started_at).getTime() : 0;
          const dateB = b.started_at ? new Date(b.started_at).getTime() : 0;
          return dateB - dateA; // Newest first
        });
      });

      setHasMore(result.hasMore);
      setLastCallId(result.lastCallId);
      console.log('History after merge:', history.length);
    } catch (err) {
      console.error('Error loading more calls:', err);
    } finally {
      setIsLoadingMore(false);
      // Small delay before unlocking to prevent rapid fires
      setTimeout(() => setLoadingLocked(false), 500);
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const handleCall = async (otherUserId, callType) => {
    if (callState !== 'idle') {
      console.log('Already in a call');
      return;
    }

    try {
      await startCall(otherUserId, callType);
    } catch (err) {
      console.error('Failed to start call:', err);
    }
  };

  const getCallIcon = (call) => {
    const isOutgoing = call.caller_id === currentUser?.id;
    const isMissed = call.call_status === 'missed';

    if (isMissed) {
      return <PhoneMissed className="w-5 h-5 text-red-500" />;
    }
    if (isOutgoing) {
      return <PhoneOutgoing className="w-5 h-5 text-green-500" />;
    }
    return <PhoneIncoming className="w-5 h-5 text-blue-500" />;
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Show loading while checking auth or fetching
  if (!isAuthenticated || isLoading) {
    return (
      <div className="history-container">
        <header className="app-header">
          <div className="header-left">
            <button className="back-btn" onClick={() => navigate(-1)}>
              <ArrowLeft size={20} />
            </button>
          </div>
          <div className="header-center">
            <h1>Call History</h1>
          </div>
          <div className="header-right"></div>
        </header>
        <div className="history-loading">
          <div className="loading-spinner"></div>
          <p>Loading call history...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="history-container">
        <header className="app-header">
          <div className="header-left">
            <button className="back-btn" onClick={() => navigate(-1)}>
              <ArrowLeft size={20} />
            </button>
          </div>
          <div className="header-center">
            <h1>Call History</h1>
          </div>
          <div className="header-right"></div>
        </header>
        <div className="history-error">
          <p>Error loading call history</p>
          <button onClick={() => refetch()}>Retry</button>
        </div>
        <BottomNavigation />
      </div>
    );
  }

  return (
    <>
      <div className="history-container">
        <header className="app-header">
          <div className="header-left">
            <button className="back-btn" onClick={() => navigate(-1)}>
              <ArrowLeft size={20} />
            </button>
          </div>
          <div className="header-center">
            <h1>Call History</h1>
          </div>
          <div className="header-right"></div>
        </header>

        <div className="history-content">
          {history.length > 0 ? (
            <div className="history-list">
              {history.map((call) => (
                <div
                  key={call.id}
                  className="history-item"
                  onClick={() => handleCall(call.other_user_id, call.call_type)}
                >
                  {/* Avatar */}
                  <div className="call-avatar">
                    {call.other_user_avatar ? (
                      parseInt(call.other_user_avatar) ? (
                        <img
                          src={dpOptions.find(dp => dp.id === parseInt(call.other_user_avatar))?.path || call.other_user_avatar}
                          alt={call.other_user_name}
                        />
                      ) : (
                        <img
                          src={call.other_user_avatar}
                          alt={call.other_user_name}
                        />
                      )
                    ) : (
                      getInitials(call.other_user_name)
                    )}
                  </div>

                  {/* Info */}
                  <div className="history-details">
                    <h3 className="history-name">
                      {call.other_user_name || 'Unknown'}
                      {call.callCount > 1 && (
                        <span className="call-count"> ({call.callCount})</span>
                      )}
                    </h3>
                    <div className="history-status-row">
                      {getCallIcon(call)}
                      <span className="time-text">{formatTime(call.started_at)}</span>
                      {call.call_duration > 0 && (
                        <span className="duration-text">
                          {formatDuration(call.call_duration)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Call Button */}
                  <button
                    className="call-action-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCall(call.other_user_id, call.call_type);
                    }}
                    disabled={callState !== 'idle'}
                  >
                    {call.call_type === 'video' ? (
                      <Video size={22} />
                    ) : (
                      <Phone size={22} />
                    )}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <Phone size={48} />
              <h3>No call history</h3>
              <p>Your calls will appear here</p>
            </div>
          )}

          {/* Loader for infinite scroll */}
          {hasMore && (
            <div ref={loaderRef} className="history-loader">
              {isLoadingMore ? (
                <div className="loading-spinner"></div>
              ) : (
                <span className="scroll-more-text">Scroll for more</span>
              )}
            </div>
          )}

          {!hasMore && history.length > 0 && (
            <div className="no-more-calls">
              No more calls
            </div>
          )}
        </div>
      </div>

      {/* Bottom Navigation for mobile */}
      <BottomNavigation />
    </>
  );
};

export default History;
