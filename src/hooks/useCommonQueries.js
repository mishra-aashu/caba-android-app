/**
 * useCommonQueries — Reusable TanStack Query hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../config/supabase';
import toast from 'react-hot-toast';
import { safeDbConversion, dbToFrontend } from '../utils/dbFieldMapping';
import useUserStore from '../store/userStore';
import { createGroup, addGroupMembers, leaveGroup } from '../services/groupService';
import { addToSyncQueue, db } from '../db/db';

// ==========================================
// USER QUERIES
// ==========================================

const fetchUserById = async (userId) => {
  if (!userId) return null;

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) throw error;
  return dbToFrontend(data);
};

/**
 * Hook to get user profile with caching
 */
export const useUser = (userId) => {
  const storeUser = useUserStore((state) => state.users[userId]);
  const fetchIfNeeded = useUserStore((state) => state.fetchUserIfNeeded);

  return useQuery({
    queryKey: ['user', userId],
    queryFn: async () => {
      const cached = useUserStore.getState().getUser(userId);
      if (cached) return cached;
      return await fetchIfNeeded(userId);
    },
    initialData: storeUser,
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
};

/**
 * Fetch user's contacts
 */
const fetchContacts = async (userId) => {
  if (!userId) return [];

  const { data, error } = await supabase
    .from('contacts')
    .select(`
      *,
      contact_user:contact_user_id (
        id,
        name,
        avatar,
        phone,
        is_online,
        last_seen
      )
    `)
    .eq('user_id', userId)
    .order('contact_name', { ascending: true });

  if (error) throw error;
  return safeDbConversion(data || []);
};

export const useContacts = (userId) => {
  return useQuery({
    queryKey: ['contacts', userId],
    queryFn: () => fetchContacts(userId),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
  });
};

// ==========================================
// CHAT QUERIES
// ==========================================

const fetchChatById = async (chatId) => {
  if (!chatId) return null;

  const { data, error } = await supabase
    .from('chats')
    .select('*')
    .eq('id', chatId)
    .single();

  if (error) throw error;
  return dbToFrontend(data);
};

export const useChat = (chatId) => {
  return useQuery({
    queryKey: ['chat', chatId],
    queryFn: () => fetchChatById(chatId),
    enabled: !!chatId,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
  });
};

// ==========================================
// GROUP MUTATIONS
// ==========================================

export const useCreateGroup = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ name, description, avatarFile, createdBy, memberIds }) => {
      return createGroup({ name, description, avatarFile, createdBy, memberIds });
    },
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ['userGroups', variables.createdBy] });

      const previousGroups = queryClient.getQueryData(['userGroups', variables.createdBy]);

      const optimisticGroup = {
        group_id: `temp_${Date.now()}`,
        group: {
          id: `temp_${Date.now()}`,
          name: variables.name,
          avatar_url: null,
          description: variables.description || null,
          created_by: variables.createdBy,
          created_at: new Date().toISOString(),
        },
        role: 'admin',
        joined_at: new Date().toISOString(),
      };

      queryClient.setQueryData(['userGroups', variables.createdBy], (old) => {
        return old ? [optimisticGroup, ...old] : [optimisticGroup];
      });

      return { previousGroups };
    },
    onError: (err, variables, context) => {
      if (context?.previousGroups) {
        queryClient.setQueryData(['userGroups', variables.createdBy], context.previousGroups);
      }
      toast.error('Failed to create group');
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['userGroups', variables.createdBy] });
      queryClient.invalidateQueries({ queryKey: ['chatList'] });
      toast.success('Group created successfully!');
    },
  });
};

export const useAddGroupMembers = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ groupId, memberIds }) => {
      return addGroupMembers(groupId, memberIds);
    },
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ['groupMembers', variables.groupId] });
      const previousMembers = queryClient.getQueryData(['groupMembers', variables.groupId]);
      return { previousMembers };
    },
    onError: (err, variables, context) => {
      if (context?.previousMembers) {
        queryClient.setQueryData(['groupMembers', variables.groupId], context.previousMembers);
      }
      toast.error('Failed to add members');
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['groupMembers', variables.groupId] });
      queryClient.invalidateQueries({ queryKey: ['chatList'] });
      toast.success('Members added successfully!');
    },
  });
};

export const useLeaveGroup = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ groupId, userId }) => {
      return leaveGroup(groupId, userId);
    },
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ['userGroups', variables.userId] });
      const previousGroups = queryClient.getQueryData(['userGroups', variables.userId]);

      queryClient.setQueryData(['userGroups', variables.userId], (old) => {
        return old ? old.filter((g) => g.group_id !== variables.groupId) : [];
      });

      return { previousGroups };
    },
    onError: (err, variables, context) => {
      if (context?.previousGroups) {
        queryClient.setQueryData(['userGroups', variables.userId], context.previousGroups);
      }
      toast.error('Failed to leave group');
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['userGroups', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['chatList'] });
      toast.success('Left the group');
    },
  });
};

// ==========================================
// SEND MESSAGE WITH OPTIMISTIC UPDATE
// ==========================================

