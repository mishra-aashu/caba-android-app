/**
 * Real-time subscription manager
 * Prevents memory leaks and manages subscription lifecycle
 */

import { supabase } from '../config/supabase';

class RealtimeManager {
  constructor() {
    this.subscriptions = new Map(); // Map<string, Set<Channel>>
    this.globalSubscriptions = new Set(); // Set<Channel>
    this.maxRetries = 5;
    this.retryDelay = 2000;
  }

  /**
   * Create a new subscription with automatic cleanup
   */
  async subscribe(channelName, config, callbacks = {}) {
    try {
      // 1. Root fix: Check if subscription already exists and CLEAN UP FIRST
      // This prevents "dirty" channels from causing CHANNEL_ERROR on re-subscribe
      if (this.subscriptions.has(channelName)) {
        console.log(`🔄 Pre-cleaning existing subscription: ${channelName}`);
        await this.unsubscribe(channelName);
      }

      const channel = supabase.channel(channelName);

      // 2. Add event listeners
      Object.entries(callbacks).forEach(([event, callback]) => {
        if (event === 'postgres_changes') {
          // callback is an array of listeners
          callback.forEach(listenerConfig => {
            // Root fix: strip 'handler' from the config object passed to Supabase
            // Supabase expects only valid filter properties (event, schema, table, filter)
            const { handler, ...supabaseConfig } = listenerConfig;
            channel.on('postgres_changes', supabaseConfig, handler || (() => { }));
          });
        } else {
          channel.on(event, callback);
        }
      });

      // 3. Subscribe with error handling
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`✅ Successfully subscribed to ${channelName}`);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error(`❌ Subscription failed for ${channelName}:`, status);
          this.handleSubscriptionError(channelName, channel, config, callbacks);
        }
      });

      // 4. Store the channel
      if (!this.subscriptions.has(channelName)) {
        this.subscriptions.set(channelName, new Set());
      }
      this.subscriptions.get(channelName).add(channel);

      return channel;
    } catch (error) {
      console.error(`Error creating subscription ${channelName}:`, error);
      return null;
    }
  }

  /**
   * Handle subscription errors with retry logic
   */
  async handleSubscriptionError(channelName, failedChannel, config, callbacks) {
    await this.removeChannel(failedChannel);
    let retryCount = 0;

    const retry = async () => {
      if (retryCount >= this.maxRetries) {
        console.error(`Max retries exceeded for ${channelName}`);
        return;
      }
      retryCount++;
      console.log(`Retrying subscription ${channelName} (${retryCount}/${this.maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, this.retryDelay * retryCount));
      const newChannel = await this.subscribe(channelName, config, callbacks);
      if (!newChannel) retry();
    };

    retry();
  }

  /**
   * Remove a specific channel
   */
  async removeChannel(channel) {
    if (!channel) return;

    try {
      // Remove from global subscriptions
      this.globalSubscriptions.delete(channel);

      // Remove from specific subscriptions
      this.subscriptions.forEach((channels, channelName) => {
        if (channels.has(channel)) {
          channels.delete(channel);
          console.log(`🗑️ Removed channel from ${channelName}`);

          // Clean up empty subscription sets
          if (channels.size === 0) {
            this.subscriptions.delete(channelName);
          }
        }
      });

      // Actually remove from Supabase
      await supabase.removeChannel(channel);
    } catch (error) {
      console.error('Error removing channel:', error);
    }
  }

  /**
   * Remove all subscriptions for a specific channel name
   */
  async unsubscribe(channelName) {
    const channels = this.subscriptions.get(channelName);
    if (channels) {
      // Use Promise.all to wait for all channels to be removed
      const channelArray = Array.from(channels);
      await Promise.all(channelArray.map(channel => this.removeChannel(channel)));
      this.subscriptions.delete(channelName);
      console.log(`🗑️ Unsubscribed from all channels: ${channelName}`);
    }
  }

  /**
   * Remove all subscriptions (cleanup)
   */
  unsubscribeAll() {
    console.log('🧹 Cleaning up all real-time subscriptions...');

    // Remove all specific subscriptions
    this.subscriptions.forEach((channels, channelName) => {
      channels.forEach(channel => this.removeChannel(channel));
    });

    // Remove global subscriptions
    this.globalSubscriptions.forEach(channel => this.removeChannel(channel));

    // Clear all maps
    this.subscriptions.clear();
    this.globalSubscriptions.clear();

    console.log('✅ All subscriptions cleaned up');
  }

  /**
   * Get subscription statistics
   */
  getStats() {
    const totalChannels = Array.from(this.subscriptions.values())
      .reduce((total, channels) => total + channels.size, 0) + this.globalSubscriptions.size;

    return {
      activeSubscriptions: this.subscriptions.size,
      totalChannels,
      subscriptionDetails: Array.from(this.subscriptions.entries()).map(([name, channels]) => ({
        name,
        channelCount: channels.size
      }))
    };
  }

  /**
   * Health check for subscriptions
   */
  async healthCheck() {
    const stats = this.getStats();
    console.log('📊 Real-time subscription stats:', stats);

    // Warn if too many subscriptions
    if (stats.totalChannels > 50) {
      console.warn('⚠️ High number of active subscriptions detected:', stats.totalChannels);
    }

    return stats;
  }
}

// Create singleton instance
export const realtimeManager = new RealtimeManager();

// Auto-cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    realtimeManager.unsubscribeAll();
  });
}

export default realtimeManager;
