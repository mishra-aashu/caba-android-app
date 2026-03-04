import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from .env file
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageJsonPath = path.resolve(__dirname, '../package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const currentVersion = packageJson.version;

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('❌ Missing Supabase environment variables. Please check your .env file.');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function updateAppVersion() {
    console.log(`🚀 Updating app version to ${currentVersion} in Supabase...`);

    try {
        // 1. Check if this version already exists to avoid duplicates
        const { data: existing, error: fetchError } = await supabase
            .from('app_versions')
            .select('latest_version')
            .eq('latest_version', currentVersion)
            .maybeSingle();

        if (fetchError) throw fetchError;

        if (existing) {
            console.log(`ℹ️ Version ${currentVersion} already exists in Supabase. Skipping update.`);
            return;
        }

        // 2. Insert the new version
        // We set min_required_version equal to latest_version by default.
        // This forces an update if the app checks for min_required_version.
        const { error: insertError } = await supabase
            .from('app_versions')
            .insert([
                {
                    latest_version: currentVersion,
                    min_required_version: currentVersion
                }
            ]);

        if (insertError) throw insertError;

        console.log(`✅ Successfully updated app_versions in Supabase to version ${currentVersion}!`);
    } catch (error) {
        console.error('❌ Error updating app version in Supabase:', error.message);
        process.exit(1);
    }
}

updateAppVersion();
