import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabaseRealtime } from '../config/supabase';
import { realtimeManager } from '../utils/realtimeManager';
import { useAuth } from '../hooks/useAuth';
import { GameLobbyContext } from './GameLobbyContext';
import usePresenceStore from '../store/usePresenceStore';
import toast from 'react-hot-toast';
import { Swords } from 'lucide-react';
import styles from '../components/games/GameInviteNotification.module.css';

/**
 * GameLobbyProvider
 *
 * THE SINGLE SOURCE OF TRUTH for online presence.
 */

const PRESENCE_CHANNEL = 'game_lobby_presence';

export const GameLobbyProvider = ({ children }) => {
    const { dbUser } = useAuth();
    const setOnlineUsersStore = usePresenceStore(state => state.setOnlineUsers);
    const [isConnected, setIsConnected] = useState(false);

    // ... (rest of the presence channel logic stays similar but uses syncPresenceState)
    // I'll keep the useEffect that sets up the channel
    useEffect(() => {
        if (!dbUser?.id) return;

        const handlePresenceSync = (state) => {
            console.log('[GameLobbyProvider] Presence sync received:', state);
            const currentMap = { ...usePresenceStore.getState().onlineUsers };
            
            // Sync is the full state, but we should be careful not to 
            // clear users who might be in the middle of joining/leaving
            const newMap = {};
            Object.values(state).flat().forEach(u => {
                const uid = u.user_id || u.id || u.subId;
                if (!uid) return;
                const uidStr = String(uid);
                
                // Keep the freshest metadata
                if (!newMap[uidStr] || new Date(u.online_at) > new Date(newMap[uidStr].onlineAt)) {
                    newMap[uidStr] = {
                        id: uidStr,
                        name: u.name || 'Unknown',
                        avatar: u.avatar || null,
                        onlineAt: u.online_at || new Date().toISOString(),
                        isOnline: true
                    };
                }
            });
            
            console.log('[GameLobbyProvider] Setting online users:', Object.keys(newMap).length);
            setOnlineUsersStore(newMap);
        };

        const handlePresenceJoin = (payload) => {
            console.log('[GameLobbyProvider] Presence join:', payload);
            if (!payload.newPresences) return;
            
            payload.newPresences.forEach(u => {
                const uid = u.user_id || u.id;
                if (!uid) return;
                usePresenceStore.getState().updateUser(String(uid), {
                    name: u.name,
                    avatar: u.avatar,
                    onlineAt: u.online_at || new Date().toISOString()
                });
            });
        };

        const handlePresenceLeave = (payload) => {
            console.log('[GameLobbyProvider] Presence leave:', payload);
            if (!payload.leftPresences) return;
            
            payload.leftPresences.forEach(u => {
                const uid = u.user_id || u.id;
                if (uid) usePresenceStore.getState().removeUser(String(uid));
            });
        };

        let activeChannel = null;

        const startPresence = async () => {
            activeChannel = await realtimeManager.subscribe(PRESENCE_CHANNEL, {
                presence: { key: String(dbUser.id) }
            }, {
                presence: handlePresenceSync,
                presence_join: handlePresenceJoin,
                presence_leave: handlePresenceLeave,
                onStatusChange: async (status) => {
                    console.log(`[GameLobbyProvider] Status change: ${status}`);
                    if (status === 'SUBSCRIBED') {
                        setIsConnected(true);
                        try {
                            const trackPayload = {
                                user_id: String(dbUser.id),
                                id: String(dbUser.id),
                                name: dbUser.name || 'Unknown',
                                avatar: dbUser.avatar || null,
                                online_at: new Date().toISOString(),
                            };
                            
                            await activeChannel.track(trackPayload);
                            
                            // Periodic re-track to ensure presence stays alive
                            const trackInterval = setInterval(() => {
                                if (activeChannel) activeChannel.track(trackPayload);
                            }, 60000);
                            
                            activeChannel.__trackInterval = trackInterval;

                            // Immediate fetch of current state
                            const initialState = activeChannel.presenceState();
                            if (initialState && Object.keys(initialState).length > 0) {
                                handlePresenceSync(initialState);
                            }
                        } catch (err) {
                            console.error('[GameLobby] track failed:', err);
                        }
                    } else {
                        setIsConnected(false);
                    }
                }
            });
        };

        startPresence();

        return () => {
            if (activeChannel) {
                if (activeChannel.__trackInterval) clearInterval(activeChannel.__trackInterval);
                realtimeManager.unsubscribe(PRESENCE_CHANNEL);
            }
        };
    }, [dbUser?.id, setOnlineUsersStore]);

    // ... (Game invitations logic)
    useEffect(() => {
        if (!dbUser?.id) return;

        const INVITES_CHANNEL = `global_invites_${dbUser.id}`;

        realtimeManager.subscribe(
            INVITES_CHANNEL,
            {},
            {
                postgres_changes: [
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'game_invitations',
                        filter: `receiver_id=eq.${dbUser.id}`,
                        handler: async (payload) => {
                            if (payload.new.status !== 'pending') return;

                            toast.custom((t) => (
                                <div className={`${styles.inviteToast} ${t.visible ? styles.animateIn : styles.animateOut}`}>
                                    <div className={styles.inviteIcon}>
                                        <Swords size={22} color="white" />
                                    </div>
                                    <div className={styles.inviteContent}>
                                        <p className={styles.inviteName}>New Battle Challenge!</p>
                                        <p className={styles.inviteText}>Someone wants to play Truth or Dare.</p>
                                        <div className={styles.inviteActions}>
                                            <button
                                                className={styles.acceptBtn}
                                                onClick={() => {
                                                    toast.dismiss(t.id);
                                                    window.location.hash = '#/games';
                                                }}
                                            >
                                                VIEW INVITE
                                            </button>
                                            <button
                                                className={styles.declineBtn}
                                                onClick={() => toast.dismiss(t.id)}
                                            >
                                                CLOSE
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ), { duration: 6000, id: `invite_${payload.new.id}` });
                        }
                    }
                ]
            }
        );

        return () => {
            realtimeManager.unsubscribe(INVITES_CHANNEL);
        };
    }, [dbUser?.id]);

    const value = { isConnected }; // Removed onlineUsers from context as it's in Zustand now

    return (
        <GameLobbyContext.Provider value={value}>
            {children}
        </GameLobbyContext.Provider>
    );
};

export default GameLobbyProvider;

