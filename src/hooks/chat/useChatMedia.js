import { useCallback, useRef, useMemo } from 'react';
import { useSupabase } from '../../contexts/SupabaseContext';
import { db, addToSyncQueue } from '../../db/db';
import { getPublicMediaUrl } from '../../services/mediaService';
import { saveImageToDevice } from '../../utils/FileSystemManager';
import toast from 'react-hot-toast';
import hapticsManager from '../../utils/hapticsManager';
import { useNavigate } from 'react-router-dom';

/**
 * useChatMedia
 *
 * Handles media-specific operations:
 * - Sending Images, Videos, Voice messages
 * - Downloading media to device
 * - Managing object URL lifecycles
 */
export function useChatMedia({
    chatId,
    otherUserId,
    isGroupChat,
    currentUser,
    isNewChat,
    setReplyingTo,
    replyingTo,
}) {
    const { supabase } = useSupabase();
    const navigate = useNavigate();

    // [FIX #4] Track object URLs for cleanup to prevent memory leaks
    const activeObjectUrls = useRef(new Set());

    const handleSendMedia = useCallback(async (mediaPathOrFile, mediaType, vanishAt = null) => {
        if (!mediaPathOrFile || !currentUser) return;

        const isFile = mediaPathOrFile instanceof File || mediaPathOrFile instanceof Blob;
        const mediaPath = isFile ? null : mediaPathOrFile;
        const localFile = isFile ? mediaPathOrFile : null;
        const tempId = String(Date.now());

        const content = mediaType === 'image' ? '📷 Photo'
            : mediaType === 'video' ? '🎥 Video'
                : '🎤 Voice Message';

        // [FIX #2] Group messages: use sender as receiver placeholder
        // Previously receiver_id was null for groups on online path
        // This caused RLS/schema violation on Supabase insert
        const dbData = {
            chat_id: chatId,
            sender_id: currentUser.id,
            receiver_id: isGroupChat ? currentUser.id : otherUserId,
            content: content,
            media_path: mediaPath,
            media_type: mediaType,
            message_type: mediaType === 'voice' ? 'audio' : mediaType,
            reply_to: replyingTo?.id || null,
            is_group_message: Boolean(isGroupChat),
            vanish_at: vanishAt,
            status: navigator.onLine ? 'sending' : 'pending',
            created_at: new Date().toISOString(),
            client_id: tempId,
        };

        const objectUrl = localFile ? URL.createObjectURL(localFile) : null;

        // [FIX #4] Track for cleanup
        if (objectUrl) {
            activeObjectUrls.current.add(objectUrl);
        }

        setReplyingTo?.(null);
        hapticsManager.impact();

        try {
            const { safeDbConversion } = await import('../../utils/dbFieldMapping');
            const normalizedDbData = safeDbConversion(dbData);

            // Optimistic update in Dexie
            await db.messages.put({
                ...normalizedDbData,
                id: `temp_${tempId}`,
                tempId: tempId,
                // objectUrl for immediate display — NOT sent to Supabase
                mediaUrl: objectUrl || (mediaPath
                    ? (mediaPath.startsWith('http') ? mediaPath : getPublicMediaUrl(mediaPath))
                    : null
                ),
            });

            if (navigator.onLine && !localFile) {
                // ── Online + URL-based media (GIFs, forwarded media) ──
                const { data, error } = await supabase
                    .from('messages')
                    .insert(dbData)
                    .select()
                    .single();

                if (error) throw error;
                if (!data) throw new Error('Blocked by RLS');

                const normalizedData = safeDbConversion(data);

                await db.transaction('rw', db.messages, async () => {
                    await db.messages.delete(`temp_${tempId}`).catch(() => {});
                    await db.messages.put(normalizedData);
                });

                if (isNewChat && data.chat_id) {
                    navigate(`/chat/${data.chat_id}/${otherUserId}`, { replace: true });
                }
            } else {
                // Offline OR file that needs uploading
                let syncPayload = { ...dbData, tempId };

                if (localFile) {
                    try {
                        const arrayBuffer = await localFile.arrayBuffer();
                        syncPayload.fileData = arrayBuffer;
                        
                        // Ensure we have a valid filename with extension for storage
                        const ext = (localFile.name && localFile.name.includes('.')) 
                            ? localFile.name.split('.').pop() 
                            : (mediaType === 'voice' ? 'webm' : 'bin');
                            
                        syncPayload.fileName = localFile.name || `media_${tempId}.${ext}`;
                        syncPayload.fileType = localFile.type || 'application/octet-stream';
                    } catch (serializeErr) {
                        console.error('Failed to serialize file for sync queue:', serializeErr);
                        throw new Error('Could not prepare media for offline send');
                    }
                }

                const { queueAction, QUEUE_ACTIONS } = await import('../../services/offlineQueue');
                await queueAction(QUEUE_ACTIONS.INSERT_MESSAGE, 'messages', syncPayload);

                if (!navigator.onLine) {
                    toast.success('Message queued for sync');
                } else if (localFile) {
                    // Online but needs upload — trigger sync to start upload
                    window.dispatchEvent(new Event('online'));
                }
            }
        } catch (error) {
            console.error('Media send failed:', error);

            // [FIX #4] Clean up object URL on error
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
                activeObjectUrls.current.delete(objectUrl);
            }

            hapticsManager.error();
            toast.error('Failed to send media');

            // Clean up temporary message
            await db.messages.delete(`temp_${tempId}`).catch(() => {});
        }
    }, [chatId, otherUserId, isGroupChat, currentUser, replyingTo, supabase, navigate, isNewChat, setReplyingTo]);

    const handleMediaDownload = useCallback(async (mediaUrl, messageId) => {
        try {
            const savedPath = await saveImageToDevice(mediaUrl, messageId || Date.now());
            toast.success('Saved to device');
            return savedPath;
        } catch (error) {
            console.error('Download error:', error);
            toast.error('Failed to save to device');
        }
    }, []);

    return useMemo(() => ({
        handleSendMedia,
        handleMediaDownload,
    }), [handleSendMedia, handleMediaDownload]);
}