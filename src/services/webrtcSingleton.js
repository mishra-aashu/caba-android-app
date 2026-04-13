// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// webrtcSingleton.js — Module-level Singleton Registry
//
// PURPOSE: Guarantee ONE WebRTCRoomManager instance per roomId
// across all React renders and re-mounts. Without this, each
// component mount creates a new manager, causing:
//   - Race conditions in peer-join broadcasts
//   - Lost signaling messages between peers
//   - Games never connecting after invitation acceptance
//
// PATTERN: Reference-counted singleton
//   - getOrCreateManager() → creates once, increments refCount
//   - releaseManager()     → decrements refCount, destroys at 0
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import WebRTCRoomManager from './WebRTCRoomManager';

/**
 * @typedef {Object} ManagerEntry
 * @property {WebRTCRoomManager} manager
 * @property {number} refCount
 */

/** @type {Map<string, ManagerEntry>} */
const registry = new Map();

/**
 * Get an existing manager for roomId or create a new one.
 * Increments the reference count on each call.
 *
 * @param {{ roomId: string, userId: string, userName: string, supabase: object }} opts
 * @returns {WebRTCRoomManager}
 */
export function getOrCreateManager({ roomId, userId, userName, supabase }) {
  if (!roomId) return null;

  if (registry.has(roomId)) {
    const entry = registry.get(roomId);
    entry.refCount++;
    // console.log(`[Singleton] Reusing manager for room ${roomId} (refs: ${entry.refCount})`);
    return entry.manager;
  }

  // console.log(`[Singleton] Creating new manager for room ${roomId}`);
  const manager = new WebRTCRoomManager({ roomId, userId, userName, supabase });
  registry.set(roomId, { manager, refCount: 1 });
  return manager;
}

/**
 * Release interest in a manager. When refCount reaches 0,
 * the manager is fully destroyed and removed from the registry.
 *
 * @param {string} roomId
 */
export function releaseManager(roomId) {
  if (!roomId) return;
  const entry = registry.get(roomId);
  if (!entry) return;

  entry.refCount--;
  // console.log(`[Singleton] Released manager for room ${roomId} (refs: ${entry.refCount})`);

  if (entry.refCount <= 0) {
    // console.log(`[Singleton] Destroying manager for room ${roomId}`);
    entry.manager.destroy().catch(() => {});
    registry.delete(roomId);
  }
}

/**
 * Force-destroy a manager immediately (e.g. on explicit game exit).
 * Use this when you need to cleanly reset state regardless of refCount.
 *
 * @param {string} roomId
 */
export function forceDestroyManager(roomId) {
  if (!roomId) return;
  const entry = registry.get(roomId);
  if (!entry) return;
  entry.manager.destroy().catch(() => {});
  registry.delete(roomId);
}

/**
 * Peek at the current manager (without incrementing refCount).
 * Useful for debugging.
 *
 * @param {string} roomId
 * @returns {WebRTCRoomManager | null}
 */
export function peekManager(roomId) {
  return registry.get(roomId)?.manager ?? null;
}
