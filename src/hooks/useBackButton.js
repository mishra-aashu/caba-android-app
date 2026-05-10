import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import toast from 'react-hot-toast';
import useMusicStore from '../store/useMusicStore';
import useChatStore from '../store/useChatStore';

/**
 * useBackButton Hook
 * Handles the Android hardware back button with a robust priority-based system.
 */
export const useBackButton = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const lastBackPressTime = useRef(0);
    
    // Store refs to avoid re-binding listener on every state change
    const stateRef = useRef({
        isPlayerExpanded: false,
        isPanelOpen: false,
        activeSection: 'home',
        activeChatId: null,
        isSelectionMode: false,
        pathname: '/'
    });

    // Sync refs with store/location
    const musicState = useMusicStore(s => ({
        isPlayerExpanded: s.isPlayerExpanded,
        isPanelOpen: s.isPanelOpen,
        activeSection: s.activeSection
    }));
    const chatState = useChatStore(s => ({
        activeChatId: s.activeChatId,
        isSelectionMode: s.isSelectionMode
    }));

    useEffect(() => {
        stateRef.current = {
            ...musicState,
            ...chatState,
            pathname: location.pathname
        };
    }, [musicState, chatState, location.pathname]);

    useEffect(() => {
        if (!Capacitor.isNativePlatform()) return;

        let backListener;

        const setup = async () => {
            backListener = await App.addListener('backButton', ({ canGoBack }) => {
                const { 
                    isPlayerExpanded, 
                    isPanelOpen, 
                    activeSection, 
                    activeChatId, 
                    isSelectionMode, 
                    pathname 
                } = stateRef.current;

                console.log(`[BackButton] Pressed. Path: ${pathname}, activeChatId: ${activeChatId}`);

                // 1. Highest Priority: Clear Selection
                if (isSelectionMode) {
                    useChatStore.getState().clearSelection();
                    return;
                }

                // 2. Music Player Expansion
                if (isPlayerExpanded) {
                    useMusicStore.getState().setPlayerExpanded(false);
                    return;
                }

                // 3. Music Panel
                if (isPanelOpen) {
                    useMusicStore.getState().togglePanel(false);
                    return;
                }

                // 4. Overlays (UserDetails, Settings, Profile, etc.)
                const OVERLAY_ROUTES = [
                    '/contacts', '/profile', '/settings', '/theme', '/history', '/games', '/reminders', '/create-reminder', '/user-details/'
                ];
                const isOverlay = OVERLAY_ROUTES.some(r => pathname.startsWith(r));

                if (isOverlay) {
                    console.log('[BackButton] Closing overlay route');
                    navigate('/', { replace: true });
                    return;
                }

                // 5. Active Chat Screen (Mobile)
                if (activeChatId && pathname.includes('/chat/')) {
                    console.log('[BackButton] Closing active chat');
                    useChatStore.getState().clearActiveChat();
                    navigate('/', { replace: true });
                    return;
                }

                // 6. Music Hub Navigation (Internal)
                if (pathname === '/listen-together' && activeSection !== 'home') {
                    useMusicStore.getState().setActiveSection('home');
                    return;
                }

                // 7. Generic Navigation Back
                if (canGoBack) {
                    window.history.back();
                } else if (pathname !== '/') {
                    navigate('/', { replace: true });
                } else {
                    // 8. Exit App (Double Back)
                    const now = Date.now();
                    if (now - lastBackPressTime.current < 2000) {
                        App.exitApp();
                    } else {
                        lastBackPressTime.current = now;
                        toast('Press back again to exit', {
                            id: 'exit-toast',
                            position: 'bottom-center',
                            duration: 2000,
                            style: { background: '#333', color: '#fff', borderRadius: '50px' }
                        });
                    }
                }
            });
        };

        setup();

        return () => {
            if (backListener) {
                backListener.remove();
            }
        };
    }, [navigate]);
};
