# Facebook Scraper Worker - Deployment Guide

## Overview

This worker service processes Facebook Marketplace listing scraping jobs in the background, using Puppeteer to extract full descriptions and metadata that Facebook's GraphQL API doesn't provide.

## Architecture

```
Extension → API → Database Job Queue → Worker (Puppeteer) → Database Results → API → Extension
```

1. **Extension** creates scraping jobs via API
2. **Worker** polls database for pending jobs
3. **Worker** opens Facebook pages with Puppeteer and extracts data
4. **Worker** stores results back to database
5. **Extension** polls for completed results

---

## Step 1: Run Database Migration

### Option A: Supabase Dashboard (Recommended)

1. Go to your Supabase project: https://supabase.com/dashboard/project/hlcwhpajorzbleabavcr
2. Click **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy the entire contents of `supabase/migrations/20260131_facebook_scraping_jobs.sql`
5. Paste into the SQL editor
6. Click **Run** (or press Ctrl+Enter)
7. Verify: You should see "Success. No rows returned"

### Option B: Using Node Script

```bash
cd f:\bareretail
node scripts/apply-facebook-migration.js
```

---

## Step 2: Install Worker Dependencies

```bash
cd f:\bareretail\worker
npm install
```

---

## Step 3: Test Worker Locally

Before deploying to Fly.io, test the worker locally:

```bash
cd f:\bareretail\worker
node index.js
```

You should see:
```
🚀 Facebook Scraper Worker starting...
📊 Poll interval: 3000ms
🔄 Max retries: 3
⚡ Concurrent jobs: 2
🌐 Launching browser...
✅ Browser launched
```

The worker will now poll for jobs every 3 seconds.

**To test:**
1. Keep the worker running
2. Create a test job via API or directly in database
3. Watch worker logs for processing

**Stop worker:** Press `Ctrl+C`

---

## Step 4: Deploy to Fly.io

### 4.1 Create the Fly.io App

```bash
cd f:\bareretail\worker
fly apps create profitorbit-facebook-worker
```

### 4.2 Set Environment Variables

```bash
fly secrets set \
  VITE_SUPABASE_URL=https://hlcwhpajorzbleabavcr.supabase.co \
  SUPABASE_SERVICE_ROLE_KEY=sb_secret_jfF_FPZMZNXkJcAp8da0SA_UcqFHU4- \
  -a profitorbit-facebook-worker
```

### 4.3 Deploy

```bash
fly deploy -a profitorbit-facebook-worker
```

### 4.4 Monitor Logs

```bash
fly logs -a profitorbit-facebook-worker
```

You should see the worker starting up and polling for jobs.

---

## Step 5: Update Extension to Use Worker

### 5.1 Modify `facebook-api.js`

Replace the offscreen scraping logic with API calls:

```javascript
// NEW: Create scraping jobs via API
async function scrapeMultipleListings(listings) {
  console.log(`🔍 Creating scraping jobs for ${listings.length} items...`);
  
  // Get user ID from extension storage or auth
  const userId = await getUserId(); // Implement this
  
  // Create jobs via API
  const response = await fetch('https://profitorbit.io/api/facebook/scrape-details', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ listings, userId })
  });
  
  const { jobs } = await response.json();
  const jobIds = jobs.map(j => j.id).join(',');
  
  // Poll for results
  return await pollForResults(jobIds, userId);
}

async function pollForResults(jobIds, userId, maxWait = 60000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWait) {
    const response = await fetch(
      `https://profitorbit.io/api/facebook/scrape-status?jobIds=${jobIds}&userId=${userId}`
    );
    
    const { jobs, summary } = await response.json();
    
    // Check if all jobs are done
    if (summary.pending === 0 && summary.processing === 0) {
      console.log(`✅ All jobs complete: ${summary.completed} succeeded, ${summary.failed} failed`);
      
      // Return enriched listings
      return jobs.map(job => ({
        ...job,
        ...job.scraped_data
      }));
    }
    
    console.log(`⏳ Waiting for jobs: ${summary.pending + summary.processing} remaining...`);
    await new Promise(r => setTimeout(r, 2000)); // Poll every 2 seconds
  }
  
  throw new Error('Timeout waiting for scraping jobs');
}
```

---

## Step 6: Testing End-to-End

1. **Start worker** (if testing locally):
   ```bash
   cd f:\bareretail\worker
   node index.js
   ```

2. **Open extension** and go to Import page

3. **Click "Get Latest Facebook Items"** - should fetch basic data fast

4. **Select items** and click **"Import"**
   - Extension creates scraping jobs
   - Worker processes them
   - Extension polls for results
   - Import completes with full descriptions

5. **Check logs:**
   - Worker: `fly logs -a profitorbit-facebook-worker`
   - Extension: Browser DevTools console

---

## Monitoring & Maintenance

### Check Worker Status

```bash
fly status -a profitorbit-facebook-worker
```

### View Recent Logs

```bash
fly logs -a profitorbit-facebook-worker --lines 100
```

### Restart Worker

```bash
fly apps restart profitorbit-facebook-worker
```

### Scale Worker (if needed)

```bash
# Increase memory if scraping fails
fly scale memory 1024 -a profitorbit-facebook-worker

# Add more machines for concurrent processing
fly scale count 2 -a profitorbit-facebook-worker
```

### Check Job Queue in Database

```sql
SELECT 
  status, 
  COUNT(*) as count,
  AVG(EXTRACT(EPOCH FROM (completed_at - created_at))) as avg_duration_seconds
FROM facebook_scraping_jobs
WHERE created_at > NOW() - INTERVAL '1 day'
GROUP BY status;
```

---

## Troubleshooting

### Worker Not Processing Jobs

1. Check worker is running: `fly status -a profitorbit-facebook-worker`
2. Check logs: `fly logs -a profitorbit-facebook-worker`
3. Verify environment variables: `fly secrets list -a profitorbit-facebook-worker`

### Jobs Stuck in "pending"

- Worker might be crashed - check logs
- Restart worker: `fly apps restart profitorbit-facebook-worker`

### Jobs Failing with Errors

- Check error_message in database
- Common issues:
  - Facebook blocking (needs different User-Agent or delays)
  - Timeout (increase timeout in worker)
  - Memory issues (increase memory: `fly scale memory 1024`)

### Scraping Returns Null Data

- Facebook's page structure changed
- Update selectors in `worker/index.js`
- Test scraping logic locally first

---

## Cost Optimization

### Auto-scaling

Worker is configured to auto-sleep when no jobs (saves money):
```toml
auto_stop_machines = true
auto_start_machines = true
min_machines_running = 0
```

### Batch Processing

Worker processes 2 jobs concurrently - increase if needed:
```javascript
const CONCURRENT_JOBS = 2; // Increase to 5-10 for faster processing
```

---

## Next Steps

1. ✅ Run database migration
2. ✅ Test worker locally
3. ✅ Deploy to Fly.io
4. ✅ Update extension code
5. ✅ Test end-to-end
6. 📊 Monitor performance

---

## Summary

You now have a Vendoo-style server-side scraping system that:
- ✅ Works invisibly (no tabs)
- ✅ Gets full descriptions
- ✅ Scales automatically
- ✅ Matches Vendoo's architecture
- ✅ Costs ~$5-10/month on Fly.io

The worker runs 24/7, automatically processing scraping jobs as they come in!
