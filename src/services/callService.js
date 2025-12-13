import { supabase } from '../utils/supabase';

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
   * Get call history for user
   */
  async getCallHistory(userId, limit = 50) {
    const { data, error } = await supabase
      .rpc('get_user_call_history', {
        user_id_param: userId,
        limit_count: limit
      });

    if (error) throw error;
    return data;
  }

  /**
   * Get missed calls count
   */
  async getMissedCallsCount(userId) {
    const { data, error } = await supabase
      .rpc('get_missed_calls_count', {
        user_uuid: userId
      });

    if (error) throw error;
    return data;
  }

  /**
   * Get active call by call_id
   */
  async getCallById(callId) {
    const { data, error } = await supabase
      .from('call_history')
      .select('*')
      .eq('call_id', callId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
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
    const channel = supabase
      .channel(`signals:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'call_signaling',
          filter: `to_user_id=eq.${userId}`
        },
        (payload) => {
          console.log('📨 New signal received:', payload.new);
          onSignal(payload.new);
        }
      )
      .subscribe();

    return channel;
  }

  /**
   * Subscribe to call history changes
   */
  subscribeToCallHistory(userId, onCallUpdate) {
    const channel = supabase
      .channel(`calls:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'call_history',
          filter: `receiver_id=eq.${userId}`
        },
        (payload) => {
          console.log('📞 Call update:', payload);
          onCallUpdate(payload);
        }
      )
      .subscribe();

    return channel;
  }

  /**
   * Unsubscribe from channel
   */
  unsubscribe(channel) {
    if (channel) {
      supabase.removeChannel(channel);
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