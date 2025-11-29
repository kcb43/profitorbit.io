# Deployment Instructions for Facebook API Routes

## Problem

When clicking "Connect Facebook" locally, you get a 404 error because:
- The Vite dev server proxies `/api` requests to production Vercel URL
- The Facebook API routes (`/api/facebook/auth`, etc.) aren't deployed to Vercel yet
- Production returns 404 because routes don't exist

## Solution: Deploy to Vercel

### Option 1: Deploy via Git (Recommended)

1. **Commit your changes:**
   ```bash
   git add .
   git commit -m "Add Facebook Marketplace integration and crosslisting system"
   git push
   ```

2. **Vercel will automatically deploy:**
   - If you have Vercel connected to your GitHub repo, it will auto-deploy
   - Wait 1-2 minutes for deployment to complete

3. **Verify deployment:**
   - Go to Vercel Dashboard → Your Project → Deployments
   - Check that latest deployment succeeded
   - Visit: `https://profit-pulse-2.vercel.app/api/facebook/auth?debug=true`
   - Should see JSON response (not 404)

### Option 2: Deploy via Vercel CLI

1. **Install Vercel CLI** (if not installed):
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel:**
   ```bash
   vercel login
   ```

3. **Deploy:**
   ```bash
   vercel --prod
   ```

4. **Follow prompts:**
   - Link to existing project or create new
   - Confirm deployment settings

### Option 3: Test on Production URL Directly

While waiting for deployment, you can test directly on production:

1. Go to: `https://profit-pulse-2.vercel.app/MarketplaceConnect`
2. Click "Connect Facebook Account"
3. This will use the production API routes (if deployed)

## Verify Routes Are Deployed

After deployment, test these URLs:

- `https://profit-pulse-2.vercel.app/api/facebook/auth?debug=true`
- `https://profit-pulse-2.vercel.app/api/facebook/callback`
- `https://profit-pulse-2.vercel.app/api/facebook/refresh-token`

You should see:
- **auth**: Redirects to Facebook or shows debug info
- **callback**: Returns error (expected - needs OAuth code)
- **refresh-token**: Returns error (expected - needs token)

## Environment Variables

Make sure these are set in Vercel:

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add:
   ```
   FACEBOOK_APP_ID=your_app_id
   FACEBOOK_APP_SECRET=your_app_secret
   ```
3. **Important**: Don't use `VITE_` prefix in Vercel (that's for client-side only)
4. Redeploy after adding variables

## After Deployment

Once deployed:

1. **Test locally:**
   - Your local dev server will proxy to production
   - Click "Connect Facebook" - should work now

2. **Test on production:**
   - Go to `https://profit-pulse-2.vercel.app/MarketplaceConnect`
   - Connect Facebook account
   - Verify OAuth flow works

## Troubleshooting

### Still Getting 404 After Deployment?

1. **Check Vercel deployment logs:**
   - Go to Vercel Dashboard → Your Project → Functions
   - Look for `/api/facebook/auth`
   - Check for errors

2. **Verify file structure:**
   - Routes should be in `api/facebook/auth.js`
   - Not in `src/api/facebook/` (that's for client-side)

3. **Check Vercel build logs:**
   - Look for any build errors
   - Ensure routes are being detected

### Routes Not Detected by Vercel?

Vercel automatically detects serverless functions in the `api/` folder. If not working:

1. **Check `vercel.json`:**
   - Should have rewrites configured (already done)

2. **File naming:**
   - Must be `.js` files (not `.ts` or `.jsx`)
   - Must export `default async function handler(req, res)`

3. **Redeploy:**
   - Sometimes Vercel needs a fresh deployment to detect new routes

## Quick Test

After deployment, you can quickly test if routes work:

```bash
# Test auth route (should redirect or show debug info)
curl https://profit-pulse-2.vercel.app/api/facebook/auth?debug=true
```

If you see JSON with debug info or a redirect, routes are working!

