import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSupabase } from '../../contexts/SupabaseContext';
import { db, addToSyncQueue } from '../../db/db';
import { dbToFrontend } from '../../utils/dbFieldMapping';
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
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    const handleSendMedia = useCallback(async (mediaPathOrFile, mediaType, vanishAt = null) => {
        if (!mediaPathOrFile || !currentUser) return;

        const isFile = mediaPathOrFile instanceof File || mediaPathOrFile instanceof Blob;
        const mediaPath = isFile ? null : mediaPathOrFile;
        const localFile = isFile ? mediaPathOrFile : null;
        const tempId = Date.now();

        const content = mediaType === 'image' ? '📷 Photo'
            : mediaType === 'video' ? '🎥 Video'
                : '🎤 Voice Message';

        const dbData = {
            chat_id: chatId,
            sender_id: currentUser.id,
            receiver_id: isGroupChat ? null : otherUserId,
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
        const optimisticMsg = {
            ...dbToFrontend(dbData),
            sender: currentUser,
            tempId,
            media_url: objectUrl || (mediaPath ? (mediaPath.startsWith('http') ? mediaPath : getPublicMediaUrl(mediaPath)) : null)
        };

        // Optimistic Update
        queryClient.setQueryData(['messages', chatId], (old) => {
            if (!old) return { pages: [{ data: [optimisticMsg], nextCursor: null }], pageParams: [null] };
            return {
                ...old,
                pages: old.pages.map((page, i) =>
                    i === 0 ? { ...page, data: [optimisticMsg, ...page.data] } : page
                ),
            };
        });

        setReplyingTo?.(null);
        hapticsManager.impact();

        try {
            await db.messages.add({
                ...dbData,
                id: `temp_media_${tempId}`,
                tempId: tempId
            });

            if (navigator.onLine && !localFile) {
                const { data, error } = await supabase
                    .from('messages')
                    .insert(dbData)
                    .select()
                    .single();

                if (error) throw error;
                if (!data) throw new Error('Blocked by RLS');

                const finalMsg = { ...dbToFrontend(data), status: 'sent', sender: currentUser };

                if (isNewChat) {
                    queryClient.setQueryData(['messages', data.chat_id], {
                        pages: [{ data: [finalMsg], nextCursor: null }],
                        pageParams: [null]
                    });
                    navigate(`/chat/${data.chat_id}/${otherUserId}`, { replace: true });
                    return;
                }

                // Replace optimistic
                queryClient.setQueryData(['messages', chatId], (old) => {
                    if (!old) return old;
                    return {
                        ...old,
                        pages: old.pages.map(page => ({
                            ...page,
                            data: page.data.map(msg => {
                                if (msg.tempId === tempId) {
                                    // Revoke blob URL to prevent leak
                                    if (msg.media_url?.startsWith('blob:')) URL.revokeObjectURL(msg.media_url);
                                    return finalMsg;
                                }
                                return msg;
                            })
                        }))
                    };
                });

                await db.transaction('rw', db.messages, async () => {
                    await db.messages.delete(`temp_media_${tempId}`);
                    await db.messages.add(data);
                });
            } else {
                await addToSyncQueue('send_message', { ...dbData, tempId, file: localFile });
                toast.success(localFile ? 'Media queued for upload' : 'Media queued for sync');
            }
        } catch (error) {
            console.error('Media send failed:', error);
            if (objectUrl) URL.revokeObjectURL(objectUrl);
            hapticsManager.error();
            toast.error('Failed to send media');
        }
    }, [chatId, otherUserId, isGroupChat, currentUser, replyingTo, supabase, queryClient, navigate, isNewChat, setReplyingTo]);

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

    return {
        handleSendMedia,
        handleMediaDownload,
    };
}
