import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateNativeHash } from './native-integrity.js';

// Load environment variables from .env file
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

async function updateAppVersion() {
    console.log(`🚀 Updating app version to ${currentVersion} in Supabase (Row ID: 1)...`);

    // Generate native hash
    console.log('🔍 Generating native integrity hash...');
    const { hash: nativeHash, details: nativeDetails } = generateNativeHash();
    console.log(`🔐 Native hash: ${nativeHash.slice(0, 16)}...`);
    console.log(`📂 Files checked: ${Object.keys(nativeDetails).join(', ')}`);

    try {
        // Update the single existing record (ID: 1)
        const { error: updateError } = await supabase
            .from('app_versions')
            .update({
                latest_version: currentVersion,
                min_required_version: currentVersion,
                native_hash: nativeHash,
                native_details: nativeDetails
            })
            .eq('id', 1);

        if (updateError) throw updateError;

        console.log(`✅ Successfully updated app_versions in Supabase:`);
        console.log(`   version:     ${currentVersion}`);
        console.log(`   native_hash: ${nativeHash.slice(0, 16)}...`);

        // Also write the native-integrity.json to public/ for local builds
        const publicDir = path.resolve(__dirname, '../public');
        if (fs.existsSync(publicDir)) {
            fs.writeFileSync(
                path.join(publicDir, 'native-integrity.json'),
                JSON.stringify({ hash: nativeHash, details: nativeDetails, generatedAt: Date.now() }, null, 2)
            );
            console.log('📄 Also written to public/native-integrity.json');
        }

    } catch (error) {
        const msg = error?.message || JSON.stringify(error) || 'Unknown error';
        console.error('❌ Error updating app version in Supabase:', msg);
        if (msg.includes('permission denied')) {
            console.error('💡 TIP: Check if the "anon" role has UPDATE permissions for the "app_versions" table in Supabase RLS.');
        }
        process.exit(1);
    }
}

updateAppVersion();
