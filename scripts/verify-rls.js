import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️ Warning: Supabase URL and Key are required. Please ensure VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or VITE_SUPABASE_ANON_KEY) are set in your environment or .env file.');
  process.exit(0); // Exit gracefully during build/CI steps if env is missing
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  global: {
    headers: {
      'Origin': 'http://localhost:5173',
      'Referer': 'http://localhost:5173/'
    }
  }
});

const CRITICAL_TABLES = [
  'users',
  'messages',
  'chats', // Matches the Supabase table name queried in frontend
  'groups',
  'group_members',
  'call_history',
  'reminders',
];

const checkRLSPolicies = async () => {
  console.log('🔍 Checking RLS Policies...\n');

  for (const table of CRITICAL_TABLES) {
    try {
      const { data, error } = await supabase.rpc('get_table_policies', {
        table_name: table,
      });

      if (error) {
        console.error(`❌ ${table}: Error fetching policies -`, error.message || error);
        continue;
      }

      if (!data || data.length === 0) {
        console.error(`❌ ${table}: NO RLS POLICIES FOUND!`);
        continue;
      }

      console.log(`✅ ${table}: ${data.length} policies found`);
      
      // Check for common patterns
      const hasSelectPolicy = data.some(p => p.cmd === 'SELECT');
      const hasInsertPolicy = data.some(p => p.cmd === 'INSERT');
      const hasUpdatePolicy = data.some(p => p.cmd === 'UPDATE');
      const hasDeletePolicy = data.some(p => p.cmd === 'DELETE');

      if (!hasSelectPolicy) console.warn(`   ⚠️  Missing SELECT policy`);
      if (!hasInsertPolicy) console.warn(`   ⚠️  Missing INSERT policy`);
      if (!hasUpdatePolicy) console.warn(`   ⚠️  Missing UPDATE policy`);
      if (!hasDeletePolicy) console.warn(`   ⚠️  Missing DELETE policy`);
    } catch (err) {
      console.error(`❌ ${table}: Exception -`, err.message);
    }
  }
};

checkRLSPolicies();
