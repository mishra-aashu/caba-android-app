import React, { memo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MessageCircle, Phone, Settings } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import hapticsManager from '../../utils/hapticsManager';
import styles from './BottomNavigation.module.css';

const NAV_ITEMS = [
    { path: '/', icon: MessageCircle, label: 'Chats', matchPaths: ['/', '/chat'] },
    { path: '/calls', icon: Phone, label: 'Calls', matchPaths: ['/calls'] },
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

    // Live unread count from Dexie
    const unreadCount = useLiveQuery(async () => {
        try {
            const chats = await db.chats_list.toArray();
            return chats.reduce((sum, chat) => sum + (chat.unread_count || 0), 0);
        } catch {
            return 0;
        }
    }, [], 0);

    const isActive = useCallback((matchPaths) => {
        return matchPaths.some(p => {
            if (p === '/') return location.pathname === '/';
            return location.pathname.startsWith(p);
        });
    }, [location.pathname]);

    const handleNavigate = useCallback((path) => {
        // Don't navigate if already on the same tab
        if (location.pathname === path) return;
        navigate(path);
    }, [navigate, location.pathname]);

    // Get badge for each tab
    const getBadge = useCallback((path) => {
        if (path === '/') return unreadCount;
        return 0;
    }, [unreadCount]);

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