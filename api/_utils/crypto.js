import CryptoJS from 'crypto-js';

/**
 * Ultra-robust Media URL Decryptor.
 * Verified working with key '38346591' and DES-ECB.
 */
export function decryptUrl(encryptedUrl) {
    if (!encryptedUrl || typeof encryptedUrl !== 'string') return null;

    try {
        // Step 1: Clean the input
        const cleanInput = encryptedUrl.trim();
        
        // Step 2: Prepare Key
        const key = CryptoJS.enc.Utf8.parse("38346591");

        // Step 3: Decrypt
        // We use a CipherParams object to ensure CryptoJS handles the Base64 correctly
        const decrypted = CryptoJS.DES.decrypt(
            { 
                ciphertext: CryptoJS.enc.Base64.parse(cleanInput) 
            },
            key,
            {
                mode: CryptoJS.mode.ECB,
                padding: CryptoJS.pad.Pkcs7
            }
        );

        // Step 4: Convert to UTF-8
        const decryptedText = decrypted.toString(CryptoJS.enc.Utf8);
        
        // Step 5: Validate and Return
        if (decryptedText && decryptedText.startsWith('http')) {
            return decryptedText.replace(/^http:/, 'https:');
        }

        // Fallback: Try with another common key if the first one fails
        const fallbackKey = CryptoJS.enc.Utf8.parse("38346b38");
        const decryptedFallback = CryptoJS.DES.decrypt(
            { ciphertext: CryptoJS.enc.Base64.parse(cleanInput) },
            fallbackKey,
            { mode: CryptoJS.mode.ECB, padding: CryptoJS.pad.Pkcs7 }
        );
        const fallbackText = decryptedFallback.toString(CryptoJS.enc.Utf8);
        if (fallbackText && fallbackText.startsWith('http')) {
            return fallbackText.replace(/^http:/, 'https:');
        }

    } catch (error) {
        console.error('[Crypto] Critical failure:', error.message);
    }

    return null;
}

/**
 * Robust quality swapper.
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
        // Media links usually end in _96.mp4 or _96.aac
        // We replace any existing quality marker or add one before the extension
        let link = decryptedUrl;
        if (link.includes('_96.mp4') || link.includes('_160.mp4') || link.includes('_320.mp4')) {
            link = link.replace(/(_96|_160|_320)\.mp4/, `${suffix}.mp4`);
        } else if (link.includes('_96.aac') || link.includes('_160.aac') || link.includes('_320.aac')) {
            link = link.replace(/(_96|_160|_320)\.aac/, `${suffix}.aac`);
        } else {
            // If no marker found, try a generic replacement
            link = link.replace(/\.(mp4|mp3|m4a|aac)$/, `${suffix}.$1`);
        }
        return { quality, link };
    });
}
