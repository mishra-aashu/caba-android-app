import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useCall } from '../contexts/CallContext';
import { dpOptions } from '../utils/dpOptions';
import { Phone, PhoneIncoming, PhoneMissed, PhoneOutgoing, Video, ArrowLeft, RefreshCw } from 'lucide-react';
import { callService } from '../services/callService';
import BottomNavigation from './common/BottomNavigation';
import { isUserOnline, formatInboxTime } from '../utils/dateFormatter';
import useAuthStore from '../store/authStore';
import '../styles/calls.css';
import '../styles/history.css';

const History = ({ isSidebar = false }) => {
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
    staleTime: 1000 * 30, // 30 seconds - keep data fresh for real-time updates
    gcTime: 1000 * 30, // 30 seconds - keep in cache
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  // Local state for grouped history and pagination
  const [history, setHistory] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [lastCallId, setLastCallId] = useState(null);
  const [loadingLocked, setLoadingLocked] = useState(false);
  const loaderRef = useRef(null);

  // Handle manual refresh
  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

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
      // Load user-specific history with pagination (20 at a time) - SERVER SIDE
      const result = await callService.getCallHistory(userId, 20, null);

      // Group calls by other_user_id to show count
      const groupedCalls = groupCallsByUser(result.calls);

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
      const otherUserId = call.otherUserId;
      const groupKey = getWhatsAppGroupKey(call.startedAt);
      const compositeKey = `${otherUserId}_${groupKey}`;

      if (!grouped[compositeKey]) {
        grouped[compositeKey] = {
          ...call,
          callCount: 1,
          groupLabel: formatWhatsAppGroup(call.startedAt)
        };
      } else {
        grouped[compositeKey].callCount += 1;
        if (new Date(call.startedAt) > new Date(grouped[compositeKey].startedAt)) {
          grouped[compositeKey].startedAt = call.startedAt;
          grouped[compositeKey].id = call.id;
        }
      }
    });

    return Object.values(grouped).sort((a, b) => {
      const dateA = a.startedAt ? new Date(a.startedAt).getTime() : 0;
      const dateB = b.startedAt ? new Date(b.startedAt).getTime() : 0;
      return dateB - dateA; // Newest first
    });
  };

  const loadMoreCalls = async () => {
    if (!currentUser || isLoadingMore || !hasMore || loadingLocked) return;

    // Lock to prevent rapid multiple loads
    setLoadingLocked(true);
    setIsLoadingMore(true);

    try {
      const result = await callService.getCallHistory(currentUser.id, 20, lastCallId);

      if (!result.calls || result.calls.length === 0) {
        setHasMore(false);
        return;
      }

      // Group new calls by user
      const groupedNewCalls = groupCallsByUser(result.calls);

      // Merge with existing grouped calls - use WhatsApp-style grouping
      setHistory(prev => {
        const mergedMap = new Map();

        // Add existing entries
        prev.forEach(call => {
          const groupKey = `${call.otherUserId}_${getWhatsAppGroupKey(call.startedAt)}`;
          mergedMap.set(groupKey, call);
        });

        // Update or add new calls
        groupedNewCalls.forEach(newCall => {
          const groupKey = `${newCall.otherUserId}_${getWhatsAppGroupKey(newCall.startedAt)}`;
          if (mergedMap.has(groupKey)) {
            const existing = mergedMap.get(groupKey);
            existing.callCount += newCall.callCount;
            if (new Date(newCall.startedAt) > new Date(existing.startedAt)) {
              existing.startedAt = newCall.startedAt;
              existing.id = newCall.id;
            }
          } else {
            mergedMap.set(groupKey, newCall);
          }
        });

        const merged = Array.from(mergedMap.values());
        return merged.sort((a, b) => {
          const dateA = a.startedAt ? new Date(a.startedAt).getTime() : 0;
          const dateB = b.startedAt ? new Date(b.startedAt).getTime() : 0;
          return dateB - dateA; // Newest first
        });
      });

      setHasMore(result.hasMore);
      setLastCallId(result.lastCallId);
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

  const displayTime = (timestamp) => {
    return formatInboxTime(timestamp);
  };

  const handleCall = async (otherUserId, callType) => {
    if (callState !== 'idle') {
      return;
    }

    try {
      await startCall(otherUserId, callType);
    } catch (err) {
      console.error('Failed to start call:', err);
    }
  };

  const getCallIcon = (call) => {
    const isOutgoing = call.callerId === currentUser?.id;
    const isMissed = call.callStatus === 'missed';

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
            <button className="back-btn" onClick={() => isSidebar ? navigate('/') : navigate(-1)}>
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
            <button className="back-btn" onClick={() => isSidebar ? navigate('/') : navigate(-1)}>
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
        {!isSidebar && <BottomNavigation />}
      </div>
    );
  }

  return (
    <>
      <div className={`history-container ${isSidebar ? 'is-sidebar' : ''}`}>
        <header className="app-header">
          <div className="header-left">
            <button className="back-btn" onClick={() => isSidebar ? navigate('/') : navigate(-1)}>
              <ArrowLeft size={20} />
            </button>
          </div>
          <div className="header-center">
            <h1>Call History</h1>
          </div>
          <div className="header-right">
            <button 
              className="refresh-btn" 
              onClick={handleRefresh}
              disabled={isLoading}
              title="Refresh call history"
            >
              <RefreshCw size={20} className={isLoading ? 'spinning' : ''} />
            </button>
          </div>
        </header>

        <div className="history-content">
          {history.length > 0 ? (
            <div className="history-list">
              {history.map((call) => (
                <div
                  key={call.id}
                  className="history-item"
                  onClick={() => handleCall(call.otherUserId, call.callType)}
                >
                  {/* Avatar */}
                  <div className="call-avatar">
                    {call.otherUserAvatar ? (
                      parseInt(call.otherUserAvatar) ? (
                        <img
                          src={dpOptions.find(dp => dp.id === parseInt(call.otherUserAvatar))?.path || call.otherUserAvatar}
                          alt={call.otherUserName}
                        />
                      ) : (
                        <img
                          src={call.otherUserAvatar}
                          alt={call.otherUserName}
                        />
                      )
                    ) : (
                      getInitials(call.otherUserName)
                    )}
                  </div>

                  {/* Info */}
                  <div className="history-details">
                    <h3 className="history-name">
                      {call.otherUserName || 'Unknown'}
                      {call.callCount > 1 && (
                        <span className="call-count"> ({call.callCount})</span>
                      )}
                    </h3>
                    <div className="history-status-row">
                      {getCallIcon(call)}
                      <span className="time-text">{displayTime(call.startedAt)}</span>
                      {call.callDuration > 0 && (
                        <span className="duration-text">
                          {formatDuration(call.callDuration)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Call Button */}
                  <button
                    className="call-action-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCall(call.otherUserId, call.callType);
                    }}
                    disabled={callState !== 'idle'}
                  >
                    {call.callType === 'video' ? (
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
    </>
  );
};

export default History;
