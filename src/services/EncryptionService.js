import CryptoJS from 'crypto-js';
import useAuthStore from '../store/authStore';
import { doubleRatchetService } from './DoubleRatchetService';

/**
 * End-to-End Encryption Service for CaBa Chat.
 * Uses AES-256 for message content and SHA-256 for key derivation.
 * Messages are encrypted on-device before being sent to Supabase.
 */
const E2EE_PREFIX = '🔒:';

// In-memory cache for derived keys to make encryption/decryption near-instant
const _keyCache = new Map();

export const EncryptionService = {
    /**
     * Derives a deterministic encryption key for a chat.
     * Caches the result to avoid redundant SHA-256 calculations.
     */
    _deriveChatKey(chatId, otherUserId = null) {
        const myId = useAuthStore.getState().user?.id;
        if (!myId) return null;

        // Generate a cache key
        const cacheKey = otherUserId 
            ? `1v1_${[String(myId), String(otherUserId)].sort().join('_')}`
            : `grp_${chatId}`;
        
        if (_keyCache.has(cacheKey)) {
            return _keyCache.get(cacheKey);
        }

        let derivedKey;
        if (otherUserId && String(otherUserId) !== 'null' && String(otherUserId) !== 'undefined') {
            const participants = [String(myId), String(otherUserId)].sort();
            derivedKey = CryptoJS.SHA256(participants.join('_')).toString();
        } else {
            derivedKey = CryptoJS.SHA256(String(chatId)).toString();
        }

        // Store in cache before returning
        _keyCache.set(cacheKey, derivedKey);
        return derivedKey;
    },

    /**
     * Clears the key cache (useful on logout)
     */
    clearCache() {
        _keyCache.clear();
    },

    /**
     * Encrypts plain text for a specific chat.
     */
    encrypt(text, chatId, otherUserId = null) {
        if (!text || typeof text !== 'string') return text;
        
        // Don't double encrypt
        if (text.startsWith(E2EE_PREFIX)) return text;

        const rootKey = this._deriveChatKey(chatId, otherUserId);
        if (!rootKey) return text;

        try {
            // Ensure ratchet is initialized
            if (!doubleRatchetService.sessions.has(chatId)) {
                doubleRatchetService.initSession(chatId, rootKey);
            }

            const { ciphertext, ratchetNumber } = doubleRatchetService.encryptMessage(chatId, text);
            return `${E2EE_PREFIX}RATCHET:v1:${ratchetNumber}:${ciphertext}`;
        } catch (error) {
            console.error('[E2EE] Encryption failed:', error);
            return text;
        }
    },

    /**
     * Decrypts a cipher text for a specific chat.
     */
    decrypt(encryptedText, chatId, otherUserId = null) {
        if (!encryptedText || typeof encryptedText !== 'string' || !encryptedText.startsWith(E2EE_PREFIX)) {
            return encryptedText;
        }

        const rootKey = this._deriveChatKey(chatId, otherUserId);
        if (!rootKey) return encryptedText;

        try {
            const payload = encryptedText.substring(E2EE_PREFIX.length);

            // Check if it's a ratcheted message
            if (payload.startsWith('RATCHET:v1:')) {
                const parts = payload.split(':');
                if (parts.length >= 4) { // RATCHET:v1:{number}:{ciphertext}
                    const ratchetNumber = parseInt(parts[2], 10);
                    const ciphertext = parts.slice(3).join(':'); // The rest is ciphertext

                    if (!doubleRatchetService.sessions.has(chatId)) {
                        doubleRatchetService.initSession(chatId, rootKey);
                    }

                    const decrypted = doubleRatchetService.decryptMessage(chatId, ciphertext, ratchetNumber);
                    if (!decrypted) return '[Encrypted Message]';
                    return decrypted;
                }
            }

            // Fallback to legacy deterministic decryption
            const bytes = CryptoJS.AES.decrypt(payload, rootKey);
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
