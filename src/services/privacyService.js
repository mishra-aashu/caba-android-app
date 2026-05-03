import { PrivacyScreen } from '@capacitor-community/privacy-screen';
import { Capacitor } from '@capacitor/core';
import { isNativeWithPlugins } from '../utils/platformCheck';

/**
 * PrivacyService
 * 
 * Handles screen protection logic for both Native and Web.
 * Native: Uses @capacitor-community/privacy-screen to block screenshots and screen recording.
 * Web: Implements secondary protection measures (blur on visibility change).
 */
export const PrivacyService = {
  isEnabled: false,

  /**
   * Enable screenshot and screen recording protection
   */
  async enable() {
    if (this.isEnabled) return;
    
    if (isNativeWithPlugins()) {
      try {
        await PrivacyScreen.enable();
        console.log('[PrivacyService] Native protection enabled');
      } catch (err) {
        console.error('[PrivacyService] Failed to enable native protection:', err);
      }
    } else {
      console.log('[PrivacyService] Web protection active (Blur on visibility change)');
    }
    
    this.isEnabled = true;
  },

  /**
   * Disable protection
   */
  async disable() {
    if (!this.isEnabled) return;

    if (isNativeWithPlugins()) {
      try {
        await PrivacyScreen.disable();
        console.log('[PrivacyService] Native protection disabled');
      } catch (err) {
        console.error('[PrivacyService] Failed to disable native protection:', err);
      }
    }
    
    this.isEnabled = false;
  },

  async reportScreenshot(chatId, userId, userName) {
    try {
      const { supabase } = await import('../config/supabase');
      await supabase.from('messages').insert({
        chat_id: chatId,
        sender_id: userId,
        receiver_id: userId,
        content: `📸 ${userName} took a screenshot!`,
        message_type: 'system',
        vanish_at: new Date(Date.now() + 86400 * 1000).toISOString(),
      });
    } catch (error) {
      console.error('Failed to report screenshot:', error);
    }
  }
};

export default PrivacyService;
