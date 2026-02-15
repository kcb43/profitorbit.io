/**
 * Flush specific cache keys from Redis
 * Usage: node flush-cache.js <query1> <query2> ...
 */

import Redis from 'ioredis';
import crypto from 'crypto';
import 'dotenv/config';

const redis = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true
});

function normalizeQuery(q) {
  return q.toLowerCase().replace(/\s+/g, ' ').trim();
}

function getCacheKey(provider, country, query) {
  const hash = crypto.createHash('md5').update(`${provider}:${country}:${normalizeQuery(query)}`).digest('hex');
  return `search:v7:${provider}:${country}:${hash}`;
}

async function flushCache(queries) {
  console.log('🧹 Flushing cache for queries:', queries);
  
  const provider = 'google';
  const country = 'US';
  
  for (const query of queries) {
    const cacheKey = getCacheKey(provider, country, query);
    console.log(`  Deleting: ${cacheKey} (query: "${query}")`);
    const result = await redis.del(cacheKey);
    console.log(`  Result: ${result === 1 ? '✅ Deleted' : '❌ Not found'}`);
  }
  
  await redis.quit();
  console.log('✅ Cache flush complete');
}

// Get queries from command line args
const queries = process.argv.slice(2);

if (queries.length === 0) {
  console.error('❌ Usage: node flush-cache.js <query1> <query2> ...');
  console.error('❌ Example: node flush-cache.js "fluval" "petco"');
  process.exit(1);
}

flushCache(queries).catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
