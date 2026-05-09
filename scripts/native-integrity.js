import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

/**
 * Generates SHA-256 hashes for critical native files.
 * This is used to detect if a native rebuild is required or if OTA is safe.
 */
export function generateNativeHash() {
    const criticalFiles = [
        'package.json',
        'capacitor.config.ts',
        'android/app/build.gradle',
        'android/variables.gradle',
        'android/gradle.properties',
        'android/app/src/main/AndroidManifest.xml',
        'android/app/src/main/res/values/strings.xml'
    ];

    const fileHashes = {};
    const details = {};

    criticalFiles.forEach(file => {
        const fullPath = path.join(rootDir, file);
        if (fs.existsSync(fullPath)) {
            const content = fs.readFileSync(fullPath);
            const hash = crypto.createHash('sha256').update(content).digest('hex');
            fileHashes[file] = hash;
            details[file] = 'present';
        } else {
            fileHashes[file] = null;
            details[file] = 'missing';
        }
    });

    // Generate a master hash of all file hashes
    const masterHash = crypto.createHash('sha256')
        .update(JSON.stringify(fileHashes))
        .digest('hex');

    return {
        hash: masterHash,
        fileHashes,
        details
    };
}
