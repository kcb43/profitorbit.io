# 🚨 REDIS CONNECTION FIX

## Current Issue
Your Orben workers are showing these errors:
```
[ioredis] Unhandled error event: Error: read ECONNRESET
MaxRetriesPerRequestError: Reached the max retries per request limit
```

This means the `REDIS_URL` environment variable is either:
1. ❌ Incorrectly formatted
2. ❌ Not set
3. ❌ Pointing to a Redis instance that doesn't exist

---

## ✅ How to Fix

### Step 1: Get Your Upstash Redis URL

1. Go to: https://console.upstash.com/redis
2. If you don't have a database:
   - Click **"Create Database"**
   - Name: `orben-redis`
   - Region: Pick closest to your Fly.io region (e.g., `us-east-1` for `iad`)
   - Type: Regional (free tier)
   - Click **"Create"**

3. Click on your database name
4. Find the **"REDIS_URL"** section (NOT "REST URL")
5. Copy the connection string

**CRITICAL**: It must look like this:
```
rediss://default:AbCd1234EfGh5678@fly-example-12345.upstash.io:6379
```

Note the **double 's'** in `rediss://` - this is required for TLS!

---

### Step 2: Update Fly.io Secrets

Open PowerShell in `f:\bareretail` and run:

```powershell
# Set the Redis URL for all three services
$REDIS_URL = "rediss://default:YOUR_PASSWORD@YOUR_HOST.upstash.io:6379"

fly secrets set REDIS_URL="$REDIS_URL" -a orben-deal-worker
fly secrets set REDIS_URL="$REDIS_URL" -a orben-search-worker
fly secrets set REDIS_URL="$REDIS_URL" -a orben-api
```

**The apps will automatically restart when secrets are updated!**

---

### Step 3: Verify the Fix

Wait 30 seconds, then check logs:

```powershell
# Check deal worker logs
fly logs -a orben-deal-worker | Select-Object -Last 50

# You should see:
# ✅ Redis connected successfully
# ✅ Redis ready for commands
# ✅ Supabase connection verified
# 🚀 Orben Deal Worker starting...
```

---

### Step 4: Test Locally (Optional)

Create a `.env` file in the root with your actual values:

```bash
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
REDIS_URL=rediss://default:password@host.upstash.io:6379
```

Then run the test script:

```powershell
node test-deployment.js
```

You should see:
```
✅ Redis: Connected and responding to PING
✅ Supabase: Connected
✅ Active deals in database: 0 (or more)
```

---

## 🔍 Common Mistakes

### ❌ Wrong: Using `redis://` (single 's')
```
redis://default:password@host:6379  ❌ Will fail with ECONNRESET
```

### ✅ Correct: Using `rediss://` (double 's')
```
rediss://default:password@host.upstash.io:6379  ✅ Works!
```

### ❌ Wrong: Using REST URL instead of REDIS_URL
Upstash shows multiple connection strings. Don't use the REST API URL!

### ✅ Correct: Using the TLS connection string
Look for the section specifically labeled "REDIS_URL" in your Upstash console.

---

## 📊 After Fix: What to Expect

**Within 2 minutes:**
- ✅ No more `ECONNRESET` errors in logs
- ✅ Workers start successfully
- ✅ Health check endpoints respond: `fly logs -a orben-deal-worker`

**Within 30-60 minutes:**
- ✅ Deal worker polls first RSS feed
- ✅ Deals appear in database
- ✅ You can query: `SELECT COUNT(*) FROM deals WHERE status = 'active';`

---

## 🆘 Still Not Working?

If you still see Redis errors after fixing the URL:

1. **Check Upstash dashboard** - Is the database running? Any error messages?
2. **Check network restrictions** - Upstash free tier should allow all connections
3. **Try a different region** - Create a new Upstash database in a different region
4. **Contact me** - Share the output of: `fly logs -a orben-deal-worker | Select-Object -Last 100`

---

## Next: Complete Step 5 Testing

Once Redis is working, continue with:

```powershell
# Test API health
curl https://orben-api.fly.dev/v1/health

# Test search worker
curl -X POST https://orben-search-worker.fly.dev/search `
  -H "Content-Type: application/json" `
  -d '{"query":"iPhone","providers":["ebay"],"userId":"test","limit":5}'

# Check for deals (may be empty for first 30 mins)
curl https://orben-api.fly.dev/v1/deals/feed?limit=5
```

---

**Once you fix the Redis URL, everything should work! 🚀**
