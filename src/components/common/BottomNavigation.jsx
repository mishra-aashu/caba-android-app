import React, { memo, useCallback, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MessageCircle, Phone, Gamepad2, Settings, Music } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import hapticsManager from '../../utils/hapticsManager';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../config/supabase';
import styles from './BottomNavigation.module.css';

const NAV_ITEMS = [
    { path: '/', icon: MessageCircle, label: 'Chats', matchPaths: ['/', '/chat'] },
    { path: '/calls', icon: Phone, label: 'Calls', matchPaths: ['/calls'] },
    { path: '/games', icon: Gamepad2, label: 'Games', matchPaths: ['/games'] },
    { path: '/listen-together', icon: Music, label: 'Listen', matchPaths: ['/listen-together'] },
    { path: '/settings', icon: Settings, label: 'Settings', matchPaths: ['/settings', '/profile'] },
];

const NavButton = memo(({ path, icon: Icon, label, isActive, badge, onNavigate }) => {
    const handleClick = useCallback(() => {
        // Haptic feedback on native
        hapticsManager.selectionChanged();
        onNavigate(path);
    }, [path, onNavigate]);

    return (
        <button
            className={`${styles.navItem} ${isActive ? styles.active : ''} native-touch`}
            onClick={handleClick}
            role="tab"
            aria-selected={isActive}
            aria-label={`${label}${badge > 0 ? `, ${badge} unread` : ''}`}
        >
            {/* Active pill indicator */}
            <span className={styles.indicator} />

            {/* Icon container with scale animation */}
            <span className={styles.iconWrap}>
                <Icon size={22} strokeWidth={isActive ? 2.2 : 1.8} />

                {/* Badge */}
                {badge > 0 && (
                    <span className={styles.badge}>
                        {badge > 99 ? '99+' : badge}
                    </span>
                )}
            </span>

            {/* Label */}
            <span className={styles.label}>{label}</span>

            {/* Ripple background on tap */}
            <span className={styles.ripple} />
        </button>
    );
});

NavButton.displayName = 'NavButton';

const BottomNavigation = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { dbUser } = useAuth();

    // Live unread count from Dexie
    const unreadCount = useLiveQuery(async () => {
        try {
            const chats = await db.chats_list.toArray();
            return chats.reduce((sum, chat) => sum + (chat.unread_count || 0), 0);
        } catch {
            return 0;
        }
    }, [], 0);

    // Live game invite badge — count pending invites for current user
    const [gameInviteCount, setGameInviteCount] = useState(0);

    useEffect(() => {
        if (!dbUser?.id) return;

        let cancelled = false;

        const loadCount = async () => {
            const { count } = await supabase
                .from('game_invitations')
                .select('id', { count: 'exact', head: true })
                .eq('receiver_id', dbUser.id)
                .eq('status', 'pending');
            if (!cancelled) setGameInviteCount(count || 0);
        };

        loadCount();
        // Listen for global game invite updates
        const handleUpdate = () => {
            console.log('[BottomNavigation] Game invite update detected, reloading count...');
            loadCount();
        };

        window.addEventListener('app:game-invites-update', handleUpdate);

        return () => {
            cancelled = true;
            window.removeEventListener('app:game-invites-update', handleUpdate);
        };
    }, [dbUser?.id]);

    const isActive = useCallback((matchPaths) => {
        return matchPaths.some(p => {
            if (p === '/') return location.pathname === '/';
            return location.pathname.startsWith(p);
        });
    }, [location.pathname]);

    const handleNavigate = useCallback((path) => {
        // Don't navigate if already on the same tab
        if (location.pathname === path) return;
        hapticsManager.selectionChanged();
        navigate(path);
    }, [navigate, location.pathname]);

    // Get badge for each tab
    const getBadge = useCallback((path) => {
        if (path === '/') return unreadCount;
        if (path === '/games') return gameInviteCount;
        return 0;
    }, [unreadCount, gameInviteCount]);

    return (
        <nav className={styles.bottomNav} role="tablist" aria-label="Main navigation">
            {NAV_ITEMS.map(({ path, icon, label, matchPaths }) => (
                <NavButton
                    key={path}
                    path={path}
                    icon={icon}
                    label={label}
                    isActive={isActive(matchPaths)}
                    badge={getBadge(path)}
                    onNavigate={handleNavigate}
                />
            ))}
        </nav>
    );
};

export default memo(BottomNavigation);