import { supabase } from '../config/supabase';

class GroupCallService {
  // Get active group call
  async getActiveGroupCall(groupId) {
    try {
      const { data, error } = await supabase
        .from('calls')
        .select(`
          *,
          group_call_participants (
            user_id,
            participant_role,
            is_muted,
            is_video_enabled,
            is_screen_sharing,
            joined_at
          )
        `)
        .eq('group_id', groupId)
        .eq('is_group_call', true)
        .in('status', ['initiated', 'connected'])
        .maybeSingle();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error getting active group call:', error);
      return null;
    }
  }

  // Create new group call
  async createGroupCall(groupId, hostId, callType, settings = {}) {
    try {
      const { data, error } = await supabase
        .from('calls')
        .insert({
          group_id: groupId,
          caller_id: hostId,
          host_id: hostId,
          call_type: callType,
          status: 'initiated',
          is_group_call: true,
          room_id: `group_${groupId}_${Date.now()}`,
          call_participants: [],
          max_participants: settings.maxParticipants || 50,
          recording_enabled: settings.recordingEnabled || false,
          screen_sharing_enabled: settings.screenSharingEnabled !== false
        })
        .select()
        .single();

      if (error) throw error;

      // Add host as first participant
      await this.addParticipant(data.id, hostId, 'host');

      return data;
    } catch (error) {
      console.error('Error creating group call:', error);
      throw error;
    }
  }

  // Join existing group call
  async joinGroupCall(callId, userId) {
    try {
      // Check if user is already a participant
      const { data: existingParticipant } = await supabase
        .from('group_call_participants')
        .select('*')
        .eq('call_id', callId)
        .eq('user_id', userId)
        .single();

      if (existingParticipant) {
        // Rejoin if left_at is set
        if (existingParticipant.left_at) {
          await supabase
            .from('group_call_participants')
            .update({ left_at: null })
            .eq('call_id', callId)
            .eq('user_id', userId);
        }
        return existingParticipant;
      }

      // Add new participant
      return await this.addParticipant(callId, userId, 'participant');
    } catch (error) {
      console.error('Error joining group call:', error);
      throw error;
    }
  }

  // Add participant to call
  async addParticipant(callId, userId, role = 'participant') {
    try {
      const { data, error } = await supabase
        .from('group_call_participants')
        .insert({
          call_id: callId,
          user_id: userId,
          participant_role: role,
          is_muted: false,
          is_video_enabled: true,
          is_screen_sharing: false
        })
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error adding participant:', error);
      throw error;
    }
  }

  // Leave group call
  async leaveGroupCall(callId, userId) {
    try {
      const { error } = await supabase
        .from('group_call_participants')
        .update({ left_at: new Date().toISOString() })
        .eq('call_id', callId)
        .eq('user_id', userId);

      if (error) throw error;

      // Check if this was the last participant
      const { data: remainingParticipants } = await supabase
        .from('group_call_participants')
        .select('user_id')
        .eq('call_id', callId)
        .is('left_at', null);

      // If no participants left, end the call
      if (!remainingParticipants || remainingParticipants.length === 0) {
        await this.endGroupCall(callId);
      }

      return true;
    } catch (error) {
      console.error('Error leaving group call:', error);
      throw error;
    }
  }

  // End group call
  async endGroupCall(callId) {
    try {
      const { error } = await supabase
        .from('calls')
        .update({
          status: 'ended',
          ended_at: new Date().toISOString()
        })
        .eq('id', callId);

      if (error) throw error;

      // Mark all participants as left
      await supabase
        .from('group_call_participants')
        .update({ left_at: new Date().toISOString() })
        .eq('call_id', callId)
        .is('left_at', null);

      return true;
    } catch (error) {
      console.error('Error ending group call:', error);
      throw error;
    }
  }

  // Update participant status
  async updateParticipantStatus(callId, userId, updates) {
    try {
      const { error } = await supabase
        .from('group_call_participants')
        .update(updates)
        .eq('call_id', callId)
        .eq('user_id', userId);

      if (error) throw error;

      return true;
    } catch (error) {
      console.error('Error updating participant status:', error);
      throw error;
    }
  }

