import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateNativeHash } from './native-integrity.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageJsonPath = path.resolve(__dirname, '../package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const currentVersion = packageJson.version;

// Use direct URL (bypass proxy) for server-side scripts
const SUPABASE_URL = process.env.VITE_SUPABASE_DIRECT_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('❌ Missing Supabase environment variables. Please check your .env file.');
    process.exit(1);
}

console.log(`🔌 Connecting to: ${SUPABASE_URL.slice(0, 40)}...`);
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function syncNativeVersions(version) {
    console.log(`📦 Syncing version ${version} to native files...`);

    // 1. Update android/app/build.gradle
    const buildGradlePath = path.resolve(__dirname, '../android/app/build.gradle');
    if (fs.existsSync(buildGradlePath)) {
        let content = fs.readFileSync(buildGradlePath, 'utf8');
        
        // Update versionName
        content = content.replace(/versionName\s+".*?"/, `versionName "${version}"`);
        
        // Auto-increment versionCode if version changed
        const currentCodeMatch = content.match(/versionCode\s+(\d+)/);
        if (currentCodeMatch) {
            const currentCode = parseInt(currentCodeMatch[1]);
            // Only increment if we haven't already incremented in this session or if it's a fresh version
            // For now, we'll just ensure it's at least the major/minor/patch sum or similar, 
            // but a simple increment is safer if the user hasn't done it.
            // content = content.replace(/versionCode\s+\d+/, `versionCode ${currentCode + 1}`);
            console.log(`   - Android versionName updated to ${version}`);
        }
        
        fs.writeFileSync(buildGradlePath, content);
    }
}

async function updateAppVersion() {
    console.log(`\n🚀 Updating app version to ${currentVersion} in Supabase (Row ID: 1)...\n`);

    // Sync to native first
    syncNativeVersions(currentVersion);

    // Generate native fingerprint (v2 — per-file hashes)
    console.log('🔍 Generating native integrity hash...');
    const { hash: nativeHash, details: nativeDetails, fileHashes } = generateNativeHash();
    console.log(`🔐 Native hash: ${nativeHash.slice(0, 16)}...`);

    const present = Object.entries(nativeDetails).filter(([, v]) => v === 'present');
    const missing = Object.entries(nativeDetails).filter(([, v]) => v !== 'present');
    console.log(`📂 Present (${present.length}): ${present.map(([f]) => f.split('/').pop()).join(', ')}`);
    if (missing.length) console.log(`⚠️  Missing/optional (${missing.length}): ${missing.map(([f, s]) => `${f.split('/').pop()} [${s}]`).join(', ')}`);

    try {
        const { error } = await supabase
            .from('app_versions')
            .update({
                latest_version: currentVersion,
                min_required_version: currentVersion,
                native_hash: nativeHash,
                native_details: nativeDetails,
                file_hashes: fileHashes,   // per-file SHA-256 for Admin DIFF panel
            })
            .eq('id', 1);

        if (error) throw error;

        console.log(`\n✅ Successfully updated app_versions in Supabase:`);
        console.log(`   version:     ${currentVersion}`);
        console.log(`   native_hash: ${nativeHash.slice(0, 16)}...`);
        console.log(`   file_hashes: ${Object.keys(fileHashes).length} files tracked`);

        // Write native-integrity.json to public/ (for Admin Dashboard hash comparison)
        const publicDir = path.resolve(__dirname, '../public');
        if (fs.existsSync(publicDir)) {
            fs.writeFileSync(
                path.join(publicDir, 'native-integrity.json'),
                JSON.stringify({ hash: nativeHash, fileHashes, details: nativeDetails, generatedAt: Date.now() }, null, 2)
            );
            console.log('📄 Also written to public/native-integrity.json');
        }

    } catch (error) {
        const msg = error?.message || JSON.stringify(error) || 'Unknown error';
        console.error('❌ Error updating app version in Supabase:', msg);
        if (msg.includes('permission denied')) {
            console.error('💡 TIP: Check RLS policies for the "app_versions" table in Supabase.');
        }
        process.exit(1);
    }
}

updateAppVersion();
