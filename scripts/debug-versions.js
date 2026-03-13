import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkVersions() {
    console.log('--- Checking app_versions table ---');
    const { data, error } = await supabase
        .from('app_versions')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error:', error);
    } else {
        console.table(data);
    }
}

checkVersions();
