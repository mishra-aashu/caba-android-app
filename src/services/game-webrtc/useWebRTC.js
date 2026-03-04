import { useEffect, useRef, useState, useCallback } from 'react';
import WebRTCManager from './WebRTCManager';

export const useWebRTC = (roomId, userId, onDataReceived) => {
    const [status, setStatus] = useState('initializing');
    const [isConnected, setIsConnected] = useState(false);
    const managerRef = useRef(null);
    const onDataReceivedRef = useRef(onDataReceived);

    useEffect(() => {
        onDataReceivedRef.current = onDataReceived;
    }, [onDataReceived]);

    useEffect(() => {
        if (!roomId || !userId) return;

        const handleMessage = (from, data) => {
            console.log(`[useWebRTC] Data received from ${from}:`, data);
            if (onDataReceivedRef.current) onDataReceivedRef.current(from, data);
        };

        const handleStatusChange = (newStatus) => {
            setStatus(newStatus);
            if (newStatus === 'SUBSCRIBED') {
                setIsConnected(true);
            }
        };

        const manager = new WebRTCManager(roomId, userId, handleMessage, handleStatusChange);
        managerRef.current = manager;

        const init = async () => {
            await manager.initialize();
        };

        init();

        return () => {
            console.log(`[useWebRTC] Cleaning up for room ${roomId}`);
            manager.cleanup();
            managerRef.current = null;
            setIsConnected(false);
        };
    }, [roomId, userId, onDataReceived]);

    const connectToPeer = useCallback((remoteUserId) => {
        if (managerRef.current) {
            managerRef.current.connectToPeer(remoteUserId);
        }
    }, []);

    const sendData = useCallback((data) => {
        if (managerRef.current) {
            managerRef.current.sendData(data);
        }
    }, []);

    return {
        status,
        isConnected,
        connectToPeer,
        sendData
    };
};
