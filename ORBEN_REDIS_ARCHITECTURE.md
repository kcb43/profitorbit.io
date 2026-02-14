# Why Redis + Supabase? Architecture Explained

## TL;DR

**Supabase** = Your durable database (Postgres)  
**Redis** = Your speed layer (in-memory cache)  

They solve **different problems** and work together.

---

## The Problem

Without Redis, every request hits Supabase:

```
User requests deal feed (50 deals)
  ↓
Query Supabase (200-500ms)
  ↓
Return to user

Next user requests same feed
  ↓
Query Supabase AGAIN (200-500ms)  ← Wasteful!
  ↓
Return to user
```

**Result:** Slow, expensive, doesn't scale.

---

## The Solution

With Redis caching:

```
User 1 requests deal feed
  ↓
Check Redis (5ms) → MISS
  ↓
Query Supabase (300ms)
  ↓
Store in Redis (TTL: 60 seconds)
  ↓
Return to user

User 2-100 request same feed (within 60 sec)
  ↓
Check Redis (5ms) → HIT! ✅
  ↓
Return cached data

Total time: 5ms (60x faster!)
```

**Result:** Fast, cheap, scales to millions.

---

## Why Not Just Use Supabase?

### Supabase (PostgreSQL) is good for:

✅ **Durable storage** - Data persists forever  
✅ **Complex queries** - Joins, aggregations, full-text search  
✅ **ACID transactions** - Data integrity guarantees  
✅ **Relationships** - Foreign keys, referential integrity  

But **PostgreSQL is slow at:**
- ❌ Sub-millisecond reads (200-500ms typical)
- ❌ High-frequency writes (thousands per second)
- ❌ TTL/expiration (no built-in cache invalidation)
- ❌ Atomic counters (rate limiting)
- ❌ Distributed locks (preventing duplicate jobs)

### Redis is designed for:

✅ **Sub-millisecond reads** - <5ms typical  
✅ **TTL/expiration** - Keys auto-delete after N seconds  
✅ **Atomic counters** - Perfect for rate limiting  
✅ **Locks** - Distributed locking with `SET NX EX`  
✅ **Simple key-value** - No query parsing overhead  

But **Redis is NOT a database:**
- ❌ No durable storage (data lives in RAM)
- ❌ No complex queries (just GET/SET)
- ❌ No relationships
- ❌ Data can be evicted under memory pressure

---

## Real Orben Use Cases

### 1. Deal Feed Caching

**Without Redis:**
```sql
-- Every page load runs this query (300ms)
SELECT * FROM deals 
WHERE status = 'active' AND score >= 50
ORDER BY posted_at DESC 
LIMIT 50;
```

**With Redis:**
```javascript
// First load: 300ms (Supabase)
// Next 100 loads (60 sec): 5ms each (Redis)

const key = `deal:feed:${hash(filters)}`;
const cached = await redis.get(key); // 5ms
if (cached) return JSON.parse(cached);

// Cache miss - query DB
const deals = await supabase.from('deals').select('*')...;
await redis.set(key, JSON.stringify(deals), 'EX', 60);
```

**Savings:** 60x faster, 99% fewer DB queries

---

### 2. Search Result Caching

**Without Redis:**
```javascript
// Every search calls eBay API ($$$, slow)
const results = await ebayAPI.search('iPhone 15'); // 1500ms + quota
```

**With Redis:**
```javascript
const key = `search:ebay:US:${md5('iphone 15')}`;
const cached = await redis.get(key); // 5ms
if (cached) return JSON.parse(cached); // Hit!

// Cache miss - call API
const results = await ebayAPI.search('iPhone 15'); // 1500ms
await redis.set(key, JSON.stringify(results), 'EX', 21600); // 6h
```

**Savings:** 300x faster, 99% fewer API calls, stay under quotas

---

### 3. Rate Limiting (Quota Tracking)

**Without Redis:**
```sql
-- Count searches in last 24h (200ms query)
SELECT COUNT(*) FROM search_snapshots 
WHERE user_id = 'xxx' 
  AND created_at > now() - interval '24 hours';
```

**With Redis:**
```javascript
// Atomic counter (1ms)
const count = await redis.incr(`quota:user:${userId}:20260213`);
await redis.expire(`quota:user:${userId}:20260213`, 86400);

if (count > 100) throw new Error('Daily limit exceeded');
```

**Savings:** 200x faster, no DB load, atomic guarantees

---

### 4. Ingestion Locks (Prevent Duplicates)

**Without Redis:**
```sql
-- Advisory locks in Postgres (complex, error-prone)
SELECT pg_try_advisory_lock(hashtext('source_123'));
```

**With Redis:**
```javascript
// Simple distributed lock (1ms)
const gotLock = await redis.set(
  `lock:ingest:source:${sourceId}`,
  '1',
  'NX',  // Only set if not exists
  'EX', 300  // Auto-expire in 5 minutes
);

if (!gotLock) {
  console.log('Another worker is already ingesting');
  return; // Skip gracefully
}
```

**Savings:** Simple, reliable, auto-cleanup

---

## Architecture Diagram

