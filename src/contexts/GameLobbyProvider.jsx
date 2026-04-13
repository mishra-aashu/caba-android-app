import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../config/supabase';
import { useAuth } from '../hooks/useAuth';
import { GameLobbyContext } from './GameLobbyContext';

/**
 * GameLobbyProvider
 *
 * Owns the SINGLE shared 'game_lobby_presence' Supabase Presence channel.
 * Provides:
 *   - onlineUsers: array of { id, name, avatar, onlineSince } for all online users
 *     except the current user
 *
 * This must wrap the entire authenticated app so the channel stays alive
 * regardless of which page the user is on. This way ALL logged-in users
 * appear in the Games Hub, not just those who have /games open.
 *
 * Key insight: supabase.channel(name) returns the same channel instance if
 * called twice with the same name. So we manage it here once.
 */

const PRESENCE_CHANNEL = 'game_lobby_presence';

const isOtherUser = (presence, myId) => presence.user_id !== myId;

export const GameLobbyProvider = ({ children }) => {
    const { dbUser } = useAuth();
    const [onlineUsers, setOnlineUsers] = useState([]);
    const channelRef = useRef(null);
    const dbUserRef = useRef(dbUser);
    const mountedRef = useRef(true);

    // Keep ref in sync for use in async callbacks
    useEffect(() => {
        dbUserRef.current = dbUser;
    }, [dbUser]);

    useEffect(() => {
        if (!dbUser?.id) return;

        mountedRef.current = true;

        const channel = supabase.channel(PRESENCE_CHANNEL, {
            config: { presence: { key: dbUser.id } },
        });

        channelRef.current = channel;

        channel
            .on('presence', { event: 'sync' }, () => {
                if (!mountedRef.current) return;
                try {
                    const state = channel.presenceState();
                    const users = Object.values(state)
                        .flat()
                        .filter(u => isOtherUser(u, dbUserRef.current?.id))
                        .map(u => ({
                            id: u.user_id,
                            name: u.name || 'Unknown',
                            avatar: u.avatar,
                            onlineSince: u.online_at,
                        }));
                    setOnlineUsers(users);
                } catch (err) {
                    console.error('[GameLobbyProvider] Presence sync error:', err);
                }
            })
            .on('presence', { event: 'join' }, ({ newPresences }) => {
                if (!mountedRef.current) return;
                setOnlineUsers(prev => {
                    const incoming = newPresences
                        .filter(u => isOtherUser(u, dbUserRef.current?.id))
                        .map(u => ({
                            id: u.user_id,
                            name: u.name || 'Unknown',
                            avatar: u.avatar,
                            onlineSince: u.online_at,
                        }));
                    const ids = new Set(incoming.map(u => u.id));
                    return [...prev.filter(u => !ids.has(u.id)), ...incoming];
                });
            })
            .on('presence', { event: 'leave' }, ({ leftPresences }) => {
                if (!mountedRef.current) return;
                const leftIds = new Set(leftPresences.map(u => u.user_id));
                setOnlineUsers(prev => prev.filter(u => !leftIds.has(u.id)));
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED' && mountedRef.current) {
                    try {
                        await channel.track({
                            user_id: dbUserRef.current.id,
                            name: dbUserRef.current.name,
                            avatar: dbUserRef.current.avatar,
                            online_at: new Date().toISOString(),
                        });
                        console.log('[GameLobbyProvider] Tracked on game_lobby_presence ✓');
                    } catch (err) {
                        console.error('[GameLobbyProvider] track failed:', err);
                    }
                }
            });

        // Re-track when document becomes visible (app returns from background)
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && channelRef.current && mountedRef.current) {
                console.log('[GameLobbyProvider] App visible, re-tracking presence...');
                channelRef.current.track({
                    user_id: dbUserRef.current.id,
                    name: dbUserRef.current.name,
                    avatar: dbUserRef.current.avatar,
                    online_at: new Date().toISOString(),
                }).catch(err => console.error('[GameLobbyProvider] Re-track failed:', err));
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            mountedRef.current = false;
            console.log('[GameLobbyProvider] Cleaning up game_lobby_presence');
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            channel.untrack().catch(() => {});
            supabase.removeChannel(channel);
            channelRef.current = null;
            setOnlineUsers([]);
        };
    }, [dbUser?.id]);

    const value = { onlineUsers };

    return (
        <GameLobbyContext.Provider value={value}>
            {children}
        </GameLobbyContext.Provider>
    );
};

export default GameLobbyProvider;
