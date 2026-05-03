import { create } from 'zustand';

export const SYNC_STATUS = {
  IDLE: 'idle',
  SYNCING: 'syncing',
  CONNECTING: 'connecting',
  OFFLINE: 'offline',
  ERROR: 'error',
};

export const useSyncStore = create((set) => ({
  status: SYNC_STATUS.IDLE,
  lastSyncAt: localStorage.getItem('last_global_sync_at') || null,
  isOnline: navigator.onLine,
  
  setStatus: (status) => set({ status }),
  setLastSyncAt: (timestamp) => {
    localStorage.setItem('last_global_sync_at', timestamp);
    set({ lastSyncAt: timestamp });
  },
  setOnline: (isOnline) => set({ 
    isOnline, 
    status: isOnline ? SYNC_STATUS.IDLE : SYNC_STATUS.OFFLINE 
  }),
}));
