/**
 * Real-time subscription manager
 * Prevents memory leaks and manages subscription lifecycle
 */

import { supabase } from '../config/supabase';

class RealtimeManager {
  constructor() {
    this.subscriptions = new Map(); // Map<string, Set<Channel>>
    this.globalSubscriptions = new Set(); // Set<Channel>
    this.maxRetries = 3;
    this.retryDelay = 1000;
  }

  /**
   * Create a new subscription with automatic cleanup
   */
  subscribe(channelName, config, callbacks = {}) {
    try {
      // Check if subscription already exists
      if (!this.subscriptions.has(channelName)) {
        this.subscriptions.set(channelName, new Set());
      }

      const channel = supabase.channel(channelName);

      // Add event listeners
      Object.entries(callbacks).forEach(([event, callback]) => {
        if (event === 'postgres_changes') {
          callback.forEach(config => {
            channel.on('postgres_changes', config, config.handler || (() => {}));
          });
        } else {
          channel.on(event, callback);
        }
      });

      // Subscribe with error handling
      channel.subscribe((status) => {
        console.log(`📡 Subscription ${channelName} status:`, status);
        
        if (status === 'SUBSCRIBED') {
          console.log(`✅ Successfully subscribed to ${channelName}`);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error(`❌ Subscription failed for ${channelName}:`, status);
          this.handleSubscriptionError(channelName, channel, config, callbacks);
        }
      });

      // Store the channel
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
    let retryCount = 0;
    
    const retry = async () => {
      if (retryCount >= this.maxRetries) {
        console.error(`Max retries exceeded for ${channelName}`);
        return;
      }

      retryCount++;
      console.log(`Retrying subscription ${channelName} (${retryCount}/${this.maxRetries})`);

      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, this.retryDelay * retryCount));

      // Create new subscription
      const newChannel = this.subscribe(channelName, config, callbacks);
      if (newChannel) {
        // Remove failed channel
        this.removeChannel(failedChannel);
      } else {
        // Retry again
        retry();
      }
    };

    retry();
  }

  /**
   * Remove a specific channel
   */
  removeChannel(channel) {
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
      supabase.removeChannel(channel);
    } catch (error) {
      console.error('Error removing channel:', error);
    }
  }

  /**
   * Remove all subscriptions for a specific channel name
   */
  unsubscribe(channelName) {
    const channels = this.subscriptions.get(channelName);
    if (channels) {
      channels.forEach(channel => this.removeChannel(channel));
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
