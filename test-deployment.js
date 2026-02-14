/**
 * Quick deployment test script
 * Tests Redis and Supabase connections + queries deal data
 */

import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';
import 'dotenv/config';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 Testing Deployment...\n');

// Test 1: Redis Connection
console.log('1️⃣ Testing Redis Connection...');
const redis = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: true, // Don't connect immediately
  retryStrategy(times) {
    if (times > 3) {
      console.log('❌ Redis: Max retries reached');
      return null; // Stop retrying
    }
    return Math.min(times * 200, 2000);
  }
});

redis.on('error', (err) => {
  console.log('❌ Redis Error:', err.message);
});

try {
  await redis.connect();
  await redis.ping();
  console.log('✅ Redis: Connected and responding to PING');
  
  // Test DBSIZE
  const size = await redis.dbsize();
  console.log(`   Keys in database: ${size}`);
  
  await redis.quit();
} catch (err) {
  console.log('❌ Redis: Connection failed');
  console.log('   Error:', err.message);
  console.log('   Check your REDIS_URL format. Should be: rediss://default:password@host:6379');
}

// Test 2: Supabase Connection
console.log('\n2️⃣ Testing Supabase Connection...');
try {
  const { data, error, count } = await supabase
    .from('deal_sources')
    .select('*', { count: 'exact' });
  
  if (error) throw error;
  
  console.log(`✅ Supabase: Connected`);
  console.log(`   Deal sources in database: ${count}`);
  console.log(`   Enabled sources: ${data.filter(s => s.enabled).length}`);
} catch (err) {
  console.log('❌ Supabase: Connection failed');
  console.log('   Error:', err.message);
}

// Test 3: Check Deals
console.log('\n3️⃣ Checking Deals Table...');
try {
  const { data, error, count } = await supabase
    .from('deals')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active');
  
  if (error) throw error;
  
  console.log(`✅ Active deals in database: ${count}`);
  
  if (count === 0) {
    console.log('   ℹ️  No deals yet - this is normal for first 30 minutes after deployment');
    console.log('   ℹ️  The deal worker polls RSS feeds every 30-60 minutes');
  }
} catch (err) {
  console.log('❌ Failed to query deals');
  console.log('   Error:', err.message);
}

// Test 4: Check Latest Ingestion Runs
console.log('\n4️⃣ Checking Ingestion Runs...');
try {
  const { data, error } = await supabase
    .from('deal_ingestion_runs')
    .select('*, deal_sources(name)')
    .order('started_at', { ascending: false })
    .limit(5);
  
  if (error) throw error;
  
  if (data.length === 0) {
    console.log('   ℹ️  No ingestion runs yet - worker may not have started polling');
  } else {
    console.log(`✅ Recent ingestion runs: ${data.length}`);
    data.forEach((run, i) => {
      const status = run.status === 'success' ? '✅' : run.status === 'running' ? '⏳' : '❌';
      console.log(`   ${status} ${run.deal_sources?.name || 'Unknown'}: ${run.status} (${run.items_created || 0} created)`);
    });
  }
} catch (err) {
  console.log('   ℹ️  Could not query ingestion runs (table might not exist yet)');
}

console.log('\n✅ Tests Complete!\n');
process.exit(0);
