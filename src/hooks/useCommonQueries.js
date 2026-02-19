/**
 * useCommonQueries - Reusable TanStack Query hooks for common data fetching
 * These hooks provide caching, deduplication, and offline support
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../config/supabase';
import toast from 'react-hot-toast';

// ==========================================
// USER QUERIES
// ==========================================

/**
 * Fetch user profile by ID
 */
const fetchUserById = async (userId) => {
  if (!userId) return null;

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) throw error;
  return data;
};

/**
 * Hook to get user profile with caching
 * Use this instead of fetching user in multiple components
 */
export const useUser = (userId) => {
  return useQuery({
    queryKey: ['user', userId],
    queryFn: () => fetchUserById(userId),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
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
  return data || [];
};

/**
 * Hook to get user's contacts with caching
 */
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
// CHAT/MESSAGE QUERIES
// ==========================================

/**
 * Fetch chat details
 */
const fetchChatById = async (chatId) => {
  if (!chatId) return null;

  const { data, error } = await supabase
    .from('chats')
    .select('*')
    .eq('id', chatId)
    .single();

  if (error) throw error;
  return data;
};

/**
 * Hook to get chat details with caching
 */
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
// GROUP QUERIES (Enhanced with optimistic updates)
// ==========================================

/**
 * Create group with optimistic updates
 */
export const useCreateGroup = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ name, description, avatarFile, createdBy, memberIds }) => {
      // Import dynamically to avoid circular deps
      const { createGroup } = await import('../services/groupService');
      return createGroup({ name, description, avatarFile, createdBy, memberIds });
    },
    // Optimistic update - immediately show the new group
    onMutate: async (variables) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['userGroups', variables.createdBy] });

      // Snapshot the previous value
      const previousGroups = queryClient.getQueryData(['userGroups', variables.createdBy]);

      // Optimistically add a placeholder group
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
      // Rollback on error
      if (context?.previousGroups) {
        queryClient.setQueryData(['userGroups', variables.createdBy], context.previousGroups);
      }
      toast.error('Failed to create group');
    },
    onSuccess: (data, variables) => {
      // Invalidate to get the real data
      queryClient.invalidateQueries({ queryKey: ['userGroups', variables.createdBy] });
      queryClient.invalidateQueries({ queryKey: ['chatList'] });
      toast.success('Group created successfully!');
    },
  });
};

/**
 * Add members with optimistic updates
 */
export const useAddGroupMembers = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ groupId, memberIds }) => {
      const { addGroupMembers } = await import('../services/groupService');
      return addGroupMembers(groupId, memberIds);
    },
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ['groupMembers', variables.groupId] });

      const previousMembers = queryClient.getQueryData(['groupMembers', variables.groupId]);

      // Add optimistic members (will be replaced by real data on success)
      // Note: This is a simplified version - real implementation would need user details

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

/**
 * Leave group with optimistic updates
 */
export const useLeaveGroup = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ groupId, userId }) => {
      const { leaveGroup } = await import('../services/groupService');
      return leaveGroup(groupId, userId);
    },
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ['userGroups', variables.userId] });

      const previousGroups = queryClient.getQueryData(['userGroups', variables.userId]);

      // Optimistically remove the group from list
      queryClient.setQueryData(['userGroups', variables.userId], (old) => {
        return old ? old.filter(g => g.group_id !== variables.groupId) : [];
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
// MESSAGE QUERIES WITH OPTIMISTIC UPDATES
// ==========================================

/**
 * Send message with optimistic updates for instant UI feel
 */
export const useSendMessage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ chatId, senderId, receiverId, content, mediaPath, mediaType, isGroupMessage }) => {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          chat_id: chatId,
          sender_id: senderId,
          receiver_id: receiverId,
          content,
          media_path: mediaPath,
          media_type: mediaType,
          is_group_message: isGroupMessage || false,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    // Optimistic update - immediately show message
    onMutate: async (variables) => {
      const queryKey = variables.isGroupMessage
        ? ['groupMessages', variables.chatId]
        : ['chatMessages', variables.chatId];

      await queryClient.cancelQueries({ queryKey });

      const previousMessages = queryClient.getQueryData(queryKey);

      const optimisticMessage = {
        id: `temp_${Date.now()}`,
        chat_id: variables.chatId,
        sender_id: variables.senderId,
        content: variables.content,
        media_path: variables.mediaPath,
        media_type: variables.mediaType,
        created_at: new Date().toISOString(),
        is_pending: true, // Mark as pending
        sender: {
          id: variables.senderId,
          // User details would be added from cache
        },
      };

      queryClient.setQueryData(queryKey, (old) => {
        return old ? [...old, optimisticMessage] : [optimisticMessage];
      });

      return { previousMessages, queryKey };
    },
    onError: (err, variables, context) => {
      // Remove optimistic message on error
      if (context?.previousMessages) {
        queryClient.setQueryData(context.queryKey, context.previousMessages);
      }
      toast.error('Failed to send message');
    },
    onSettled: (_, __, variables) => {
      // Sync with server
      const queryKey = variables.isGroupMessage
        ? ['groupMessages', variables.chatId]
        : ['chatMessages', variables.chatId];
      queryClient.invalidateQueries({ queryKey });
    },
  });
};

// ==========================================
// PREFETCHING HOOKS
// ==========================================

/**
 * Prefetch data when user hovers over items
 * Use this for file/folder previews
 */
export const usePrefetch = () => {
  const queryClient = useQueryClient();

  const prefetchUser = (userId) => {
    queryClient.prefetchQuery({
      queryKey: ['user', userId],
      queryFn: () => fetchUserById(userId),
      staleTime: 1000 * 60 * 2, // 2 minutes
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
// INVALIDATE HELPERS
// ==========================================

/**
 * Helper to invalidate common queries after updates
 */
export const useInvalidateQueries = () => {
  const queryClient = useQueryClient();

  const invalidateChatList = (userId) => {
    queryClient.invalidateQueries({ queryKey: ['chatList', userId] });
    queryClient.invalidateQueries({ queryKey: ['userGroups', userId] });
  };

  const invalidateMessages = (chatId, isGroup = false) => {
    const queryKey = isGroup ? ['groupMessages', chatId] : ['chatMessages', chatId];
    queryClient.invalidateQueries({ queryKey });
  };

  return { invalidateChatList, invalidateMessages };
};
