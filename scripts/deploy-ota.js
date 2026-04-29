import fs from 'fs';
import { execSync } from 'child_process';
import archiver from 'archiver';
import { createClient } from '@supabase/supabase-js';
import * as tus from 'tus-js-client';
import packageJson from '../package.json' with { type: 'json' };

// You can use a local .env file during manual testing, but in GitHub Actions, these come from Secrets.
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_DIRECT_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("❌ Missing Supabase credentials! Please ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const version = packageJson.version; // e.g., "1.0.0"
const timestamp = Date.now().toString(); // bundle_version
const zipFileName = `ota-${version}-${timestamp}.zip`;

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

    console.log(`☁️ Uploading ${zipFileName} to Supabase storage via TUS (Chunked Upload)...`);
    
    await new Promise((resolve, reject) => {
        const fileStream = fs.createReadStream(zipFileName);
        const stats = fs.statSync(zipFileName);
        
        const upload = new tus.Upload(fileStream, {
            endpoint: `${SUPABASE_URL}/storage/v1/upload/resumable`,
            retryDelays: [0, 3000, 5000, 10000, 20000],
            headers: {
                Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                'x-upsert': 'true',
            },
            uploadDataDuringCreation: true,
            removeFingerprintOnSuccess: true,
            metadata: {
                bucketName: 'ota-updates',
                objectName: zipFileName,
                contentType: 'application/zip',
                cacheControl: '3600',
            },
            chunkSize: 6 * 1024 * 1024, // 6MB chunks to bypass 50MB Cloudflare limit
            uploadSize: stats.size,
            onError: function (error) {
                console.error('Failed to upload to storage:', error);
                reject(error);
            },
            onProgress: function (bytesUploaded, bytesTotal) {
                const percentage = ((bytesUploaded / bytesTotal) * 100).toFixed(2);
                console.log(`Upload Progress: ${percentage}%`);
            },
            onSuccess: function () {
                console.log('Upload successful!');
                resolve();
            },
        });

        upload.findPreviousUploads().then(function (previousUploads) {
            if (previousUploads.length) {
                upload.resumeFromPreviousUpload(previousUploads[0]);
            }
            upload.start();
        });
    });

    const { data: urlData } = supabase.storage.from('ota-updates').getPublicUrl(zipFileName);
    const publicUrl = urlData.publicUrl;

    console.log(`📝 Updating database for target app version: ${version} with bundle_version: ${timestamp}...`);
    const { error: dbErr } = await supabase.from('ota_updates').insert({
        target_app_version: version,
        bundle_version: timestamp,
        bundle_url: publicUrl
    });

    if (dbErr) {
        console.error("Failed to insert into database:", dbErr);
        throw dbErr;
    }

    console.log('✅ OTA Deployment Successful!');
    
    // Clean up the local zip file
    fs.unlinkSync(zipFileName);
    console.log(`🧹 Cleaned up local file ${zipFileName}.`);

    // Automatically trigger cleanup
    console.log("🧹 Triggering cleanup...");
    try {
        execSync('node scripts/cleanup-ota.js', { stdio: 'inherit' });
    } catch (e) {
        console.warn("⚠️ Cleanup script failed, but deployment was successful.");
    }
}

deploy().catch(err => {
    console.error("❌ Deployment failed:", err);
    process.exit(1);
});
