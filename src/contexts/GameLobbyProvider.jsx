import React, { useState, useEffect, useRef, useCallback } from 'react';
import { realtimeManager } from '../utils/realtimeManager';
import { useAuth } from '../hooks/useAuth';
import { GameLobbyContext } from './GameLobbyContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Swords } from 'lucide-react';
import styles from '../components/games/GameInviteNotification.module.css';

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
            // console.log('[GameLobby] Raw Presence State:', state);
            
            const uniqueUsersMap = new Map();
            
            Object.values(state).flat().forEach(u => {
                // Support both user_id and id fields
                const uid = u.user_id || u.id;
                if (!uid) return;
                
                const existing = uniqueUsersMap.get(String(uid));
                // Prefer the presence with the most recent online_at
                if (!existing || new Date(u.online_at) > new Date(existing.onlineSince)) {
                    uniqueUsersMap.set(String(uid), {
                        id: String(uid),
                        name: u.name || 'Unknown',
                        avatar: u.avatar,
                        onlineSince: u.online_at || new Date().toISOString(),
                    });
                }
            });
            
            // Normalize current user ID for comparison
            const myId = dbUserRef.current?.id ? String(dbUserRef.current.id) : null;
            
            const others = Array.from(uniqueUsersMap.values())
                .filter(u => String(u.id) !== myId);
            
            console.log(`[GameLobby] Online: ${uniqueUsersMap.size} total, ${others.length} others`);
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
            try {
                await realtimeManager.subscribe(
                    PRESENCE_CHANNEL,
                    { presence: { key: dbUser.id } },
                    {
                        presence: () => {
                            const entry = realtimeManager.getChannel(PRESENCE_CHANNEL);
                            if (entry?.channel) syncPresenceState(entry.channel);
                        },
                        onStatusChange: (status) => {
                            if (!mountedRef.current) return;
                            console.log(`[GameLobby] Channel status: ${status}`);
                            
                            const active = status === 'SUBSCRIBED' || status === 'CONNECTED';
                            setIsConnected(active);
                            
                            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                                console.error('[GameLobby] Presence channel error:', status);
                                // Optional: toast.error('Presence connection issues');
                            }
                            
                            if (active) {
                                const entry = realtimeManager.getChannel(PRESENCE_CHANNEL);
                                if (entry?.channel) {
                                    console.log('[GameLobby] Tracking user:', dbUserRef.current.id);
                                    entry.channel.track({
                                        user_id: dbUserRef.current.id,
                                        name: dbUserRef.current.name,
                                        avatar: dbUserRef.current.avatar,
                                        online_at: new Date().toISOString(),
                                    }).then(() => {
                                        syncPresenceState(entry.channel);
                                    }).catch(err => {
                                        console.error('[GameLobby] Track failed:', err);
                                    });
                                }
                            }
                        }
                    }
                );
            } catch (err) {
                console.error('[GameLobby] Subscription failed:', err);
            }
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
                            console.log('[GameLobby] New invitation received:', payload.new);
                            if (payload.new.status !== 'pending') return;

                            // Show global toast
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

    const value = { onlineUsers, isConnected };

    return (
        <GameLobbyContext.Provider value={value}>
            {children}
        </GameLobbyContext.Provider>
    );
};

export default GameLobbyProvider;
