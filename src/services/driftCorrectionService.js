import { db } from '../db/db';
import { supabase } from '../config/supabase';
import { dbToFrontend } from '../utils/dbFieldMapping';

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
   * Start the background maintenance loop
   */
  start() {
    // Run immediately on start
    this.recoverZombieTasks();
    
    // Schedule periodic checks
    setInterval(() => this.recoverZombieTasks(), 5 * 60 * 1000);
    setInterval(() => this.reconcileActiveChats(), RECONCILIATION_INTERVAL);
    
    console.log('🛡️ [ImmuneSystem] Background maintenance service started');
  }
};
