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

                console.log(`[BackButton] Pressed. Path: ${pathname}, canGoBack: ${canGoBack}`);

                // 1. Highest Priority: Close selection mode/modals
                if (isSelectionMode) {
                    console.log('[BackButton] Clearing chat selection');
                    useChatStore.getState().clearSelection();
                    return;
                }

                // 2. Music Player Expansion
                if (isPlayerExpanded) {
                    console.log('[BackButton] Minimizing music player');
                    useMusicStore.getState().setPlayerExpanded(false);
                    return;
                }

                // 3. Music Panel (Playlist/Search Overlay)
                if (isPanelOpen) {
                    console.log('[BackButton] Closing music panel');
                    useMusicStore.getState().togglePanel(false);
                    return;
                }

                // 4. Music Hub Navigation (Internal)
                if (pathname === '/listen-together' && activeSection !== 'home') {
                    console.log('[BackButton] Returning to Music Home');
                    useMusicStore.getState().setActiveSection('home');
                    return;
                }

                // 5. Active Chat Screen (Mobile)
                if (activeChatId && pathname.includes('/chat/')) {
                    console.log('[BackButton] Closing active chat');
                    useChatStore.getState().clearActiveChat();
                    navigate('/', { replace: true });
                    return;
                }

                // 6. Generic Navigation Back
                if (canGoBack || window.history.length > 1) {
                    console.log('[BackButton] Standard navigate back');
                    navigate(-1);
                } else {
                    // 7. Home Screen - Double Back to Exit
                    const now = Date.now();
                    if (now - lastBackPressTime.current < 2000) {
                        console.log('[BackButton] Exiting app');
                        App.exitApp();
                    } else {
                        lastBackPressTime.current = now;
                        toast('Press back again to exit', {
                            id: 'exit-toast',
                            position: 'bottom-center',
                            duration: 2000,
                            style: {
                                background: '#333',
                                color: '#fff',
                                borderRadius: '50px',
                                fontSize: '14px'
                            }
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
