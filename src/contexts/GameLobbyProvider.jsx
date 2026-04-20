import React, { useState, useEffect, useRef, useCallback } from 'react';
import { realtimeManager } from '../utils/realtimeManager';
import { useAuth } from '../hooks/useAuth';
import { GameLobbyContext } from './GameLobbyContext';

/**
 * GameLobbyProvider
 *
 * THE SINGLE SOURCE OF TRUTH for online presence.
 * Manages the global 'game_lobby_presence' channel.
 */

const PRESENCE_CHANNEL = 'game_lobby_presence';

export const GameLobbyProvider = ({ children }) => {
    const { dbUser } = useAuth();
    const [onlineUsers, setOnlineUsers] = useState([]);
    const [isConnected, setIsConnected] = useState(false);
    
    const dbUserRef = useRef(dbUser);
    const mountedRef = useRef(true);

    // Keep ref in sync
    useEffect(() => {
        dbUserRef.current = dbUser;
    }, [dbUser]);

    const syncPresenceState = useCallback((channel) => {
        if (!mountedRef.current || !channel) return;
        try {
            const state = channel.presenceState();
            console.log('[GameLobby] Raw Presence State:', state);
            
            const uniqueUsersMap = new Map();
            
            Object.values(state).flat().forEach(u => {
                if (!u.user_id) return;
                
                const existing = uniqueUsersMap.get(u.user_id);
                // Prefer the presence with the most recent online_at
                if (!existing || new Date(u.online_at) > new Date(existing.onlineSince)) {
                    uniqueUsersMap.set(u.user_id, {
                        id: u.user_id,
                        name: u.name || 'Unknown',
                        avatar: u.avatar,
                        onlineSince: u.online_at,
                    });
                }
            });
            
            const others = Array.from(uniqueUsersMap.values())
                .filter(u => u.id !== dbUserRef.current?.id);
            
            console.log('[GameLobby] Online Users (excluding me):', others.length, others);
            setOnlineUsers(others);
            window.__onlineUsersMap = uniqueUsersMap;
        } catch (err) {
            console.error('[GameLobbyProvider] Sync error:', err);
        }
    }, []);

    useEffect(() => {
        if (!dbUser?.id) return;

        mountedRef.current = true;
        console.log('[GameLobby] Initializing for user:', dbUser.id);

        const initPresence = async () => {
            await realtimeManager.subscribe(
                PRESENCE_CHANNEL,
                { presence: { key: dbUser.id } },
                {
                    presence: () => {
                        console.log('[GameLobby] Presence sync event received');
                        const entry = realtimeManager.getChannel(PRESENCE_CHANNEL);
                        if (entry?.channel) syncPresenceState(entry.channel);
                    },
                    onStatusChange: (status) => {
                        if (!mountedRef.current) return;
                        console.log('[GameLobby] Channel status:', status);
                        const active = status === 'SUBSCRIBED' || status === 'CONNECTED';
                        setIsConnected(active);
                        
                        if (active) {
                            const entry = realtimeManager.getChannel(PRESENCE_CHANNEL);
                            if (entry?.channel) {
                                console.log('[GameLobby] Tracking user on channel...');
                                entry.channel.track({
                                    user_id: dbUserRef.current.id,
                                    name: dbUserRef.current.name,
                                    avatar: dbUserRef.current.avatar,
                                    online_at: new Date().toISOString(),
                                }).then(() => {
                                    console.log('[GameLobby] Track successful ✓');
                                    syncPresenceState(entry.channel);
                                }).catch(err => {
                                    console.error('[GameLobby] Track failed ❌', err);
                                });
                            }
                        }
                    }
                }
            );
        };

        initPresence();

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && mountedRef.current) {
                console.log('[GameLobby] App visible, re-tracking...');
                const entry = realtimeManager.getChannel(PRESENCE_CHANNEL);
                if (entry?.channel && (entry.status === 'SUBSCRIBED' || entry.status === 'CONNECTED')) {
                    entry.channel.track({
                        user_id: dbUserRef.current.id,
                        name: dbUserRef.current.name,
                        avatar: dbUserRef.current.avatar,
                        online_at: new Date().toISOString(),
                    }).catch(() => {});
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            mountedRef.current = false;
            console.log('[GameLobby] Cleaning up channel');
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            realtimeManager.unsubscribe(PRESENCE_CHANNEL);
            setOnlineUsers([]);
            setIsConnected(false);
            delete window.__onlineUsersMap;
        };
    }, [dbUser?.id, syncPresenceState]);

    const value = { onlineUsers, isConnected };

    return (
        <GameLobbyContext.Provider value={value}>
            {children}
        </GameLobbyContext.Provider>
    );
};

export default GameLobbyProvider;
