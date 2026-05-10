import { useEffect } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import useMusicStore from '../store/useMusicStore';

const CabaNative = registerPlugin('CabaNative');

/**
 * Hook to handle custom events from Native Android/Java
 */
export const useNativeEvents = () => {
    useEffect(() => {
        if (!Capacitor.isNativePlatform()) return;

        // 1. Handle Audio Focus
        const audioFocusListener = CabaNative.addListener('audioFocusChange', (data) => {
            const { value } = data;
            const { isPlaying, setIsPlaying } = useMusicStore.getState();

            if (value === 'pause' || value === 'duck') {
                if (isPlaying) {
                    // We don't call MusicPlayerService directly to avoid circular deps
                    // The store will trigger the service
                    setIsPlaying(false);
                }
            }
        });

        // 2. Handle Keyboard Visibility
        const keyboardOpenListener = CabaNative.addListener('keyboardOpened', (data) => {
            const { height } = JSON.parse(data.value || '{}');
            document.documentElement.style.setProperty('--keyboard-height', `${height}px`);
            document.body.classList.add('keyboard-open');
        });

        const keyboardCloseListener = CabaNative.addListener('keyboardClosed', () => {
            document.documentElement.style.setProperty('--keyboard-height', '0px');
            document.body.classList.remove('keyboard-open');
        });

        return () => {
            audioFocusListener.remove();
            keyboardOpenListener.remove();
            keyboardCloseListener.remove();
        };
    }, []);
};
