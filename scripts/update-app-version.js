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
    console.log(`🚀 Updating app version to ${currentVersion} in Supabase (Row ID: 1)...`);

    try {
        // Update the single existing record (ID: 1)
        // This ensures the table doesn't grow with duplicate/history rows
        // and keeps the latest version info in one place.
        const { error: updateError } = await supabase
            .from('app_versions')
            .update({
                latest_version: currentVersion,
                min_required_version: currentVersion
            })
            .eq('id', 1);

        if (updateError) throw updateError;

        console.log(`✅ Successfully updated row ID 1 in Supabase to version ${currentVersion}!`);
    } catch (error) {
        console.error('❌ Error updating app version in Supabase:', error.message);
        if (error.message.includes('permission denied')) {
            console.error('💡 TIP: Check if the "anon" role has INSERT permissions for the "app_versions" table in Supabase RLS.');
        }
        process.exit(1);
    }
}

updateAppVersion();
