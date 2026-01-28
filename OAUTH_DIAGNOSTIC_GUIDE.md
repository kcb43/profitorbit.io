# OAuth redirect_uri_mismatch - Complete Diagnostic Guide

## What I've Done

I've added diagnostic logging and created a diagnostic tool to help you identify exactly what redirect URI is being sent to Google.

### Changes Made:

1. **Enhanced Logging in Landing.jsx** - Added console logs to show:
   - Supabase URL
   - Public site origin
   - The actual redirect URI being sent to Google

2. **Enhanced Logging in Login.jsx** - Same diagnostic logs for the login page

3. **Created OAuth Diagnostic Page** - A dedicated tool at `/oauth-diagnostic` that shows:
   - All environment configuration
   - The exact redirect URI being sent
   - Step-by-step instructions to fix the issue

## How to Use the Diagnostic Tool

### Step 1: Deploy and Test

1. Commit and push these changes to your repo
2. Wait for Vercel to deploy
3. Go to: **https://profitorbit.io/oauth-diagnostic**
4. Click "Run Diagnostic"
5. Look at the **"Redirect URI being sent to Google"** section

### Step 2: Check Google Cloud Console

The diagnostic will show you the exact redirect URI. For example:
```
https://hlcwhpajorzbleabavcr.supabase.co/auth/v1/callback
```

Now verify it's in Google Cloud Console:

1. Go to: https://console.cloud.google.com/apis/credentials
2. Find your OAuth 2.0 Client ID
3. Click on it to edit
4. Under **"Authorized redirect URIs"**, verify this EXACT URL is listed

## Common Issues and Solutions

### Issue 1: Wrong Supabase Project ID

**Symptom**: The redirect URI shows a different project ID than `hlcwhpajorzbleabavcr`

**Solution**: 
- You have multiple Supabase projects
- Check your Vercel environment variables:
  - Go to Vercel Dashboard → Your Project → Settings → Environment Variables
  - Verify `VITE_SUPABASE_URL` = `https://hlcwhpajorzbleabavcr.supabase.co`
  - If it's different, update it and redeploy

### Issue 2: Multiple OAuth Client IDs

**Symptom**: You have multiple OAuth 2.0 Client IDs in Google Cloud Console

**Solution**:
- Find the one with the correct redirect URI
- Copy its Client ID and Client Secret
- Update in Supabase → Authentication → Providers → Google

### Issue 3: Vercel Environment Variables Not Set

**Symptom**: Diagnostic shows `VITE_SUPABASE_URL: undefined` or empty

**Solution**:
1. Go to Vercel Dashboard
2. Navigate to: Your Project → Settings → Environment Variables
3. Add these variables for **all environments** (Production, Preview, Development):
   ```
   VITE_SUPABASE_URL=https://hlcwhpajorzbleabavcr.supabase.co
   VITE_SUPABASE_ANON_KEY=<your_anon_key>
   ```
4. Redeploy your app

### Issue 4: Cached Configuration

**Symptom**: Everything looks correct but still getting the error

**Solution**:
1. Clear browser cache and cookies
2. Try in incognito/private mode
3. Wait 5-10 minutes for Google's OAuth changes to propagate

## Quick Checklist

Use this checklist to verify everything:

- [ ] Supabase URL is correct in Vercel environment variables
- [ ] Google OAuth credentials are added to Supabase
- [ ] Redirect URI in Google Cloud Console matches exactly (no trailing slash)
- [ ] Google provider is enabled in Supabase
- [ ] Tried in incognito mode (to rule out browser cache)

## Testing Locally vs Production

### Test Locally First:

```bash
npm run dev
```

Then go to `http://localhost:5174/oauth-diagnostic` and run the diagnostic.

**If local works but production doesn't**: It's a Vercel environment variable issue.

**If neither works**: It's a Supabase/Google configuration issue.

## Console Output

When you click "Sign In" on the landing page, you'll now see detailed logs like:

```
🔐 Starting OAuth...
🌍 Public Site Origin: https://profitorbit.io
📍 Supabase URL: https://hlcwhpajorzbleabavcr.supabase.co
🔑 Anon Key (first 20 chars): eyJhbGciOiJIUzI1NiIs...
📦 OAuth Response: {url: "...", provider: "google"}
🔗 Full OAuth URL: https://hlcwhpajorzbleabavcr.supabase.co/auth/v1/authorize?...
🎯 Redirect URI being sent to Google: https://hlcwhpajorzbleabavcr.supabase.co/auth/v1/callback

⚠️ IMPORTANT: Copy the redirect URI above and verify it matches EXACTLY in:
   Google Cloud Console → Credentials → OAuth 2.0 Client → Authorized redirect URIs
```

## Next Steps

1. **Deploy the changes**:
   ```bash
   git add .
   git commit -m "Add OAuth diagnostic tools"
   git push
   ```

2. **Wait for Vercel deployment**

3. **Go to**: https://profitorbit.io/oauth-diagnostic

4. **Run the diagnostic** and follow the instructions

5. **Report back** with:
   - The redirect URI shown in the diagnostic
   - What you see in Google Cloud Console
   - Any error messages

## Still Having Issues?

If you're still stuck after running the diagnostic:

1. Take a screenshot of the diagnostic results
2. Take a screenshot of your Google Cloud Console OAuth Client
3. Share them so I can see the exact mismatch

The diagnostic tool will pinpoint exactly where the mismatch is occurring.
