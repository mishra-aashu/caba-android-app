import CryptoJS from 'crypto-js';

/**
 * A rudimentary implementation of a Symmetric-Key Ratchet providing Perfect Forward Secrecy (PFS).
 * In a full Double Ratchet (like Signal), this is combined with an asymmetric Diffie-Hellman ratchet.
 * Here, we use HKDF (via HMAC-SHA256) to derive message keys and advance the chain key,
 * ensuring that past message keys cannot be derived even if the current chain key is compromised.
 */
class DoubleRatchetService {
  constructor() {
    this.sessions = new Map(); // chatId -> { chainKey, messageKeys: Map(messageNumber -> key) }
  }

  /**
   * Initializes a new ratchet session for a chat.
   * In a real implementation, the initial chain key is derived via X3DH.
   * For this migration, we use the deterministic master key as the starting root.
   */
  initSession(chatId, initialRootKey) {
    if (!initialRootKey) throw new Error('Initial root key required');
    
    // Convert to word array if it's a string
    const keyData = typeof initialRootKey === 'string' ? CryptoJS.enc.Utf8.parse(initialRootKey) : initialRootKey;
    
    this.sessions.set(chatId, {
      chainKey: keyData,
      messageNumber: 0,
      savedMessageKeys: new Map(), // To handle out-of-order delivery
    });
    
    console.log(`[Ratchet] Initialized session for chat ${chatId}`);
  }

  /**
   * Derives a key using a basic KDF (HMAC-SHA256).
   */
  _kdf(key, info) {
    return CryptoJS.HmacSHA256(info, key);
  }

  /**
   * Steps the ratchet forward to generate a new Message Key and updates the Chain Key.
   * KDF(ChainKey) -> [NextChainKey, MessageKey]
   */
  _stepRatchet(chatId) {
    const session = this.sessions.get(chatId);
    if (!session) throw new Error(`No active ratchet session for ${chatId}`);

    // Derive message key: HMAC(chainKey, "message")
    const messageKey = this._kdf(session.chainKey, CryptoJS.enc.Utf8.parse("message"));
    
    // Advance chain key: HMAC(chainKey, "chain")
    const nextChainKey = this._kdf(session.chainKey, CryptoJS.enc.Utf8.parse("chain"));

    session.chainKey = nextChainKey;
    const currentMsgNumber = session.messageNumber++;
    
    return { messageKey, messageNumber: currentMsgNumber };
  }

  /**
   * Encrypts a message using the next ratcheted key.
   */
  encryptMessage(chatId, plaintext) {
    if (!this.sessions.has(chatId)) {
      throw new Error(`Session not initialized for ${chatId}`);
    }

    const { messageKey, messageNumber } = this._stepRatchet(chatId);
    const keyHex = CryptoJS.enc.Hex.stringify(messageKey);

    // Encrypt using AES
    const encrypted = CryptoJS.AES.encrypt(plaintext, keyHex).toString();

    // The message includes its ratchet number so the receiver knows which key to use
    return {
      ciphertext: encrypted,
      ratchetNumber: messageNumber,
    };
  }

  /**
   * Decrypts a message, advancing the ratchet if necessary.
   * Handles out-of-order messages by saving skipped message keys.
   */
  decryptMessage(chatId, ciphertext, ratchetNumber) {
    const session = this.sessions.get(chatId);
    if (!session) throw new Error(`Session not initialized for ${chatId}`);

    let messageKey;

    // Check if we already skipped and saved this key
    if (session.savedMessageKeys.has(ratchetNumber)) {
      messageKey = session.savedMessageKeys.get(ratchetNumber);
      session.savedMessageKeys.delete(ratchetNumber);
    } else {
      // If the message is in the future, ratchet forward and save skipped keys
      while (session.messageNumber < ratchetNumber) {
        const skipped = this._stepRatchet(chatId);
        session.savedMessageKeys.set(skipped.messageNumber, skipped.messageKey);
      }
      
      // If it's exactly the next expected message
      if (session.messageNumber === ratchetNumber) {
        const current = this._stepRatchet(chatId);
        messageKey = current.messageKey;
      } else {
        throw new Error(`Message key for number ${ratchetNumber} is lost (already used or past bounds).`);
      }
    }

    const keyHex = CryptoJS.enc.Hex.stringify(messageKey);
    const decrypted = CryptoJS.AES.decrypt(ciphertext, keyHex);
    return decrypted.toString(CryptoJS.enc.Utf8);
  }

  /**
   * Clears a session. Useful for explicit logout or deleting chat history.
   */
  clearSession(chatId) {
    this.sessions.delete(chatId);
  }
}

export const doubleRatchetService = new DoubleRatchetService();
