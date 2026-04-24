import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabaseRealtime } from '../config/supabase';
import { realtimeManager } from '../utils/realtimeManager';
import { useAuth } from '../hooks/useAuth';
import { GameLobbyContext } from './GameLobbyContext';
import toast from 'react-hot-toast';
import { Swords } from 'lucide-react';
import styles from '../components/games/GameInviteNotification.module.css';

/**
 * GameLobbyProvider
 *
 * THE SINGLE SOURCE OF TRUTH for online presence.
 * Uses Supabase Realtime directly (bypasses realtimeManager) for presence
 * to avoid state string translation bugs.
 */

const PRESENCE_CHANNEL = 'game_lobby_presence';

export const GameLobbyProvider = ({ children }) => {
    const { dbUser } = useAuth();
    const [onlineUsers, setOnlineUsers] = useState([]);
    const [isConnected, setIsConnected] = useState(false);

    const dbUserRef = useRef(dbUser);
    const mountedRef = useRef(true);
    const channelRef = useRef(null);

    // Keep ref in sync with latest dbUser
    useEffect(() => {
        dbUserRef.current = dbUser;
    }, [dbUser]);

    const syncPresenceState = useCallback((channel) => {
        if (!mountedRef.current || !channel) return;
        try {
            const state = channel.presenceState();
            console.log('[GameLobby] Raw presence state:', JSON.stringify(state));

            const uniqueUsersMap = new Map();

            Object.values(state).flat().forEach(u => {
                const uid = u.user_id || u.id;
                if (!uid) return;

                const uidStr = String(uid);
                const existing = uniqueUsersMap.get(uidStr);
                if (!existing || new Date(u.online_at) > new Date(existing.onlineSince)) {
                    uniqueUsersMap.set(uidStr, {
                        id: uidStr,
                        name: u.name || 'Unknown',
                        avatar: u.avatar || null,
                        onlineSince: u.online_at || new Date().toISOString(),
                    });
                }
            });

            const myId = dbUserRef.current?.id ? String(dbUserRef.current.id) : null;
            // Exclude self from "others online" list
            if (myId) uniqueUsersMap.delete(myId);

            const others = Array.from(uniqueUsersMap.values());
            console.log(`[GameLobby] Others online: ${others.length}`, others.map(u => u.name));
            setOnlineUsers(others);
        } catch (err) {
            console.error('[GameLobbyProvider] Sync error:', err);
        }
    }, []);

    // ── Presence channel (Lazy Activation) ──
    useEffect(() => {
        if (!dbUser?.id) return;

        let syncInterval = null;
        let channel = null;

        const setupPresence = async () => {
            console.log('[GameLobby] Setting up presence for:', dbUser.id);
            
            if (channelRef.current) {
                supabaseRealtime.removeChannel(channelRef.current).catch(() => {});
            }

            channel = supabaseRealtime.channel(PRESENCE_CHANNEL, {
                config: { presence: { key: String(dbUser.id) } },
            });

            channelRef.current = channel;

            channel
                .on('presence', { event: 'sync' }, () => syncPresenceState(channel))
                .on('presence', { event: 'join' }, () => syncPresenceState(channel))
                .on('presence', { event: 'leave' }, () => syncPresenceState(channel))
                .subscribe(async (status) => {
                    if (status === 'SUBSCRIBED') {
                        setIsConnected(true);
                        const user = dbUserRef.current;
                        if (!user?.id) return;
                        try {
                            await channel.track({
                                user_id: String(user.id),
                                id: String(user.id),
                                name: user.name || 'Unknown',
                                avatar: user.avatar || null,
                                online_at: new Date().toISOString(),
                            });
                            syncPresenceState(channel);
                        } catch (err) {
                            console.error('[GameLobby] track failed:', err);
                        }
                    } else {
                        setIsConnected(false);
                    }
                });

            syncInterval = setInterval(() => {
                if (channelRef.current && mountedRef.current) {
                    syncPresenceState(channelRef.current);
                }
            }, 15000);
        };

        setupPresence();

        // Listen for route changes to wake up/hibernate
        const handleRouteChange = () => {
            setupPresence();
        };

        window.addEventListener('hashchange', handleRouteChange);
        window.addEventListener('popstate', handleRouteChange);

        return () => {
            window.removeEventListener('hashchange', handleRouteChange);
            window.removeEventListener('popstate', handleRouteChange);
            if (syncInterval) clearInterval(syncInterval);
            if (channel) {
                supabaseRealtime.removeChannel(channel).catch(() => {});
                channelRef.current = null;
            }
        };
    }, [dbUser?.id, syncPresenceState]);

    // ── Game invitations channel (keep using realtimeManager — this is fine) ──
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
