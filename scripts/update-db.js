import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    global: {
        headers: {
            'Origin': 'https://mishra-aashu.github.io',
            'Referer': 'https://mishra-aashu.github.io/'
        }
    }
});

// GitHub workflow se arguments lena
const [version, timestamp, downloadUrl] = process.argv.slice(2);

async function updateDatabase() {
    console.log(`📝 Registering GitHub Release in Supabase DB...`);
    console.log(`Version: ${version}, URL: ${downloadUrl}`);

    const { error } = await supabase.from('ota_updates').insert({
        target_app_version: version,
        bundle_version: timestamp, // Hum timestamp ko hi bundle version maan rahe hain
        bundle_url: downloadUrl
    });

    if (error) {
        console.error('❌ DB Update Failed:', error);
        process.exit(1);
    }

    console.log('✅ Database updated successfully with GitHub link!');
}

updateDatabase();