export const useSendMessage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      chatId, senderId, receiverId, content, mediaPath,
      mediaType, isGroupMessage, vanishAt, tempId,
    }) => {
      let message_type = 'text';
      if (mediaType === 'image') message_type = 'image';
      else if (mediaType === 'video') message_type = 'video';
      else if (mediaType === 'voice' || mediaType === 'audio') message_type = 'audio';
      else if (mediaType === 'document') message_type = 'document';

      const messageData = {
        chat_id: chatId,
        sender_id: senderId,
        receiver_id: receiverId,
        content,
        media_path: mediaPath,
        media_type: mediaType,
        message_type,
        is_group_message: isGroupMessage || false,
        vanish_at: vanishAt,
        status: navigator.onLine ? 'sending' : 'pending',
        created_at: new Date().toISOString(),
        client_id: String(tempId),
      };

      try {
        if (!navigator.onLine) {
          // FIX: Use .put() to avoid duplicate key errors
          await db.messages.put({
            ...messageData,
            id: `temp_${tempId}`,
            tempId,
          });
          await addToSyncQueue('send_message', { ...messageData, tempId });
          return { ...dbToFrontend(messageData), tempId, is_pending: true };
        }

        const { data, error } = await supabase
          .from('messages')
          .insert(messageData)
          .select()
          .single();

        if (error) throw error;

        const confirmed = dbToFrontend(data);

        // FIX: Reconcile local DB
        await db.messages.delete(`temp_${tempId}`).catch(() => { });
        await db.messages.put(data);

        return { ...confirmed, tempId };
      } catch (err) {
        console.error('Error in useSendMessage mutation:', err);
        throw err;
      }
    },

    onMutate: async (variables) => {
      const queryKey = ['messages', variables.chatId];
      await queryClient.cancelQueries({ queryKey });
      const previousMessages = queryClient.getQueryData(queryKey);

      // FIX: Use camelCase field names to match converted data in cache
      const optimisticMessage = {
        id: `temp_${variables.tempId}`,
        tempId: variables.tempId,
        chatId: variables.chatId,
        senderId: variables.senderId,
        content: variables.content,
        mediaPath: variables.mediaPath,
        mediaType: variables.mediaType,
        createdAt: new Date().toISOString(),
        created_at: new Date().toISOString(),
        status: navigator.onLine ? 'sending' : 'pending',
        sender: { id: variables.senderId },
      };

      queryClient.setQueryData(queryKey, (old) => {
        if (old?.pages) {
          const newPages = [...old.pages];
          newPages[0] = {
            ...newPages[0],
            data: [optimisticMessage, ...newPages[0].data],
          };
          return { ...old, pages: newPages };
        }
        return old ? [...old, optimisticMessage] : [optimisticMessage];
      });

      return { previousMessages, queryKey };
    },

    // FIX: Add onSuccess to reconcile optimistic → real message
    onSuccess: (data, variables, context) => {
      if (!data || data.is_pending) return;

      const queryKey = context?.queryKey || ['messages', variables.chatId];

      queryClient.setQueryData(queryKey, (old) => {
        if (!old) return old;

        if (old.pages) {
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              data: page.data.map((msg) =>
                msg.tempId === variables.tempId
                  ? { ...data, sender: msg.sender }
                  : msg
              ),
            })),
          };
        }
        return old;
      });
    },

    onError: (err, variables, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData(context.queryKey, context.previousMessages);
      }
      if (navigator.onLine) {
        toast.error('Failed to send message');
      }
    },

    onSettled: (_, error, variables) => {
      if (error) {
        queryClient.invalidateQueries({ queryKey: ['messages', variables.chatId] });
      }
    },
  });
};

// ==========================================
// PREFETCHING
// ==========================================

export const usePrefetch = () => {
  const queryClient = useQueryClient();

  const prefetchUser = (userId) => {
    queryClient.prefetchQuery({
      queryKey: ['user', userId],
      queryFn: () => fetchUserById(userId),
      staleTime: 1000 * 60 * 2,
    });
  };

  const prefetchChat = (chatId) => {
    queryClient.prefetchQuery({
      queryKey: ['chat', chatId],
      queryFn: () => fetchChatById(chatId),
      staleTime: 1000 * 60 * 2,
    });
  };

  const prefetchContacts = (userId) => {
    queryClient.prefetchQuery({
      queryKey: ['contacts', userId],
      queryFn: () => fetchContacts(userId),
      staleTime: 1000 * 60 * 2,
    });
  };

  return { prefetchUser, prefetchChat, prefetchContacts };
};

// ==========================================
// INVALIDATION HELPERS
// ==========================================

export const useInvalidateQueries = () => {
  const queryClient = useQueryClient();

  const invalidateChatList = (userId) => {
    queryClient.invalidateQueries({ queryKey: ['chatList', userId] });
    queryClient.invalidateQueries({ queryKey: ['userGroups', userId] });
  };

  const invalidateMessages = (chatId) => {
    queryClient.invalidateQueries({ queryKey: ['messages', chatId] });
  };

  return { invalidateChatList, invalidateMessages };
};

// ==========================================
// CONTACT MUTATIONS
// ==========================================

export const useAddContact = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, contactUserId, contactName }) => {
      const { data: existing, error: fetchError } = await supabase
        .from('contacts')
        .select('id')
        .eq('user_id', userId)
        .eq('contact_user_id', contactUserId)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (existing) {
        toast.error('Contact already exists');
        return existing;
      }

      const { data, error } = await supabase
        .from('contacts')
        .insert([
          {
            user_id: userId,
            contact_user_id: contactUserId,
            contact_name: contactName,
          },
        ])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['contacts', variables.userId] });
      toast.success('Contact added successfully!');
    },
    onError: (error) => {
      console.error('Error adding contact:', error);
      toast.error('Failed to add contact');
    },
  });
};