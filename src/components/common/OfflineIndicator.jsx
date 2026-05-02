import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi, CloudOff, RefreshCw } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import '../../styles/offline-indicator.css';

/**
 * 🎯 OfflineIndicator - Network Status Banner
 * 
 * Shows a banner when the user is offline and automatically
 * hides when connection is restored. Uses cached data when offline.
 * 
 * @param {boolean} showWhenOnline - Whether to show indicator when online (default: false)
 * @param {string} position - 'top' or 'bottom' (default: 'top')
 * @param {ReactNode} children - Child components to render
 * 
 * @example
 * <OfflineIndicator>
 *   <YourAppComponents />
 * </OfflineIndicator>
 */
import SystemStatusBanner from './SystemStatusBanner';
import { useSystemHealth } from '../../contexts/HealthProvider';

const OfflineIndicator = ({ children }) => {
  return (
    <div className="offline-indicator-wrapper">
      <SystemStatusBanner />
      {children}
    </div>
  );
};

/**
 * 🎯 useNetworkStatus - Hook for Network Status
 * 
 * Returns current network status and provides callbacks
 * for online/offline events.
 * 
 * @returns {Object} - { isOnline, wasOffline }
 * 
 * @example
 * const { isOnline, wasOffline } = useNetworkStatus();
 * 
 * useEffect(() => {
 *   if (wasOffline && isOnline) {
 *     // Refetch data when back online
 *     refetch();
 *   }
 * }, [isOnline, wasOffline]);
 */
export const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(true);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setWasOffline(true);
      setIsOnline(true);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    // Initial state
    setIsOnline(navigator.onLine);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline, wasOffline };
};

/**
 * 🎯 OfflineGuard - Conditional Rendering Based on Network
 * 
 * Renders different content based on network status.
 * Perfect for showing cached data when offline.
 * 
 * @param {ReactNode} online - Content to show when online
 * @param {ReactNode} offline - Content to show when offline
 * 
 * @example
 * <OfflineGuard
 *   online={<LiveDataComponent />}
 *   offline={<CachedDataComponent />}
 * />
 */
export const OfflineGuard = ({ online, offline }) => {
  const { isOnline } = useNetworkStatus();
  return isOnline ? online : offline;
};

/**
 * 🎯 NetworkStatusProvider - Context for Network Status
 * 
 * Provides network status to all child components.
 * Use with useNetworkStatus hook in children.
 */
export const NetworkStatusContext = React.createContext({
  isOnline: true,
  wasOffline: false
});

export const NetworkStatusProvider = ({ children }) => {
  const { isOnline, wasOffline } = useNetworkStatus();

  return (
    <NetworkStatusContext.Provider value={{ isOnline, wasOffline }}>
      {children}
    </NetworkStatusContext.Provider>
  );
};

export default OfflineIndicator;
