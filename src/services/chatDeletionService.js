import { supabase } from '../config/supabase';

/**
 * Service to handle chat deletion logic
 */
export const chatDeletionService = {
  /**
   * Soft deletes a 1-on-1 chat for the current user.
   * If both participants have soft-deleted, it performs a hard delete.
   * 
   * @param {string} chatId - The ID of the chat to delete
   * @param {string} userId - The current user's ID
   */
  async deletePersonalChat(chatId, userId) {
    try {
      // 1. Get chat details to see who is user1 and who is user2
      const { data: chat, error: fetchError } = await supabase
        .from('chats')
        .select('user1_id, user2_id, deleted_by_user1, deleted_by_user2')
        .eq('id', chatId)
        .single();

      if (fetchError) throw fetchError;

      const isUser1 = chat.user1_id === userId;
      const isUser2 = chat.user2_id === userId;

      if (!isUser1 && !isUser2) {
        throw new Error('User is not a participant in this chat');
      }

      // 2. Perform soft delete
      const updateData = isUser1 
        ? { deleted_by_user1: true, deleted_at_user1: new Date().toISOString() }
        : { deleted_by_user2: true, deleted_at_user2: new Date().toISOString() };

      const { error: updateError } = await supabase
        .from('chats')
        .update(updateData)
        .eq('id', chatId);

      if (updateError) throw updateError;

      // 3. Check if both have deleted, if so hard delete
      const { data: updatedChat } = await supabase
        .from('chats')
        .select('deleted_by_user1, deleted_by_user2')
        .eq('id', chatId)
        .single();

      if (updatedChat?.deleted_by_user1 && updatedChat?.deleted_by_user2) {
        // Both participants deleted, we can safely remove the chat record
        // and messages. RLS/Cascade should handle messages usually, 
        // but it's cleaner to be explicit if needed.
        await supabase.from('chats').delete().eq('id', chatId);
      }

      return { success: true };
    } catch (error) {
      console.error('Error in deletePersonalChat:', error);
      return { success: false, error };
    }
  },

  /**
   * Leaves a group chat and marks it as deleted for the user.
   * 
   * @param {string} chatId - The ID of the group chat
   * @param {string} userId - The current user's ID
   */
  async leaveGroupChat(chatId, userId) {
    try {
      // 1. Add to chat_deletions table
      const { error: deletionError } = await supabase
        .from('chat_deletions')
        .upsert({
          chat_id: chatId,
          user_id: userId,
          deleted_at: new Date().toISOString(),
          is_group: true
        });

      if (deletionError) throw deletionError;

      // 2. Remove user from group_members if they want to leave
      // This part might depend on whether they "Delete" or "Leave".
      // Usually "Delete" group chat implies leaving it.
      const { error: memberError } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', chatId)
        .eq('user_id', userId);

      if (memberError) throw memberError;

      return { success: true };
    } catch (error) {
      console.error('Error in leaveGroupChat:', error);
      return { success: false, error };
    }
  },

  /**
   * Deletes multiple chats at once.
   */
  async deleteBulkChats(chatIds, userId) {
    const results = await Promise.all(
      chatIds.map(id => this.deletePersonalChat(id, userId))
    );
    return results;
  }
};
