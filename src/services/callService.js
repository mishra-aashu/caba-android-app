import { supabase } from '../config/supabase';
import { realtimeManager } from '../utils/realtimeManager';

class CallService {

  // ==========================================
  // CALL HISTORY OPERATIONS
  // ==========================================

  /**
   * Create new call record
   */
  async createCall(callerId, receiverId, callId, callType = 'video') {
    const { data, error } = await supabase
      .from('call_history')
      .insert({
        caller_id: callerId,
        receiver_id: receiverId,
        call_id: callId,
        call_type: callType,
        call_status: 'initiated',
        started_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Update call status
   */
  async updateCallStatus(callId, status, additionalData = {}) {
    const updateData = {
      call_status: status,
      updated_at: new Date().toISOString(),
      ...additionalData
    };

    if (status === 'answered') {
      updateData.answered_at = new Date().toISOString();
    }

    if (['ended', 'missed', 'rejected', 'failed'].includes(status)) {
      updateData.ended_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('call_history')
      .update(updateData)
      .eq('call_id', callId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * End call with duration
   */
  async endCall(callId, duration) {
    const { data, error } = await supabase
      .from('call_history')
      .update({
        call_status: 'ended',
        call_duration: duration,
        ended_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('call_id', callId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Get all call history (for debugging)
   */
  async getAllCallHistory() {
    const { data, error } = await supabase
      .from('call_history')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error fetching all call history:', error);
      throw error;
    }
    return data;
  }

  /**
   * Get call history for user with pagination
   */
  async getCallHistory(userId, limit = 20, lastCallId = null) {
    try {
      console.log('getCallHistory called with userId:', userId, 'limit:', limit, 'lastCallId:', lastCallId);

      let query = supabase
        .from('call_history')
        .select('*')
        .or(`caller_id.eq.${userId},receiver_id.eq.${userId}`)
        .order('started_at', { ascending: false })
        .limit(limit);

      // If we have a lastCallId, fetch calls older than that
      if (lastCallId) {
        // Get the last call to use its timestamp for pagination
        const { data: lastCall } = await supabase
          .from('call_history')
          .select('started_at')
          .eq('id', lastCallId)
          .single();

        if (lastCall) {
          query = query.lt('started_at', lastCall.started_at);
        }
      }

      const { data: calls, error: callsError } = await query;

      if (callsError) {
        console.error('Error fetching calls:', callsError);
        throw callsError;
      }

      console.log('Raw calls from DB:', calls);

      if (!calls || calls.length === 0) {
        console.log('No calls found for user');
        return { calls: [], hasMore: false };
      }

      // Get all unique user IDs
      const userIds = [...new Set(calls.flatMap(call => [call.caller_id, call.receiver_id]))];

      // Fetch user details
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, name, avatar')
        .in('id', userIds);

      if (usersError) {
        console.error('Error fetching users:', usersError);
      }

      // Create a map of user details
      const userMap = {};
      if (users) {
        users.forEach(user => {
          userMap[user.id] = user;
        });
      }

      // Transform data with normalization
      const { safeDbConversion } = await import('../utils/dbFieldMapping');
      
      const transformedData = calls.map(call => {
        const normalized = safeDbConversion(call);
        const otherUserId = normalized.callerId === userId ? normalized.receiverId : normalized.callerId;
        const otherUser = userMap[otherUserId] || {};

        return {
          ...normalized,
          otherUserId, // CamelCase
          otherUserName: otherUser.name || 'Unknown',
          otherUserAvatar: otherUser.avatar || null
        };
      });

      console.log('Transformed data:', transformedData);

      // Return the calls and whether there are more
      const hasMore = calls.length === limit;
      const newLastCallId = calls.length > 0 ? calls[calls.length - 1].id : null;

      // [OFFLINE] Sync to Dexie
      const { db } = await import('../db/db');
      await db.transaction('rw', db.call_history, async () => {
        // If it's the first page, we might want to clear or just bulkPut
        // For now, bulkPut is safer.
        await db.call_history.bulkPut(transformedData.map(c => ({
            ...c,
            id: String(c.id) // Ensure ID is string for consistency
        })));
      });

      return {
        calls: transformedData,
        hasMore,
        lastCallId: newLastCallId
      };
    } catch (error) {
      console.error('Error in getCallHistory:', error);
      throw error;
    }
  }

  /**
   * Get missed calls count
   */
  async getMissedCallsCount(userId) {
    // Direct query instead of RPC function
    const { data, error } = await supabase
      .from('call_history')
      .select('id', { count: 'exact' })
      .eq('receiver_id', userId)
      .eq('call_status', 'missed');

    if (error) throw error;
    return data?.length || 0;
  }

  async getCallById(callId) {
    const { data, error } = await supabase
      .from('call_history')
      .select('*')
      .eq('call_id', callId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  /**
   * Get active incoming calls for user
   */
  async getIncomingCalls(userId) {
    const { data, error } = await supabase
      .from('call_history')
      .select('*')
      .eq('receiver_id', userId)
      .eq('call_status', 'initiated')
      .order('started_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  // ==========================================
  // SIGNALING OPERATIONS
  // ==========================================

  /**
   * Send WebRTC signal
   */
  async sendSignal(callId, fromUserId, toUserId, signalType, signalData) {
    const { data, error } = await supabase
      .from('call_signaling')
      .insert({
        call_id: callId,
        from_user_id: fromUserId,
        to_user_id: toUserId,
        signal_type: signalType,
        signal_data: signalData,
        is_processed: false
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Get pending signals for user
   */
  async getPendingSignals(userId) {
    const { data, error } = await supabase
      .from('call_signaling')
      .select('*')
      .eq('to_user_id', userId)
      .eq('is_processed', false)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data;
  }

  /**
   * Mark signal as processed
   */
  async markSignalProcessed(signalId) {
    const { error } = await supabase
      .from('call_signaling')
      .update({ is_processed: true })
      .eq('id', signalId);

    if (error) throw error;
  }

  /**
   * Mark multiple signals as processed
   */
  async markSignalsProcessed(signalIds) {
    if (!signalIds || signalIds.length === 0) return;

    const { error } = await supabase
      .from('call_signaling')
      .update({ is_processed: true })
      .in('id', signalIds);

    if (error) throw error;
  }

  /**
   * Delete signals for a call
   */
  async deleteCallSignals(callId) {
    const { error } = await supabase
      .from('call_signaling')
      .delete()
      .eq('call_id', callId);

    if (error) throw error;
  }

  // ==========================================
  // REALTIME SUBSCRIPTIONS
  // ==========================================

  /**
   * Subscribe to incoming signals
   */
  subscribeToSignals(userId, onSignal) {
    const channelName = `signals:${userId}`;

    realtimeManager.subscribe(
      channelName,
      {
        table: 'call_signaling',
        filter: `to_user_id=eq.${userId}`
      },
      {
        postgres_changes: [
          {
            event: 'INSERT',
            schema: 'public',
            table: 'call_signaling',
            filter: `to_user_id=eq.${userId}`,
            handler: (payload) => {
              console.log('📨 New signal received:', payload.new);
              onSignal(payload.new);
            }
          }
        ]
      }
    );

    return channelName;
  }

  /**
   * Subscribe to call history changes
   */
  subscribeToCallHistory(userId, onCallUpdate) {
    const channelName = `calls_history:${userId}`;

    realtimeManager.subscribe(
      channelName,
      {
        table: 'call_history'
      },
      {
        postgres_changes: [
          {
            event: '*',
            schema: 'public',
            table: 'call_history',
            filter: `receiver_id=eq.${userId}`,
            handler: (payload) => {
              console.log('📞 Call history update (receiver):', payload.eventType, payload.new?.call_status);
              onCallUpdate(payload);
            }
          }
        ]
      }
    );

    return channelName;
  }

  /**
   * Unsubscribe from channel
   */
  unsubscribe(channelOrName) {
    if (!channelOrName) return;

    if (typeof channelOrName === 'string') {
      realtimeManager.unsubscribe(channelOrName);
    } else {
      // Fallback for raw Supabase channels if any are still passed
      supabase.removeChannel(channelOrName);
    }
  }

  // ==========================================
  // USER CALL SETTINGS
  // ==========================================

  /**
   * Get user call settings
   */
  async getCallSettings(userId) {
    const { data, error } = await supabase
      .from('user_call_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  /**
   * Update user call settings
   */
  async updateCallSettings(userId, settings) {
    const { data, error } = await supabase
      .from('user_call_settings')
      .upsert({
        user_id: userId,
        ...settings,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Get user details
   */
  async getUserById(userId) {
    const { data, error } = await supabase
      .from('users')
      .select('id, name, phone, avatar')
      .eq('id', userId)
      .single();

    if (error) throw error;
    return data;
  }
}

export const callService = new CallService();
export default callService;