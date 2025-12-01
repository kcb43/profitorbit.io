# Environment Variables Guide

## Quick Overview

Your app uses environment variables for:
- **Server-side API routes** (Vercel functions in `api/` folder)
- **Client-side React components** (optional)

## Important: VITE_ Prefix Rule

- **`VITE_` prefix** = Client-side variables (exposed to browser)
- **No `VITE_` prefix** = Server-side variables (only in API routes)

**For Facebook API routes, use variables WITHOUT `VITE_` prefix.**

---

## Step 1: Get Your Facebook App Credentials

1. Go to https://developers.facebook.com/apps/
2. Select your app (or create a new one)
3. Go to **Settings** → **Basic**
4. Copy:
   - **App ID**
   - **App Secret** (click "Show" to reveal)

---

## Step 2: Set Variables in Vercel (Production)

### Via Vercel Dashboard:

1. Go to https://vercel.com/dashboard
2. Select your project: **ProfitPulse-2**
3. Go to **Settings** → **Environment Variables**
4. Click **Add New**

5. Add **FACEBOOK_APP_ID**:
   - **Name:** `FACEBOOK_APP_ID`
   - **Value:** Your Facebook App ID (e.g., `1234567890123456`)
   - **Environment:** Select all (Production, Preview, Development)
   - Click **Save**

6. Add **FACEBOOK_APP_SECRET**:
   - **Name:** `FACEBOOK_APP_SECRET`
   - **Value:** Your Facebook App Secret (e.g., `abc123def456...`)
   - **Environment:** Select all (Production, Preview, Development)
   - Click **Save**

7. **Redeploy** your project:
   - Go to **Deployments** tab
   - Click **"..."** on latest deployment
   - Click **Redeploy**

### Via Vercel CLI (Alternative):

```bash
# Install Vercel CLI if not installed
npm i -g vercel

# Login
vercel login

# Link to your project
vercel link

# Set environment variables
vercel env add FACEBOOK_APP_ID
vercel env add FACEBOOK_APP_SECRET

# Deploy
vercel --prod
```

---

## Step 3: Set Variables Locally (Development)

### Option 1: Create `.env.local` file (Recommended)

1. Create a file named `.env.local` in your project root (same folder as `package.json`)

2. Add your variables:
   ```env
   FACEBOOK_APP_ID=your_facebook_app_id_here
   FACEBOOK_APP_SECRET=your_facebook_app_secret_here
   ```

3. **Important:** `.env.local` is already in `.gitignore` (won't be committed)

4. Restart your dev server:
   ```bash
   # Stop the current server (Ctrl+C)
   npm run dev
   ```

### Option 2: Use PowerShell (Windows)

```powershell
# Set for current session
$env:FACEBOOK_APP_ID="your_app_id"
$env:FACEBOOK_APP_SECRET="your_app_secret"

# Then start dev server
npm run dev
```

### Option 3: Use Command Prompt (Windows)

```cmd
set FACEBOOK_APP_ID=your_app_id
set FACEBOOK_APP_SECRET=your_app_secret
npm run dev
```

---

## Step 4: Verify Variables Are Working

### Test Locally:

1. Start your dev server: `npm run dev`
2. Check the API route: http://localhost:5173/api/facebook/auth?debug=true
3. Should see JSON with debug info (not an error about missing App ID)

### Test on Vercel:

1. After deploying, visit: `https://profit-pulse-2.vercel.app/api/facebook/auth?debug=true`
2. Should see JSON response (not 404 or missing App ID error)

---

## Variable Reference

### Required Variables:

| Variable Name | Where Used | Example Value |
|--------------|------------|---------------|
| `FACEBOOK_APP_ID` | Server-side API routes | `1234567890123456` |
| `FACEBOOK_APP_SECRET` | Server-side API routes | `abc123def456ghi789...` |

### Optional Variables:

| Variable Name | Purpose | Default |
|--------------|---------|---------|
| `BASE_URL` | Override auto-detected URL | Auto-detected from Vercel |
| `VERCEL_URL` | Vercel-provided (automatic) | Set by Vercel |

---

## Troubleshooting

### "Facebook App ID not configured" Error

**Problem:** API route returns error about missing App ID

**Solutions:**
1. ✅ Check variable name is exactly `FACEBOOK_APP_ID` (not `VITE_FACEBOOK_APP_ID`)
2. ✅ Verify variable is set in Vercel (Settings → Environment Variables)
3. ✅ Redeploy after adding variables
4. ✅ For local dev, check `.env.local` exists and has correct values
5. ✅ Restart dev server after creating `.env.local`

### Variables Not Working Locally

**Problem:** Local dev server doesn't see variables

**Solutions:**
1. ✅ File must be named `.env.local` (not `.env`)
2. ✅ File must be in project root (same folder as `package.json`)
3. ✅ Restart dev server after creating file
4. ✅ Check for typos in variable names

### Variables Not Working on Vercel

**Problem:** Production API routes don't see variables

**Solutions:**
1. ✅ Verify variables are set in Vercel Dashboard
2. ✅ Check "Environment" is set to "Production, Preview, Development"
3. ✅ Redeploy after adding variables
4. ✅ Check deployment logs for errors

### Client-Side vs Server-Side Confusion

**Remember:**
- **API routes** (`api/facebook/*.js`) use: `FACEBOOK_APP_ID` (no VITE_)
- **React components** (if needed) use: `VITE_FACEBOOK_APP_ID` (with VITE_)

For Facebook integration, you only need server-side variables (no VITE_ prefix).

---

## Security Notes

⚠️ **Never commit `.env.local` to git** (already in `.gitignore`)

⚠️ **Never expose App Secret in client-side code**

✅ **App Secret is only used in server-side API routes**

✅ **Vercel environment variables are encrypted at rest**

---

## Quick Checklist

- [ ] Got Facebook App ID and Secret from developers.facebook.com
- [ ] Set `FACEBOOK_APP_ID` in Vercel Dashboard
- [ ] Set `FACEBOOK_APP_SECRET` in Vercel Dashboard
- [ ] Redeployed on Vercel
- [ ] Created `.env.local` for local development
- [ ] Added variables to `.env.local`
- [ ] Restarted dev server
- [ ] Tested API route (should work now!)

---

## Need Help?

If you're still having issues:

1. Check Vercel deployment logs for errors
2. Test the API route with `?debug=true` to see what's missing
3. Verify variable names match exactly (case-sensitive)
4. Make sure you redeployed after adding variables

