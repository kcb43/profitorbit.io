# Worker Deployment Steps

## Step 3 — Redeploy the Worker from Correct Directory

**Important:** You **must** deploy from inside `render-worker/` directory.

```bash
cd render-worker
fly deploy -a profitpulse-listing-worker
```

✅ If Fly still complains about smoke checks, it's because the old machine is still crash-looping and blocking updates.

## Step 4 — If Fly Blocks Deploy: Destroy Broken Machines

If deployment is blocked by crash-looping machines:

### List machines:
```bash
fly machines list -a profitpulse-listing-worker
```

### Destroy stopped/crashing machines:
```bash
fly machines destroy <MACHINE_ID> -a profitpulse-listing-worker
```

(Repeat for any other stuck machines if needed.)

### Then deploy again:
```bash
cd render-worker
fly deploy -a profitpulse-listing-worker
```

## Step 5 — Watch Worker Logs

This is the pass/fail moment:

```bash
fly logs -a profitpulse-listing-worker
```

### ✅ Success looks like:
```
🚀 Starting Listing Automation Worker...
⏱️  Poll interval: 2000ms
🔢 Max concurrent jobs: 1
👻 Headless mode: true
```

Then either:
- "No jobs available" (polling successfully)
- Or it claims a job and starts processing

### ❌ Failure indicators:
- "Cannot find module '/app/utils/db.js'" → Import path still wrong
- "Error claiming job" → Supabase connection issue
- Crash loops → Check logs for specific error

### ❌ If it starts but errors about Supabase function:
You'll see errors like:
- "function claim_listing_job() does not exist"
- "permission denied for function claim_listing_job"

This is the "status ambiguous" issue - the RPC function needs to be created in Supabase.

## Troubleshooting

### Check if worker is running:
```bash
fly status -a profitpulse-listing-worker
```

### View recent logs:
```bash
fly logs -a profitpulse-listing-worker --limit 100
```

### SSH into machine (for debugging):
```bash
fly ssh console -a profitpulse-listing-worker
```

### Check environment variables:
```bash
fly secrets list -a profitpulse-listing-worker
```

