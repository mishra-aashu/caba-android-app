import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Service role for admin access
);

const CRITICAL_TABLES = [
  'users',
  'messages',
  'chats_list', // Fixed from 'chats' to match existing schema
  'groups',
  'group_members',
  'call_history', // Fixed from 'calls'
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
        console.error(`❌ ${table}: Error fetching policies -`, error.message);
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
