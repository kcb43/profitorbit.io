/**
 * Orben Deal Worker
 * 
 * Polls RSS feeds, affiliate feeds, and retailer APIs to ingest deals.
 * - Normalizes data into canonical deal format
 * - Dedupes via hash (title + url + merchant + price_bucket)
 * - Scores deals 0-100 for reseller value
 * - Caches deal cards in Redis
 * - Writes to Supabase deals table
 */

import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';
import Parser from 'rss-parser';
import crypto from 'crypto';
import 'dotenv/config';

// ==========================================
// Initialize clients
// ==========================================
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const redis = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  }
});

// Handle Redis errors gracefully
redis.on('error', (err) => {
  console.error('❌ Redis connection error:', err.message);
});

redis.on('connect', () => {
  console.log('✅ Redis connected successfully');
});

redis.on('ready', () => {
  console.log('✅ Redis ready for commands');
});

const parser = new Parser({
  customFields: {
    item: [
      ['media:content', 'media'],
      ['enclosure', 'enclosure']
    ]
  }
});

// ==========================================
// Normalization helpers
// ==========================================
function normalizeUrl(url) {
  try {
    const u = new URL(url);
    u.hash = '';
    // Remove common tracking params
    const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'ref', 'affiliate'];
    trackingParams.forEach(param => u.searchParams.delete(param));
    return u.toString();
  } catch {
    return url;
  }
}

function priceBucket(price) {
  if (price == null) return 'noprice';
  if (price < 20) return '<20';
  if (price < 50) return '20-50';
  if (price < 100) return '50-100';
  if (price < 200) return '100-200';
  return '200+';
}

function dedupeHash(title, url, merchant, price) {
  const base = `${title.toLowerCase().trim()}|${normalizeUrl(url)}|${(merchant || '').toLowerCase()}|${priceBucket(price)}`;
  return crypto.createHash('sha256').update(base).digest('hex');
}

// ==========================================
// Deal scoring (simple v1)
// ==========================================
async function scoreDeal(deal) {
  let score = 0;
  const title = (deal.title || '').toLowerCase();
  const merchant = (deal.merchant || '').toLowerCase();
  const description = (deal.description || '').toLowerCase();

  // Major retailer boost
  const whitelist = ['amazon', 'walmart', 'best buy', 'target', 'home depot', 'lowes', 'bhphoto', 'newegg', 'costco', 'sams club'];
  if (whitelist.some(w => merchant.includes(w))) {
    score += 20;
  }

  // Discount percentage boost
  if (deal.original_price && deal.price) {
    const discount = (Number(deal.original_price) - Number(deal.price)) / Number(deal.original_price);
    if (discount >= 0.30) score += 10;
    if (discount >= 0.50) score += 10;
    if (discount >= 0.70) score += 5;
  }

  // High-demand categories for resellers
  const hotCategories = [
    'console', 'gpu', 'rtx', 'iphone', 'macbook', 'ipad', 'airpods',
    'camera', 'lego', 'nintendo', 'playstation', 'xbox', 'switch',
    'drone', 'tools', 'dewalt', 'milwaukee', 'makita', 'ryobi',
    'collectible', 'funko', 'trading card', 'pokemon', 'vintage'
  ];
  
  const content = title + ' ' + description;
  const matches = hotCategories.filter(cat => content.includes(cat)).length;
  score += Math.min(15, matches * 5);

  // Penalty for refurb/used (unless it's collectibles)
  if (/(refurb|refurbished|used|open box)/i.test(content) && !/(collectible|vintage|rare)/i.test(content)) {
    score -= 5;
  }

  // Bonus for free shipping
  if (deal.shipping_price === 0 || /free shipping/i.test(content)) {
    score += 5;
  }

  // Limited time bonus
  if (/limited time|flash|lightning|today only/i.test(content)) {
    score += 5;
  }

  return Math.max(0, Math.min(100, score));
}

// ==========================================
// Extract image from RSS item
// ==========================================
function extractImage(item) {
  // Try media:content
  if (item.media && item.media.$) {
    return item.media.$.url;
  }
  
  // Try enclosure
  if (item.enclosure && item.enclosure.url) {
    return item.enclosure.url;
  }

  // Try content:encoded or description HTML
  const content = item['content:encoded'] || item.content || item.description || '';
  const imgMatch = content.match(/<img[^>]+src="([^">]+)"/);
  if (imgMatch) {
    return imgMatch[1];
  }

  return null;
}

