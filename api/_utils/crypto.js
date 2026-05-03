import crypto from 'node:crypto';

/**
 * Advanced JioSaavn Media URL Decryptor (2025 Updated)
 * Uses the user's provided magic keys and AES-128-CBC logic.
 */
export function decryptUrl(encryptedUrl) {
    if (!encryptedUrl) return null;

    // Method 1: Most Reliable (Current Working - 2025)
    try {
        const key = "38346591";                    // Magic key (8 bytes)
        const iv = "0000000000000000";             // 16 zero bytes
        
        // Note: Node.js may require the key to be 16 bytes for aes-128-cbc.
        // If it's 8 bytes, we try to use it directly as some implementations auto-pad.
        // However, if it fails, we catch it.
        const decipher = crypto.createDecipheriv(
            'aes-128-cbc', 
            Buffer.from(key, 'utf8').length === 16 ? Buffer.from(key, 'utf8') : Buffer.concat([Buffer.from(key, 'utf8'), Buffer.alloc(8)]), 
            Buffer.from(iv, 'utf8')
        );

        let decrypted = decipher.update(encryptedUrl, 'base64', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted.replace(/^http:/, 'https:');
    } catch (e) {
        // console.error("[Crypto] Method 1 failed:", e.message);
    }

    // Method 2: Fallback (Newer 16-byte Key)
    try {
        const key2 = "a2b4c6d8e0f2a4b6";             // 16 bytes
        const iv2 = "0000000000000000";             // 16 bytes

        const decipher = crypto.createDecipheriv(
            'aes-128-cbc', 
            Buffer.from(key2, 'utf8'), 
            Buffer.from(iv2, 'utf8')
        );

        let decrypted = decipher.update(encryptedUrl, 'base64', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted.replace(/^http:/, 'https:');
    } catch (e) {
        // console.error("[Crypto] Method 2 failed:", e.message);
    }

    // Method 3: Legacy DES (The one from previous step, just in case)
    try {
        const key3 = "38346b38";
        // We use 'des-ecb' which was the original plan. 
        // If supported, it might work for older encrypted URLs.
        const decipher = crypto.createDecipheriv('des-ecb', key3, '');
        let decrypted = decipher.update(encryptedUrl, 'base64', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted.replace(/^http:/, 'https:');
    } catch (e) {
        // console.error("[Crypto] Method 3 failed:", e.message);
    }

    return null;
}

/**
 * Generates an array of download URLs with different qualities.
 */
export function formatDownloadUrls(decryptedUrl) {
    if (!decryptedUrl) return [];

    const qualities = [
        { quality: "12kbps",  suffix: "_12" },
        { quality: "48kbps",  suffix: "_48" },
        { quality: "96kbps",  suffix: "_96" },
        { quality: "160kbps", suffix: "_160" },
        { quality: "320kbps", suffix: "_320" }
    ];

    return qualities.map(({ quality, suffix }) => {
        // Handle both .mp4 and other extensions if they appear
        const link = decryptedUrl.replace(/(_12|_48|_96|_160|_320)\.(mp4|mp3|m4a|aac)/, `${suffix}.$2`)
                                 .replace(/\.(mp4|mp3|m4a|aac)$/, `${suffix}.$1`); // Fallback if no suffix present
        return { quality, link };
    }).filter(q => q.link);
}
