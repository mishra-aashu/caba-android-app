/**
 * useGroupActions - Custom hook for Group Chat actions
 * Handles create, leave, add/remove member operations
 */

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

/**
 * Hook for group-related actions
 * @param {string} groupId - Optional group ID for single group operations
 * @returns {Object} - Group actions and state
 */
export const useGroupActions = (groupId) => {
  const queryClient = useQueryClient();

  // Query: Get user's groups
  const useUserGroups = (userId) => {
    return useQuery({
      queryKey: ['userGroups', userId],
      queryFn: () => getUserGroups(userId),
      enabled: !!userId,
      staleTime: 1000 * 60 * 5, // 5 minutes
    });
  };

  // Query: Get single group details
  const useGroup = (id) => {
    return useQuery({
      queryKey: ['group', id],
      queryFn: () => getGroupById(id),
      enabled: !!id,
      staleTime: 1000 * 60 * 5,
    });
  };

  // Query: Get group members
  const useGroupMembers = (id) => {
    return useQuery({
      queryKey: ['groupMembers', id],
      queryFn: () => getGroupMembers(id),
      enabled: !!id,
      staleTime: 1000 * 60 * 5, // 5 minutes
    });
  };

  // Query: Get user's role in a group
  const useUserRole = (gId, userId) => {
    return useQuery({
      queryKey: ['userRole', gId, userId],
      queryFn: () => getUserRole(gId, userId),
      enabled: !!gId && !!userId,
      staleTime: 1000 * 60 * 5,
    });
  };

  // Query: Check if user is admin
  const useIsAdmin = (gId, userId) => {
    return useQuery({
      queryKey: ['isAdmin', gId, userId],
      queryFn: () => isUserAdmin(gId, userId),
      enabled: !!gId && !!userId,
      staleTime: 1000 * 60 * 5,
    });
  };

  // Mutation: Create new group
  const useCreateGroup = () => {
    return useMutation({
      mutationFn: async ({ name, description, avatarFile, createdBy, memberIds }) => {
        // Pass avatarFile to createGroup - it handles upload internally
        return createGroup({
          name,
          description,
          avatarFile,
          createdBy,
          memberIds,
        });
      },
      onSuccess: (data) => {
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

  // Mutation: Add members to group
  const useAddMembers = () => {
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

  // Mutation: Remove member from group
  const useRemoveMember = () => {
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

  // Mutation: Make member admin
  const useMakeAdmin = () => {
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

  // Mutation: Demote admin to member
  const useDemoteAdmin = () => {
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

  // Mutation: Leave group
  const useLeaveGroup = () => {
    return useMutation({
      mutationFn: async ({ groupId, userId }) => {
        await leaveGroup(groupId, userId);
      },
      onSuccess: (_, variables, context) => {
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

  // Mutation: Update group
  const useUpdateGroup = () => {
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

  return {
    // Queries
    useUserGroups,
    useGroup,
    useGroupMembers,
    useUserRole,
    useIsAdmin,
    // Mutations
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