// ==========================================
// Ingest a single source
// ==========================================
async function ingestSource(source) {
  const lockKey = `lock:ingest:source:${source.id}`;
  const gotLock = await redis.set(lockKey, '1', 'NX', 'EX', 300); // 5 min lock

  if (!gotLock) {
    console.log(`[${source.name}] Already locked, skipping`);
    return;
  }

  console.log(`[${source.name}] Starting ingestion from ${source.rss_url}`);

  // Create ingestion run record
  const { data: run, error: runError } = await supabase
    .from('deal_ingestion_runs')
    .insert([{
      source_id: source.id,
      started_at: new Date().toISOString(),
      status: 'running'
    }])
    .select()
    .single();

  if (runError) {
    console.error(`[${source.name}] Failed to create run:`, runError);
    await redis.del(lockKey);
    return;
  }

  const runId = run.id;
  let seen = 0, created = 0, updated = 0;

  try {
    // Parse RSS feed
    const feed = await parser.parseURL(source.rss_url);
    console.log(`[${source.name}] Fetched ${feed.items?.length || 0} items`);

    for (const item of (feed.items || [])) {
      seen++;

      const title = item.title?.trim();
      const url = item.link?.trim();

      if (!title || !url) {
        console.log(`[${source.name}] Skipping item without title/url`);
        continue;
      }

      // Parse price from title or description (very basic)
      const priceMatch = (title + ' ' + (item.contentSnippet || '')).match(/\$(\d+(?:\.\d{2})?)/);
      const price = priceMatch ? parseFloat(priceMatch[1]) : null;

      const deal = {
        source_id: source.id,
        source_item_id: item.guid || item.id || null,
        title,
        description: item.contentSnippet || item.summary || null,
        merchant: source.name,
        url: normalizeUrl(url),
        image_url: extractImage(item),
        price,
        posted_at: item.isoDate || item.pubDate || new Date().toISOString(),
        hash: dedupeHash(title, url, source.name, price),
        status: 'active'
      };

      // Score the deal
      const score = await scoreDeal(deal);
      deal.score = score;

      // Check if exists by hash
      const { data: existing } = await supabase
        .from('deals')
        .select('id, score')
        .eq('hash', deal.hash)
        .maybeSingle();

      if (existing?.id) {
        // Update existing
        const { error: updateError } = await supabase
          .from('deals')
          .update({
            title: deal.title,
            description: deal.description,
            image_url: deal.image_url,
            price: deal.price,
            score: deal.score,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id);

        if (!updateError) {
          updated++;
          // Update cache
          await redis.set(
            `deal:card:${existing.id}`,
            JSON.stringify({ id: existing.id, ...deal }),
            'EX',
            60 * 60 * 24 * 7 // 7 days
          );
        }
      } else {
        // Insert new deal
        const { data: newDeal, error: insertError } = await supabase
          .from('deals')
          .insert([deal])
          .select()
          .single();

        if (!insertError && newDeal?.id) {
          created++;
          
          // Cache deal card
          await redis.set(
            `deal:card:${newDeal.id}`,
            JSON.stringify(newDeal),
            'EX',
            60 * 60 * 24 * 7
          );

          // Create event
          await supabase.from('deal_events').insert([{
            deal_id: newDeal.id,
            type: 'created',
            payload: { source: source.name, score }
          }]);

          console.log(`[${source.name}] Created deal: ${title.slice(0, 50)}... (score: ${score})`);
        }
      }
    }

    // Mark run as successful
    await supabase
      .from('deal_ingestion_runs')
      .update({
        finished_at: new Date().toISOString(),
        status: 'success',
        items_seen: seen,
        items_created: created,
        items_updated: updated
      })
      .eq('id', runId);

    // Update source
    await supabase
      .from('deal_sources')
      .update({
        last_polled_at: new Date().toISOString(),
        last_success_at: new Date().toISOString(),
        fail_count: 0
      })
      .eq('id', source.id);

    console.log(`[${source.name}] Success: ${created} created, ${updated} updated, ${seen} seen`);

  } catch (error) {
    console.error(`[${source.name}] Error:`, error.message);

    // Mark run as failed
    await supabase
      .from('deal_ingestion_runs')
      .update({
        finished_at: new Date().toISOString(),
        status: 'failed',
        error: error.message || String(error)
      })
      .eq('id', runId);

    // Update source fail count
    await supabase
      .from('deal_sources')
      .update({
        last_polled_at: new Date().toISOString(),
        fail_count: (source.fail_count || 0) + 1
      })
      .eq('id', source.id);

  } finally {
    // Release lock
    await redis.del(lockKey);
  }
}

// ==========================================
// Startup checks
// ==========================================
async function startupChecks() {
  console.log('🔍 Running startup checks...');
  
  // Check Redis
  try {
    await redis.ping();
    console.log('✅ Redis connection verified');
  } catch (err) {
    console.error('❌ Redis connection failed:', err.message);
    throw err;
  }

  // Check Supabase
  try {
    const { data, error } = await supabase.from('deal_sources').select('count', { count: 'exact', head: true });
    if (error) throw error;
    console.log('✅ Supabase connection verified');
  } catch (err) {
    console.error('❌ Supabase connection failed:', err.message);
    throw err;
  }

  console.log('✅ All startup checks passed\n');
}

// ==========================================
// Main polling loop
// ==========================================
async function pollLoop() {
  console.log('🚀 Orben Deal Worker starting...');
  
  // Run startup checks first
  await startupChecks();

  while (true) {
    try {
      const { data: sources, error } = await supabase
        .from('deal_sources')
        .select('*')
        .eq('enabled', true);

      if (error) {
        console.error('Failed to fetch sources:', error);
      } else {
        console.log(`\n📊 Polling ${sources.length} sources...`);
        
        for (const source of sources) {
          // Only poll RSS sources for now
          if (source.type === 'rss' && source.rss_url) {
            // Check if it's time to poll
            if (source.last_polled_at) {
              const lastPoll = new Date(source.last_polled_at);
              const nextPoll = new Date(lastPoll.getTime() + source.poll_interval_minutes * 60 * 1000);
              if (new Date() < nextPoll) {
                console.log(`[${source.name}] Not ready (next poll: ${nextPoll.toLocaleTimeString()})`);
                continue;
              }
            }

            await ingestSource(source);
          }
        }
      }
    } catch (err) {
      console.error('Poll loop error:', err);
    }

    // Wait 60 seconds before next iteration
    await new Promise(resolve => setTimeout(resolve, 60_000));
  }
}

// ==========================================
// Health check endpoint (optional)
// ==========================================
import http from 'http';

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'orben-deal-worker', ts: new Date().toISOString() }));
  } else {
    res.writeHead(404);
    res.end();
  }
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Health check server listening on port ${PORT}`);
  pollLoop().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
});
