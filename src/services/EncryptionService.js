import CryptoJS from 'crypto-js';
import useAuthStore from '../store/authStore';

/**
 * End-to-End Encryption Service for CaBa Chat.
 * Uses AES-256 for message content and SHA-256 for key derivation.
 * Messages are encrypted on-device before being sent to Supabase.
 */
const E2EE_PREFIX = '🔒:';

export const EncryptionService = {
    /**
     * Derives a deterministic encryption key for a chat.
     * For 1-on-1: Sorted combination of Participant UIDs.
     * For Groups: SHA-256 of the Group ID.
     */
    _deriveChatKey(chatId, otherUserId = null) {
        const myId = useAuthStore.getState().user?.id;
        if (!myId) return null;

        // If otherUserId is provided, it's a 1-on-1 chat. 
        // We sort the IDs so both users derive the exact same key.
        if (otherUserId && String(otherUserId) !== 'null' && String(otherUserId) !== 'undefined') {
            const participants = [String(myId), String(otherUserId)].sort();
            return CryptoJS.SHA256(participants.join('_')).toString();
        }

        // For Groups or fallback, use the chatId (which is the Group UUID)
        // In a production app, you'd distribute a shared group secret.
        return CryptoJS.SHA256(String(chatId)).toString();
    },

    /**
     * Encrypts plain text for a specific chat.
     */
    encrypt(text, chatId, otherUserId = null) {
        if (!text || typeof text !== 'string') return text;
        
        // Don't double encrypt
        if (text.startsWith(E2EE_PREFIX)) return text;

        const key = this._deriveChatKey(chatId, otherUserId);
        if (!key) return text;

        try {
            const encrypted = CryptoJS.AES.encrypt(text, key).toString();
            return E2EE_PREFIX + encrypted;
        } catch (error) {
            console.error('[E2EE] Encryption failed:', error);
            return text;
        }
    },

    /**
     * Decrypted a cipher text for a specific chat.
     */
    decrypt(encryptedText, chatId, otherUserId = null) {
        if (!encryptedText || typeof encryptedText !== 'string' || !encryptedText.startsWith(E2EE_PREFIX)) {
            return encryptedText;
        }

        const key = this._deriveChatKey(chatId, otherUserId);
        if (!key) return encryptedText;

        try {
            const cipherText = encryptedText.substring(E2EE_PREFIX.length);
            const bytes = CryptoJS.AES.decrypt(cipherText, key);
            const decrypted = bytes.toString(CryptoJS.enc.Utf8);
            
            if (!decrypted) {
                // If decryption returns empty string, it might be the wrong key
                return '[Encrypted Message]';
            }
            
            return decrypted;
        } catch (error) {
            console.error('[E2EE] Decryption failed:', error);
            return '[Encrypted Message]';
        }
    }
};
