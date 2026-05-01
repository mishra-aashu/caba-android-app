import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCall } from '../../contexts/CallContext';
import { useGroupCall } from '../../contexts/GroupCallContext';
import { useDialog } from '../../contexts/DialogContext';
import groupCallService from '../../services/groupCallService';
import hapticsManager from '../../utils/hapticsManager';
import toast from 'react-hot-toast';

/**
 * useChatCalls
 * 
 * Logic for:
 * - One-to-one voice/video calls
 * - Group call management
 * - Active call detection
 */
export function useChatCalls({
    chatId,
    otherUserId,
    otherUser,
    isGroupChat,
    currentUser,
}) {
    const navigate = useNavigate();
    const { startCall } = useCall();
    const { initializeGroupCall, leaveGroupCall } = useGroupCall();
    const { showAlert } = useDialog();

    const [activeCallData, setActiveCallData] = useState(null);
    const [showGroupCallScreen, setShowGroupCallScreen] = useState(false);

    // Detect existing group call
    useEffect(() => {
        if (!isGroupChat || !chatId) {
            setActiveCallData(null);
            return;
        }

        const checkActiveCall = async () => {
            try {
                const activeCall = await groupCallService.getActiveGroupCall(chatId);
                if (activeCall) {
                    const isUserInCall = activeCall.group_call_participants?.some(
                        p => p.user_id === currentUser?.id && !p.left_at
                    );
                    setActiveCallData(!isUserInCall ? activeCall : null);
                } else {
                    setActiveCallData(null);
                }
            } catch (error) {
                console.error('Call check failed:', error);
            }
        };

        checkActiveCall();
        const interval = setInterval(checkActiveCall, 10000);
        return () => clearInterval(interval);
    }, [isGroupChat, chatId, currentUser?.id]);

    const handleStartGroupCall = useCallback(async (callType) => {
        try {
            setShowGroupCallScreen(true);
            await initializeGroupCall(chatId, callType);
        } catch (error) {
            hapticsManager.error();
            toast.error('Failed to start group call');
            setShowGroupCallScreen(false);
        }
    }, [chatId, initializeGroupCall]);

    const handleVoiceCall = useCallback(async () => {
        if (isGroupChat) {
            handleStartGroupCall('voice');
            return;
        }
        try {
            const { callId } = await startCall(otherUserId, 'voice');
            navigate(`/call/${callId}`);
        } catch (error) {
            showAlert('Failed to start call: ' + error.message);
        }
    }, [isGroupChat, otherUserId, startCall, navigate, showAlert, handleStartGroupCall]);

    const handleVideoCall = useCallback(async () => {
        if (isGroupChat) {
            handleStartGroupCall('video');
            return;
        }
        try {
            const { callId } = await startCall(otherUserId, 'video');
            navigate(`/call/${callId}`);
        } catch (error) {
            showAlert('Failed to start call: ' + error.message);
        }
    }, [isGroupChat, otherUserId, startCall, navigate, showAlert, handleStartGroupCall]);

    const handleEndGroupCall = useCallback(() => {
        leaveGroupCall();
        setShowGroupCallScreen(false);
    }, [leaveGroupCall]);

    return useMemo(() => ({
        activeGroupCall: activeCallData, // Rename for consistency with useChatRoom consumption
        showGroupCallScreen,
        setShowGroupCallScreen,
        handleVoiceCall,
        handleVideoCall,
        handleStartGroupCall,
        handleEndGroupCall,
    }), [activeCallData, showGroupCallScreen, handleVoiceCall, handleVideoCall, handleStartGroupCall, handleEndGroupCall]);
}
