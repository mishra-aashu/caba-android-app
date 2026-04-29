import { execSync } from 'child_process';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const KEEP_COUNT = 5;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("❌ Missing Supabase credentials for cleanup!");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function cleanup() {
    console.log(`🧹 Starting OTA Cleanup (Keeping latest ${KEEP_COUNT})...`);

    try {
        // 1. Get GitHub Releases
        console.log("🔍 Fetching GitHub Releases...");
        const releasesJson = execSync('gh release list --limit 100 --json tagName,createdAt', { encoding: 'utf-8' });
        const allReleases = JSON.parse(releasesJson);

        // Filter for OTA releases and sort by date descending
        const otaReleases = allReleases
            .filter(r => r.tagName.startsWith('ota-'))
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        console.log(`📊 Found ${otaReleases.length} OTA releases.`);

        if (otaReleases.length <= KEEP_COUNT) {
            console.log("✅ Nothing to delete from GitHub.");
        } else {
            const toDelete = otaReleases.slice(KEEP_COUNT);
            console.log(`🗑️ Deleting ${toDelete.length} old releases from GitHub...`);

            for (const release of toDelete) {
                try {
                    console.log(`  - Deleting ${release.tagName}...`);
                    execSync(`gh release delete "${release.tagName}" --yes --cleanup-tag`);
                } catch (e) {
                    console.warn(`  ⚠️ Failed to delete ${release.tagName} from GitHub: ${e.message}`);
                }
            }
        }

        // 2. Get Supabase Records
        console.log("🔍 Fetching Supabase OTA records...");
        const { data: dbRecords, error: fetchErr } = await supabase
            .from('ota_updates')
            .select('id, bundle_version, created_at')
            .order('created_at', { ascending: false });

        if (fetchErr) throw fetchErr;

        console.log(`📊 Found ${dbRecords.length} records in Supabase.`);

        if (dbRecords.length <= KEEP_COUNT) {
            console.log("✅ Nothing to delete from Supabase.");
        } else {
            const toDeleteIds = dbRecords.slice(KEEP_COUNT).map(r => r.id);
            console.log(`🗑️ Deleting ${toDeleteIds.length} old records from Supabase...`);

            const { error: delErr } = await supabase
                .from('ota_updates')
                .delete()
                .in('id', toDeleteIds);

            if (delErr) throw delErr;
            console.log("✅ Supabase records cleaned up.");
        }

        // 3. (Optional) Storage Cleanup
        // If we are using Supabase Storage (like in deploy-ota.js), we should also delete files.
        // But ota-deploy.yml uses GitHub Releases. 
        // We'll add a check for storage just in case.
        console.log("🔍 Checking for obsolete files in Supabase storage...");
        const { data: files, error: listErr } = await supabase.storage.from('ota-updates').list();
        
        if (!listErr && files && files.length > KEEP_COUNT) {
            // Sorting files by created_at is tricky with list(), usually it returns them in some order.
            // We'll match them against the tags we kept if possible, or just sort by name (since name has timestamp).
            const otaFiles = files
                .filter(f => f.name.startsWith('ota-'))
                .sort((a, b) => b.name.localeCompare(a.name)); // Timestamps make name sort work for chronological

            const filesToDelete = otaFiles.slice(KEEP_COUNT).map(f => f.name);
            if (filesToDelete.length > 0) {
                console.log(`🗑️ Deleting ${filesToDelete.length} files from Supabase storage...`);
                await supabase.storage.from('ota-updates').remove(filesToDelete);
            }
        }

        console.log("✨ Cleanup completed successfully!");

    } catch (err) {
        console.error("❌ Cleanup failed:", err.message);
        // We don't exit with 1 here because cleanup failure shouldn't break the deploy build necessarily,
        // but it's good to know.
    }
}

cleanup();
