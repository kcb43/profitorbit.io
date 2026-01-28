# Diagnose OAuth Redirect URI Mismatch

## Step 1: Check What Redirect URI Google is Expecting

1. Go to your error page: https://profitorbit.io/ and click "Sign In"
2. You'll see the error: `Error 400: redirect_uri_mismatch`
3. Click **"error details"** or **"Learn more about this error"**
4. Google will show you **two redirect URIs**:
   - **The one you configured** (in Google Cloud Console)
   - **The one that was sent** (from Supabase)

## Step 2: Compare the URLs

The two URLs should match EXACTLY. Common mismatches:

### Mismatch Type 1: Wrong Supabase Project
**Configured**: `https://hlcwhpajorzbleabavcr.supabase.co/auth/v1/callback`
**Sent**: `https://DIFFERENT_PROJECT_ID.supabase.co/auth/v1/callback`

**Fix**: You have multiple Supabase projects and configured OAuth in the wrong one.

### Mismatch Type 2: Missing from Google Cloud Console
**Configured**: `http://localhost:5174/auth/callback` (only localhost)
**Sent**: `https://hlcwhpajorzbleabavcr.supabase.co/auth/v1/callback`

**Fix**: Add the Supabase URL to authorized redirect URIs in Google Cloud Console.

### Mismatch Type 3: Trailing Slash
**Configured**: `https://hlcwhpajorzbleabavcr.supabase.co/auth/v1/callback/` (trailing slash)
**Sent**: `https://hlcwhpajorzbleabavcr.supabase.co/auth/v1/callback` (no trailing slash)

**Fix**: Remove the trailing slash from Google Cloud Console.

### Mismatch Type 4: HTTP vs HTTPS
**Configured**: `http://hlcwhpajorzbleabavcr.supabase.co/auth/v1/callback`
**Sent**: `https://hlcwhpajorzbleabavcr.supabase.co/auth/v1/callback`

**Fix**: Change to HTTPS in Google Cloud Console.

## Step 3: Get the Exact URLs

### From Google Cloud Console:

1. Go to: https://console.cloud.google.com/apis/credentials
2. Find your OAuth 2.0 Client ID (look for the one you're using for profitorbit.io)
3. Click on it
4. Copy EXACTLY what's in **"Authorized redirect URIs"**

### From Supabase Dashboard:

1. Go to: https://supabase.com/dashboard/project/hlcwhpajorzbleabavcr/auth/providers
2. Click on **Google** provider
3. Look at the **"Callback URL (for OAuth)"** field
4. It should show: `https://hlcwhpajorzbleabavcr.supabase.co/auth/v1/callback`

### From Your Production App:

Add this temporary diagnostic code to see what's actually being sent:

**File: `src/pages/Landing.jsx`** (line 117-127)

Replace the `handleSignIn` function temporarily:

```javascript
const handleSignIn = async () => {
  console.log('🔐 Starting OAuth...');
  console.log('🌍 Public Site Origin:', getPublicSiteOrigin());
  console.log('📍 Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
  
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${getPublicSiteOrigin()}/dashboard`,
    },
  });
  
  console.log('📦 OAuth Response:', data);
  console.log('❌ OAuth Error:', error);
  
  if (data?.url) {
    console.log('🔗 OAuth URL:', data.url);
    // Extract the redirect_uri from the OAuth URL
    const url = new URL(data.url);
    const redirectUri = url.searchParams.get('redirect_uri');
    console.log('🎯 Redirect URI being sent to Google:', redirectUri);
  }
  
  if (error) {
    console.error('Sign in error:', error);
  }
};
```

## Step 4: Test and Check Console

1. Deploy this change to Vercel
2. Go to https://profitorbit.io/
3. Open browser console (F12)
4. Click "Sign In"
5. **BEFORE** you see the error, check the console for:
   ```
   🎯 Redirect URI being sent to Google: <THE_ACTUAL_URL>
   ```

## Step 5: Verify Vercel Environment Variables

Your Vercel deployment might have different environment variables than your local setup.

1. Go to: https://vercel.com/your-team/your-project/settings/environment-variables
2. Check that you have:
   - `VITE_SUPABASE_URL` = `https://hlcwhpajorzbleabavcr.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `<your_anon_key>`
3. Make sure these are set for **Production**, **Preview**, and **Development** environments

## Step 6: Common Solutions

### Solution 1: Multiple OAuth Client IDs

You might have created multiple OAuth clients in Google Cloud Console. Make sure you're using the correct one:

1. Go to: https://console.cloud.google.com/apis/credentials
2. Check if you have multiple "OAuth 2.0 Client IDs"
3. Find the one that has `https://hlcwhpajorzbleabavcr.supabase.co/auth/v1/callback` in the redirect URIs
4. Copy that **Client ID** and **Client Secret**
5. Update Supabase → Authentication → Providers → Google with the correct credentials

### Solution 2: Clear Everything and Start Fresh

Sometimes Google or Supabase caches OAuth configuration:

1. **In Google Cloud Console**:
   - Delete the existing OAuth client
   - Wait 2 minutes
   - Create a new OAuth client with the correct redirect URI

2. **In Supabase Dashboard**:
   - Disable Google provider
   - Wait 1 minute
   - Re-enable and add the new Client ID/Secret

3. **In Your Browser**:
   - Clear all cookies for profitorbit.io
   - Clear all cookies for accounts.google.com
   - Clear browser cache
   - Try again in incognito mode

### Solution 3: Check for Typos

The redirect URI must be EXACTLY:
```
https://hlcwhpajorzbleabavcr.supabase.co/auth/v1/callback
```

Common typos:
- ❌ `https://hlcwhpajorzbleabavcr.supabase.co/auth/v1/callback/` (trailing slash)
- ❌ `https://hlcwhpajorzbleabavcr.supabase.co/auth/callback` (missing v1)
- ❌ `https://hlcwhpajorzbleabavcr.supabase.co/callback` (missing auth/v1)
- ❌ `http://...` (http instead of https)

## Step 7: Screenshot and Share

If none of these work, take screenshots of:

1. The Google error page showing both redirect URIs
2. Google Cloud Console → OAuth Client → Authorized redirect URIs
3. Supabase Dashboard → Authentication → Providers → Google → Callback URL
4. Browser console with the diagnostic logs from Step 4

This will help identify the exact mismatch.

## Quick Test: Does Local Work?

Test if OAuth works locally:

1. Run locally: `npm run dev`
2. Go to: http://localhost:5174/
3. Click "Sign In"
4. Does it work locally?

**If YES**: The issue is with your Vercel environment variables
**If NO**: The issue is with your Supabase/Google configuration

