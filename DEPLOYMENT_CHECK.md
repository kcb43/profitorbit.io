# Quick Deployment Check

## Step 1: Verify Vercel is Connected

1. Go to https://vercel.com/dashboard
2. Look for your project "ProfitPulse-2"
3. Check if there's a new deployment in progress or completed

## Step 2: Check Deployment Status

If you see a deployment:
- ✅ **Green checkmark** = Deployment successful
- ⏳ **Spinning icon** = Still deploying (wait 1-2 minutes)
- ❌ **Red X** = Deployment failed (check logs)

## Step 3: Test the Routes

After deployment completes, test these URLs in your browser:

1. **Auth route (should redirect or show debug info):**
   ```
   https://profit-pulse-2.vercel.app/api/facebook/auth?debug=true
   ```

2. **Callback route (will show error without OAuth code - that's normal):**
   ```
   https://profit-pulse-2.vercel.app/api/facebook/callback
   ```

## Step 4: Set Environment Variables

If routes return errors about missing App ID:

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add:
   - **Name:** `FACEBOOK_APP_ID`
   - **Value:** Your Facebook App ID
   - **Environment:** Production, Preview, Development (select all)
3. Add:
   - **Name:** `FACEBOOK_APP_SECRET`
   - **Value:** Your Facebook App Secret
   - **Environment:** Production, Preview, Development (select all)
4. Click "Save"
5. **Redeploy** (or wait for next push)

## Step 5: Test Connect Button

1. Go to your local app: http://localhost:5173/MarketplaceConnect
2. Click "Connect Facebook Account"
3. Should redirect to Facebook OAuth (not 404)

## Troubleshooting

### Still Getting 404?

1. **Check deployment logs:**
   - Vercel Dashboard → Your Project → Deployments → Click latest → View Function Logs
   - Look for errors in `/api/facebook/auth`

2. **Verify files are deployed:**
   - Check that `api/facebook/auth.js` exists in the deployment
   - Vercel Dashboard → Your Project → Functions tab

3. **Force redeploy:**
   - Vercel Dashboard → Your Project → Deployments → Click "..." → Redeploy

### Routes Not Detected?

Vercel auto-detects serverless functions in the `api/` folder. If not working:

1. Check `vercel.json` exists (it does)
2. Ensure files are `.js` (not `.ts`)
3. Ensure files export `export default async function handler(req, res)`

### Environment Variables Not Working?

- Make sure you're using `FACEBOOK_APP_ID` (not `VITE_FACEBOOK_APP_ID`)
- `VITE_` prefix is only for client-side variables
- Server-side API routes use non-`VITE_` variables

