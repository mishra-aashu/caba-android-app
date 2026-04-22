import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { realtimeManager } from '../realtimeManager';

describe('RealtimeManager', () => {
  beforeEach(() => {
    realtimeManager.revive();
  });

  afterEach(async () => {
    await realtimeManager.kill();
  });

  it('should initialize without errors', () => {
    expect(realtimeManager).toBeDefined();
    expect(realtimeManager.subscriptions.size).toBe(0);
  });

  it('should prevent duplicate subscriptions', async () => {
    const channelName = 'test-channel';
    const config = { broadcast: { self: true } };

    const sub1 = await realtimeManager.subscribe(channelName, config);
    const sub2 = await realtimeManager.subscribe(channelName, config);

    expect(realtimeManager.subscriptions.size).toBe(1);
    expect(sub1).toBeDefined();
    expect(sub2).toBeDefined();
  });

  it('should handle zombie subscription prevention', async () => {
    const channelName = 'zombie-test';
    
    const subPromise = realtimeManager.subscribe(channelName, {});
    
    // Unsubscribe while still pending
    await realtimeManager.unsubscribe(channelName);
    
    const result = await subPromise;
    
    // Should return null (aborted)
    expect(result).toBeNull();
    expect(realtimeManager.subscriptions.has(channelName)).toBe(false);
  });

  it('should track metrics correctly', async () => {
    const channel = await realtimeManager.subscribe('metrics-test', {});
    
    const stats = realtimeManager.getStats();
    
    expect(stats.activeSubscriptions).toBe(1);
    expect(stats.details).toHaveLength(1);
  });

  it('should clean up on kill', async () => {
    await realtimeManager.subscribe('test-1', {});
    await realtimeManager.subscribe('test-2', {});
    
    expect(realtimeManager.subscriptions.size).toBe(2);
    
    await realtimeManager.kill();
    
    expect(realtimeManager.subscriptions.size).toBe(0);
  });
});
