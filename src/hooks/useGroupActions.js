import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createGroup,
  getGroupById,
  getGroupMembers,
  getUserRole,
  addGroupMembers,
  removeGroupMember,
  makeAdmin,
  demoteAdmin,
  leaveGroup,
  updateGroup,
  getUserGroups,
  uploadGroupAvatar,
  isUserAdmin,
} from '../services/groupService';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────────────────────────────────────
// Individual Hooks (Top-level for stability)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hook to get user's groups
 */
export const useUserGroups = (userId) => {
  return useQuery({
    queryKey: ['userGroups', userId],
    queryFn: async () => {
      const data = await getUserGroups(userId);
      if (data && data.length > 0) {
        try {
          const formatted = data.map(g => ({
            id: g.group_id,
            name: g.group?.name || 'Unnamed Group',
            avatar_url: g.group?.avatar_url,
            description: g.group?.description,
            member_count: g.group?.member_count || 0,
            role: g.role,
            created_at: g.group?.created_at,
            userId: userId
          }));
          const { db } = await import('../db/db');
          await db.groups.bulkPut(formatted);
        } catch (err) {
          console.error('[Sync] Groups sync failed:', err);
        }
      }
      return data;
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });
};

/**
 * Hook to get single group details
 */
export const useGroup = (id) => {
  return useQuery({
    queryKey: ['group', id],
    queryFn: () => getGroupById(id),
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
  });
};

/**
 * Hook to get group members
 */
export const useGroupMembers = (id) => {
  return useQuery({
    queryKey: ['groupMembers', id],
    queryFn: () => getGroupMembers(id),
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
  });
};

/**
 * Hook to get user role in group
 */
export const useUserRole = (gId, userId) => {
  return useQuery({
    queryKey: ['userRole', gId, userId],
    queryFn: () => getUserRole(gId, userId),
    enabled: !!gId && !!userId,
    staleTime: 1000 * 60 * 5,
  });
};

/**
 * Hook to check if user is group admin
 */
export const useIsAdmin = (gId, userId) => {
  return useQuery({
    queryKey: ['isAdmin', gId, userId],
    queryFn: () => isUserAdmin(gId, userId),
    enabled: !!gId && !!userId,
    staleTime: 1000 * 60 * 5,
  });
};

/**
 * Mutation hook to create group
 */
export const useCreateGroup = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, description, avatarFile, createdBy, memberIds }) => {
      return createGroup({ name, description, avatarFile, createdBy, memberIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userGroups'] });
      queryClient.invalidateQueries({ queryKey: ['chatList'] });
      toast.success('Group created successfully!');
    },
    onError: (error) => {
      console.error('Error creating group:', error);
      toast.error('Failed to create group');
    },
  });
};

/**
 * Mutation hook to add members
 */
export const useAddMembers = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ groupId, memberIds }) => {
      await addGroupMembers(groupId, memberIds);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['groupMembers', variables.groupId] });
      queryClient.invalidateQueries({ queryKey: ['chatList'] });
      toast.success('Members added successfully!');
    },
    onError: (error) => {
      console.error('Error adding members:', error);
      toast.error('Failed to add members');
    },
  });
};

/**
 * Mutation hook to remove member
 */
export const useRemoveMember = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ groupId, userId }) => {
      await removeGroupMember(groupId, userId);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['groupMembers', variables.groupId] });
      toast.success('Member removed');
    },
    onError: (error) => {
      console.error('Error removing member:', error);
      toast.error('Failed to remove member');
    },
  });
};

/**
 * Mutation hook to make admin
 */
export const useMakeAdmin = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ groupId, userId }) => {
      await makeAdmin(groupId, userId);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['groupMembers', variables.groupId] });
      queryClient.invalidateQueries({ queryKey: ['isAdmin', variables.groupId] });
      toast.success('Promoted to admin!');
    },
    onError: (error) => {
      console.error('Error making admin:', error);
      toast.error('Failed to promote to admin');
    },
  });
};

/**
 * Mutation hook to demote admin
 */
export const useDemoteAdmin = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ groupId, userId }) => {
      await demoteAdmin(groupId, userId);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['groupMembers', variables.groupId] });
      toast.success('Demoted to member');
    },
    onError: (error) => {
      console.error('Error demoting admin:', error);
      toast.error('Failed to demote');
    },
  });
};

/**
 * Mutation hook to leave group
 */
export const useLeaveGroup = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ groupId, userId }) => {
      await leaveGroup(groupId, userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userGroups'] });
      queryClient.invalidateQueries({ queryKey: ['chatList'] });
      toast.success('Left the group');
    },
    onError: (error) => {
      console.error('Error leaving group:', error);
      toast.error('Failed to leave group');
    },
  });
};

/**
 * Mutation hook to update group
 */
export const useUpdateGroup = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ groupId, updates }) => {
      await updateGroup(groupId, updates);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['group', variables.groupId] });
      toast.success('Group updated!');
    },
    onError: (error) => {
      console.error('Error updating group:', error);
      toast.error('Failed to update group');
    },
  });
};

/**
 * Legacy wrapper hook for backward compatibility
 */
export const useGroupActions = () => {
  return {
    useUserGroups,
    useGroup,
    useGroupMembers,
    useUserRole,
    useIsAdmin,
    useCreateGroup,
    useAddMembers,
    useRemoveMember,
    useMakeAdmin,
    useDemoteAdmin,
    useLeaveGroup,
    useUpdateGroup,
  };
};

export default useGroupActions;
