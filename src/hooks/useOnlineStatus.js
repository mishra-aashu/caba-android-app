import { useContext } from 'react';
import { GameLobbyContext } from '../contexts/GameLobbyContext';

/**
 * useOnlineStatus Hook (Refactored)
 *
 * Now acts as a proxy for the centralized GameLobbyContext.
 * This avoids creating redundant presence channels while maintaining
 * compatibility with existing components that rely on this hook.
 */
export const useOnlineStatus = () => {
  const context = useContext(GameLobbyContext);
  
  if (!context) {
    // Fallback if used outside Provider
    return {
      isOnline: navigator.onLine,
      lastSeen: new Date().toISOString()
    };
  }

  return {
    isOnline: context.isConnected,
    lastSeen: new Date().toISOString()
  };
};

export default useOnlineStatus;