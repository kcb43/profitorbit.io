/**
 * Apply Facebook Scraping Jobs Migration
 * Run this once to create the necessary database tables
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = 'https://hlcwhpajorzbleabavcr.supabase.co';
const SERVICE_ROLE_KEY = 'sb_secret_jfF_FPZMZNXkJcAp8da0SA_UcqFHU4-';

async function runMigration() {
  console.log('🔄 Running Facebook scraping jobs migration...');

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  // Read the migration file
  const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20260131_facebook_scraping_jobs.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  // Split by semicolons to execute individual statements
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`📝 Found ${statements.length} SQL statements to execute`);

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    console.log(`\n[${i + 1}/${statements.length}] Executing:`);
    console.log(statement.substring(0, 100) + '...');

    try {
      const { error } = await supabase.rpc('exec_sql', { sql_query: statement });
      
      if (error) {
        // Try direct execution if RPC fails
        const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
          },
          body: JSON.stringify({ sql_query: statement })
        });

        if (!response.ok) {
          console.error(`❌ Failed:`, error?.message || 'Unknown error');
        } else {
          console.log(`✅ Success`);
        }
      } else {
        console.log(`✅ Success`);
      }
    } catch (err) {
      console.error(`❌ Error:`, err.message);
    }
  }

  console.log('\n✅ Migration complete!');
  console.log('\n📋 Verifying table creation...');

  // Verify the table exists
  const { data, error } = await supabase
    .from('facebook_scraping_jobs')
    .select('count')
    .limit(1);

  if (error) {
    console.error('❌ Table verification failed:', error);
    console.log('\n⚠️  You may need to run the SQL manually in Supabase SQL Editor');
    console.log('📂 Migration file:', migrationPath);
  } else {
    console.log('✅ Table verified: facebook_scraping_jobs exists');
  }
}

runMigration().catch(console.error);
