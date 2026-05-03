import { db } from '../db/db';
import { supabase } from '../config/supabase';
import { dbToFrontend } from '../utils/dbFieldMapping';
import { EncryptionService } from './EncryptionService';

const ZOMBIE_TIMEOUT = 5 * 60 * 1000; // 5 minutes
const RECONCILIATION_INTERVAL = 15 * 60 * 1000; // 15 minutes

/**
 * The Immune System of the App.
 * Responsible for finding "Zombies", "Gaps", and "Mismatches".
 */
export const driftCorrectionService = {
  /**
   * Resets tasks that are stuck in 'processing' state.
   * Prevents one failed/crashed execution from blocking the entire queue.
   */
  async recoverZombieTasks() {
    console.log('🛡️ [ImmuneSystem] Checking for zombie tasks...');
    const now = Date.now();
    
    const zombies = await db.sync_queue
      .where('status')
      .equals('processing')
      .filter(task => (now - task.updatedAt) > ZOMBIE_TIMEOUT)
      .toArray();

    if (zombies.length > 0) {
      console.warn(`🛡️ [ImmuneSystem] Found ${zombies.length} zombies. Resetting to pending.`);
      await db.sync_queue.bulkUpdate(zombies.map(z => ({
        key: z.id,
        changes: { 
          status: 'pending',
          updatedAt: now,
          retries: (z.retries || 0) + 1 
        }
      })));
    }
  },

  isReconciling: false,

  /**
   * Snapshot Reconciliation for active chats.
   * Fetches latest state from server and patches local DB if needed.
   */
  async reconcileActiveChats() {
    if (this.isReconciling) return;
    this.isReconciling = true;

    try {
      console.log('🛡️ [ImmuneSystem] Starting snapshot reconciliation...');
    
    // 1. Get last 5 active chats from Dexie
    const activeChats = await db.chats_list
      .orderBy('lastMessageAt')
      .reverse()
      .limit(5)
      .toArray();

    for (const chat of activeChats) {
      try {
        // 2. Fetch last 20 messages from Supabase for this chat
        const { data: serverMsgs, error } = await supabase
          .from('messages')
          .select('*')
          .eq('chat_id', chat.id)
          .order('created_at', { ascending: false })
          .limit(20);

        if (error) continue;

        // 3. Compare with local messages
        const localMsgs = await db.messages
          .where('chatId')
          .equals(chat.id)
          .reverse()
          .limit(20)
          .toArray();

        const localIds = new Set(localMsgs.map(m => m.id));
        const missingFromLocal = serverMsgs.filter(sm => !localIds.has(sm.id));

        if (missingFromLocal.length > 0) {
          console.log(`🛡️ [ImmuneSystem] Found ${missingFromLocal.length} missing messages in chat ${chat.id}. Patching...`);
          
          const frontendMsgs = missingFromLocal.map(m => dbToFrontend(m));
          await db.messages.bulkPut(frontendMsgs);
          
          // Trigger UI update (optional: broadcast event)
        }
      } catch (err) {
        console.error(`🛡️ [ImmuneSystem] Reconciliation failed for chat ${chat.id}:`, err);
      }
    }
    } finally {
      this.isReconciling = false;
    }
  },

  /**
   * Finds and deletes duplicate messages from the local database.
   * This is part of the periodic maintenance to keep the DB clean.
   */
  async cleanupDuplicateMessages() {
    console.log('🛡️ [ImmuneSystem] Running duplicate message cleanup...');
    try {
      const allMessages = await db.messages.toArray();
      const seenSignatures = new Map();
      const idsToDelete = [];

      for (const msg of allMessages) {
        if (!msg.content) continue;

        // 1. Check by tempId (very reliable)
        if (msg.tempId) {
            const tempKey = `temp_${msg.tempId}`;
            if (seenSignatures.has(tempKey)) {
                idsToDelete.push(msg.id);
                continue;
            }
            seenSignatures.set(tempKey, msg.id);
        }

        // 2. Decrypt content if needed for a proper signature
        let content = msg.content;
        if (typeof content === 'string' && content.startsWith('🔒:')) {
            // For deduplication, we try to decrypt. 
            // Note: In 1v1 we need otherUserId, but for global cleanup we might not have it easily available here
            // However, if the ciphertexts are the same, they are definitely duplicates.
            // If ciphertexts are different but plaintext is same, they might be duplicates.
            // We'll use ciphertext as a secondary check if decryption fails.
            try {
                // Try to get otherUserId from chat
                const chat = await db.chats_list.get(msg.chatId);
                const isGroup = msg.isGroupMessage || chat?.is_group || chat?.isGroup;
                const otherUserId = isGroup ? null : (chat?.otherUserId || chat?.metadata?.otherUserId);
                const decrypted = EncryptionService.decrypt(content, msg.chatId, otherUserId);
                if (decrypted && decrypted !== '[Encrypted Message]') {
                    content = decrypted;
                }
            } catch (e) {
                // Ignore decryption errors for cleanup
            }
        }

        // 3. Check by content signature with fuzzy timestamp (5 second window)
        const timestamp = new Date(msg.createdAt || msg.created_at).getTime();
        const fuzzyTs = Math.floor(timestamp / 5000); // 5 second buckets
        const signature = `sig_${msg.chatId}_${msg.senderId}_${content}_${fuzzyTs}`;

        if (seenSignatures.has(signature)) {
            const existingId = seenSignatures.get(signature);
            // If existing is a temp ID and current isn't, keep current
            if (String(existingId).startsWith('tmp_') && !String(msg.id).startsWith('tmp_')) {
                idsToDelete.push(existingId);
                seenSignatures.set(signature, msg.id);
            } else {
                idsToDelete.push(msg.id);
            }
        } else {
            seenSignatures.set(signature, msg.id);
        }
      }

      if (idsToDelete.length > 0) {
        console.warn(`🛡️ [ImmuneSystem] Deleting ${idsToDelete.length} duplicate messages.`);
        await db.messages.bulkDelete(idsToDelete);
      }
    } catch (err) {
      console.error('🛡️ [ImmuneSystem] Duplicate cleanup failed:', err);
    }
  },

  /**
   * Start the background maintenance loop
   */
  start() {
    // Run immediately on start
    this.recoverZombieTasks();
    
    // Schedule periodic checks
    setInterval(() => this.recoverZombieTasks(), 5 * 60 * 1000);
    setInterval(() => this.reconcileActiveChats(), RECONCILIATION_INTERVAL);
    setInterval(() => this.cleanupDuplicateMessages(), 30 * 60 * 1000); // Every 30 mins
    
    console.log('🛡️ [ImmuneSystem] Background maintenance service started');
  }
};
