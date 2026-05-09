import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import useMusicStore from '../store/useMusicStore';
import useChatStore from '../store/useChatStore';

/**
 * useBackButton Hook
 * Handles the Android hardware back button to provide a native-like experience.
 * Priority:
 * 1. Minimize Fullscreen Music Player
 * 2. Close Active Chat (Mobile)
 * 3. Navigate back in Music Hub sections
 * 4. Standard browser/app back navigation
 */
export const useBackButton = () => {
    const navigate = useNavigate();
    const location = useLocation();
    
    const { 
        isPlayerExpanded, 
        setIsPlayerExpanded, 
        activeSection, 
        setActiveSection 
    } = useMusicStore();
    
    const { activeChatId, setActiveChat } = useChatStore();

    useEffect(() => {
        if (!Capacitor.isNativePlatform()) return;

        let backListener;

        const setupListener = async () => {
            const { App } = await import('@capacitor/app');
            
            backListener = await App.addListener('backButton', ({ canGoBack }) => {
                console.log('[BackButton] Back button pressed. canGoBack:', canGoBack);

                // 1. If Music Player is expanded, minimize it
                if (isPlayerExpanded) {
                    console.log('[BackButton] Minimizing player');
                    setIsPlayerExpanded(false);
                    return;
                }

                // 2. If in a specific Music Hub section, go back to Home
                if (location.pathname === '/listen-together') {
                    if (activeSection !== 'home') {
                        console.log('[BackButton] Returning to Music Home');
                        setActiveSection('home');
                        return;
                    }
                }

                // 3. If in a chat on mobile, close it
                if (activeChatId && !/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
                    console.log('[BackButton] Closing active chat');
                    setActiveChat(null);
                    return;
                }

                // 4. Standard navigation back
                if (canGoBack) {
                    window.history.back();
                } else {
                    // If no history, maybe exit or do nothing
                    // App.exitApp(); // Optional: uncomment to exit app on double back
                }
            });
        };

        setupListener();

        return () => {
            if (backListener) {
                backListener.remove();
            }
        };
    }, [
        isPlayerExpanded, 
        setIsPlayerExpanded, 
        activeSection, 
        setActiveSection, 
        activeChatId, 
        setActiveChat, 
        location.pathname
    ]);
};
