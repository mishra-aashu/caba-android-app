import fs from 'fs';
import crypto from 'crypto';
import { execSync } from 'child_process';
import archiver from 'archiver';
import { createClient } from '@supabase/supabase-js';
import packageJson from '../package.json' with { type: 'json' };

// You can use a local .env file during manual testing, but in GitHub Actions, these come from Secrets.
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_DIRECT_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const GITHUB_REPO = process.env.GITHUB_REPO || 'mishra-aashu/caba-android-app';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("❌ Missing Supabase credentials! Please ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const version = packageJson.version; // e.g., "1.0.0"
const timestamp = Date.now().toString(); // bundle_version
const zipFileName = `ota-${version}-${timestamp}.zip`;
const tagName = `ota-${version}-${timestamp}`;

async function deploy() {
    console.log(`📦 Zipping dist folder for app version ${version}...`);
    
    // Create the ZIP archive
    const output = fs.createWriteStream(zipFileName);
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    archive.pipe(output);
    archive.directory('dist/', false); // Include contents of dist/ without the top-level 'dist' folder
    
    await new Promise((resolve, reject) => {
        archive.on('end', resolve);
        archive.on('error', reject);
        archive.finalize();
    });

    // --- Calculate Checksum ---
    console.log(`🔒 Calculating SHA-256 checksum for ${zipFileName}...`);
    const checksum = await new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const input = fs.createReadStream(zipFileName);
        input.on('error', reject);
        input.on('data', chunk => hash.update(chunk));
        input.on('close', () => resolve(hash.digest('hex')));
    });
    console.log(`✅ Checksum: ${checksum}`);

    // --- GitHub URL Construction ---
    const publicUrl = `https://github.com/${GITHUB_REPO}/releases/download/${tagName}/${zipFileName}`;
    console.log(`🔗 Generated GitHub Release URL: ${publicUrl}`);

    // --- Automated GitHub Upload ---
    console.log(`🚀 Uploading ZIP to GitHub Release (${tagName})...`);
    try {
        // Create GitHub Release and upload the file
        execSync(`gh release create ${tagName} ${zipFileName} --title "OTA Update ${version}" --notes "Checksum: ${checksum}"`, { stdio: 'inherit' });
        console.log('✅ GitHub Release created and file uploaded!');
    } catch (e) {
        console.error("❌ GitHub Upload Failed! Please ensure 'gh' CLI is installed and authenticated.");
        console.log(`   Manual Command: gh release create ${tagName} ${zipFileName} --title "OTA Update ${version}" --notes "Checksum: ${checksum}"`);
        
        // If in GitHub Actions, we should fail the build
        if (process.env.GITHUB_ACTIONS) {
            throw e;
        }
    }

    // Parse CLI arguments for metadata
    const args = process.argv.slice(2);
    let changelog = [];
    let priority = 'normal';

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--changelog' && args[i + 1]) {
            changelog = args[i + 1].split(',').map(s => s.trim()).filter(Boolean);
            i++;
        } else if (args[i] === '--priority' && args[i + 1]) {
            priority = args[i + 1].toLowerCase();
            i++;
        }
    }

    console.log(`📝 Registering update in Supabase (target app: ${version}, bundle: ${timestamp})...`);
    const { error: dbErr } = await supabase.from('ota_updates').insert({
        target_app_version: version,
        bundle_version: timestamp,
        bundle_url: publicUrl,
        checksum: checksum,
        changelog: changelog,
        priority: priority
    });

    if (dbErr) {
        console.error("❌ Failed to insert into database:", dbErr);
        throw dbErr;
    }

    console.log('✅ OTA Metadata Registered Successfully!');
    
    // Clean up the local zip file after successful registration
    if (fs.existsSync(zipFileName)) {
        fs.unlinkSync(zipFileName);
        console.log(`🧹 Cleaned up local file ${zipFileName}.`);
    }

    // Automatically trigger cleanup for OLD updates in DB
    console.log("🧹 Triggering DB cleanup...");
    try {
        execSync('node scripts/cleanup-ota.js', { stdio: 'inherit' });
    } catch (e) {
        console.warn("⚠️ Cleanup script failed, but registration was successful.");
    }
}

deploy().catch(err => {
    console.error("❌ Deployment failed:", err);
    process.exit(1);
});