  // Get call participants
  async getCallParticipants(callId) {
    try {
      const { data, error } = await supabase
        .from('group_call_participants')
        .select(`
          *,
          users (
            id,
            name,
            avatar
          )
        `)
        .eq('call_id', callId)
        .is('left_at', null)
        .order('joined_at', { ascending: true });

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error getting call participants:', error);
      return [];
    }
  }

  // Send WebRTC signal
  async sendWebRTCSignal(fromUserId, toUserId, callId, groupId, signalType, signalData, roomId) {
    try {
      const { error } = await supabase
        .from('webrtc_signals')
        .insert({
          from_user_id: fromUserId,
          to_user_id: toUserId,
          call_id: callId,
          group_id: groupId,
          signal_type: signalType,
          signal_data: signalData,
          room_id: roomId,
          broadcast_type: 'room'
        });

      if (error) throw error;

      return true;
    } catch (error) {
      console.error('Error sending WebRTC signal:', error);
      throw error;
    }
  }

  // Get call history for group
  async getGroupCallHistory(groupId, limit = 10) {
    try {
      const { data, error } = await supabase
        .from('calls')
        .select(`
          *,
          group_call_participants (
            user_id,
            participant_role,
            joined_at,
            left_at
          ),
          caller:caller_id (
            name,
            avatar
          )
        `)
        .eq('group_id', groupId)
        .eq('is_group_call', true)
        .in('status', ['ended', 'missed'])
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error getting group call history:', error);
      return [];
    }
  }

  // Check if user can join call (permissions, max participants, etc.)
  async canJoinCall(callId, userId) {
    try {
      // Get call details
      const { data: call, error } = await supabase
        .from('calls')
        .select('*')
        .eq('id', callId)
        .single();

      if (error || !call) {
        return { canJoin: false, reason: 'Call not found' };
      }

      // Check if call is still active
      if (call.status !== 'connected' && call.status !== 'initiated') {
        return { canJoin: false, reason: 'Call is not active' };
      }

      // Check max participants
      const { data: activeParticipants } = await supabase
        .from('group_call_participants')
        .select('user_id')
        .eq('call_id', callId)
        .is('left_at', null);

      if (activeParticipants && activeParticipants.length >= call.max_participants) {
        return { canJoin: false, reason: 'Call is full' };
      }

      // Check if user is already in the call
      const existingParticipant = activeParticipants?.find(p => p.user_id === userId);
      if (existingParticipant) {
        return { canJoin: true, reason: 'Already in call' };
      }

      return { canJoin: true, reason: 'Can join' };
    } catch (error) {
      console.error('Error checking join permissions:', error);
      return { canJoin: false, reason: 'Error checking permissions' };
    }
  }

  // Toggle recording for call
  async toggleRecording(callId, enabled) {
    try {
      const { error } = await supabase
        .from('calls')
        .update({ recording_enabled: enabled })
        .eq('id', callId);

      if (error) throw error;

      return true;
    } catch (error) {
      console.error('Error toggling recording:', error);
      throw error;
    }
  }

  // Get call statistics
  async getCallStatistics(callId) {
    try {
      const { data, error } = await supabase
        .from('group_call_participants')
        .select(`
          participant_role,
          joined_at,
          left_at,
          is_muted,
          is_video_enabled,
          is_screen_sharing,
          users (
            name
          )
        `)
        .eq('call_id', callId);

      if (error) throw error;

      const stats = {
        totalParticipants: data?.length || 0,
        currentlyInCall: data?.filter(p => !p.left_at).length || 0,
        participantsByRole: {},
        averageDuration: 0,
        recordingEnabled: false
      };

      // Calculate role distribution
      data?.forEach(participant => {
        const role = participant.participant_role || 'participant';
        stats.participantsByRole[role] = (stats.participantsByRole[role] || 0) + 1;
      });

      // Calculate average duration
      const durations = data
        ?.filter(p => p.left_at)
        ?.map(p => {
          const start = new Date(p.joined_at);
          const end = new Date(p.left_at);
          return (end - start) / 1000; // Convert to seconds
        }) || [];

      if (durations.length > 0) {
        stats.averageDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      }

      return stats;
    } catch (error) {
      console.error('Error getting call statistics:', error);
      return null;
    }
  }
}

export const groupCallService = new GroupCallService();
export default groupCallService;