```
┌──────────────────────────────────────┐
│         FRONTEND (Vercel)            │
│   User clicks /deals                 │
└────────────┬─────────────────────────┘
             │
             ▼
┌──────────────────────────────────────┐
│         ORBEN-API (Fly.io)           │
│                                      │
│  1. Check Redis cache ────────┐     │
│     key: deal:feed:abc123     │     │
│                                │     │
│     ├─ HIT (5ms) → return ✅  │     │
│     └─ MISS → query Supabase  │     │
└─────────────┬──────────────────┼─────┘
              │                  │
              ▼                  ▼
    ┌─────────────────┐   ┌─────────────┐
    │   SUPABASE      │   │    REDIS    │
    │   (Postgres)    │   │  (Upstash)  │
    │                 │   │             │
    │ • Durable data  │   │ • Cache     │
    │ • Complex query │   │ • Locks     │
    │ • 300ms read    │   │ • Counters  │
    └─────────────────┘   │ • 5ms read  │
                          └─────────────┘
```

**Flow:**
1. Frontend → API (check Redis)
2. Redis HIT → Return (5ms total)
3. Redis MISS → Query Supabase (300ms) → Cache in Redis → Return
4. Next 100 users → Redis HIT (5ms each)

---

## Cost Comparison

### Without Redis (Supabase only)

- 1,000 users/day × 10 pageviews = **10,000 DB queries**
- Supabase free tier: 500MB DB, unlimited queries (but slow)
- Average response time: **300ms**

### With Redis (Supabase + Upstash)

- 1,000 users/day × 10 pageviews = 10,000 requests
- **100 DB queries** (99% cache hit rate)
- 9,900 Redis hits (instant)
- Average response time: **10ms**

**Result:** 30x faster, 100x fewer DB queries

---

## Upstash vs Fly Redis

You have **two options** for Redis:

### Option 1: Upstash (Recommended)

- **Free tier:** 10,000 commands/day
- **No maintenance:** Fully managed
- **Global:** Low latency worldwide
- **Setup:** 2 minutes (web dashboard)

### Option 2: Fly Redis

- **Cost:** ~$5-10/month
- **Full control:** Your own instance
- **Same region as workers:** Ultra-low latency
- **Setup:** `fly redis create` (5 minutes)

**Recommendation:** Start with Upstash free tier, migrate to Fly Redis if you outgrow it.

---

## What Happens Without Redis?

Your system would still work, but:

❌ **10-30x slower** (every request hits DB)  
❌ **Higher Supabase costs** (paid tier needed sooner)  
❌ **API quota overages** (eBay/RapidAPI limits hit faster)  
❌ **Duplicate ingestions** (no locks = waste)  
❌ **Rate limiting issues** (can't track quotas efficiently)  

**Redis costs $0-5/month but saves you 10x that in Supabase/API costs.**

---

## Typical Cache Hit Rates

From production systems:

| Data Type | TTL | Hit Rate | Savings |
|-----------|-----|----------|---------|
| Deal feed pages | 60 sec | 90-95% | 10-20x fewer queries |
| Individual deals | 7 days | 70-80% | 3-5x fewer queries |
| Search results | 6-24h | 60-80% | 3-5x fewer API calls |
| User quotas | 24h | 100% | N/A (Redis only) |

**Overall:** Redis reduces backend load by **10-20x**.

---

## Quick Setup (2 minutes)

### Upstash

1. Go to https://console.upstash.com/
2. Click "Create Database"
3. Select "Global" (multi-region)
4. Copy connection URL: `rediss://default:xxx@fly.upstash.io:6379`
5. Add to Fly secrets: `fly secrets set REDIS_URL="..."`

Done!

---

## Redis Key Patterns (What You're Caching)

```
# Deal cards (7 days)
deal:card:550e8400-e29b-41d4-a716-446655440000

# Deal feed pages (60 seconds)
deal:feed:a1b2c3:p0

# Search results (6-24 hours)
search:ebay:US:md5hash
search:google:US:md5hash

# Rate limit counters (24 hours)
quota:user:user-id:20260213
quota:provider:ebay:20260213

# Ingestion locks (5 minutes)
lock:ingest:source:source-uuid
```

**Total keys:** ~1000-10,000 depending on traffic (well within Upstash free tier)

---

## Monitoring Redis

### Upstash Dashboard

- View operations/second graph
- Check memory usage
- See hit/miss ratio
- Monitor key count

### Via CLI

```bash
# Connect to Redis
redis-cli -u $REDIS_URL

# Check key count
> DBSIZE

# View sample keys
> SCAN 0 MATCH deal:* COUNT 10

# Check TTL
> TTL deal:feed:abc123

# Monitor in real-time
> MONITOR
```

---

## When to Skip Redis

You could skip Redis if:

- Traffic is very low (<10 users/day)
- You don't care about speed
- Budget is $0 absolutely

But even then, Upstash free tier gives you **zero-cost caching**.

---

## Summary

**Question:** "Why do I need Redis when I have Supabase?"

**Answer:**
- **Supabase** = Your permanent storage (like a hard drive)
- **Redis** = Your speed layer (like RAM)
- Together they make your app **30x faster** and **10x cheaper**

**Cost:** Free (Upstash) or $5/mo (Fly Redis)  
**Setup time:** 2 minutes  
**Performance gain:** 10-30x faster  
**Cost savings:** Prevents Supabase overages  

**Worth it?** Absolutely yes! 🚀

---

## Real-World Example

### Without Redis
```
1000 users visit /deals
  ↓
1000 x Supabase queries (300ms each)
  ↓
Total DB load: 1000 queries
Average response: 300ms
```

### With Redis
```
1000 users visit /deals
  ↓
1st user: Supabase query (300ms) → cache in Redis
  ↓
Users 2-1000: Redis cache hit (5ms each)
  ↓
Total DB load: 1 query
Average response: 10ms
```

**You just made your app 30x faster and 1000x more efficient!**
