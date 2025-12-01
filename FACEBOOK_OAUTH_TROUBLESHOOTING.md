# Facebook OAuth Callback Error - Troubleshooting Guide

If you're getting an OAuth callback error when trying to connect Facebook, follow these steps:

## Step 1: Check the Error Message

The error message will tell you what's wrong. Common errors:

- **"Redirect URI mismatch"** - The redirect URI doesn't match Facebook App Settings
- **"Invalid App ID"** - App ID is incorrect or not set
- **"Access denied"** - User cancelled or didn't grant permissions

## Step 2: Get Your Redirect URI

1. Visit: `https://profit-pulse-2.vercel.app/api/facebook/debug` (or `/api/facebook/debug` locally)
2. Copy the `redirectUri` shown in the response
3. It should look like: `https://profit-pulse-2.vercel.app/api/facebook/callback`

## Step 3: Configure Facebook App Settings

1. Go to https://developers.facebook.com/apps
2. Select your app (App ID: `1855278678430851`)
3. Go to **Settings** → **Basic**
4. Scroll down to **"Valid OAuth Redirect URIs"**
5. Click **"Add Platform"** if needed, or click **"Add URI"**
6. Add the redirect URI EXACTLY as shown in the debug endpoint
   - Must match EXACTLY (including `https://`, domain, and `/api/facebook/callback`)
   - No trailing slashes
   - Case-sensitive

## Step 4: Common Issues

### Issue: Redirect URI Mismatch

**Symptoms:**
- Error: "redirect_uri_mismatch"
- Error: "Invalid redirect_uri"

**Solution:**
1. Get your redirect URI from `/api/facebook/debug`
2. Make sure it's added to Facebook App Settings
3. Make sure it matches EXACTLY (check for `http` vs `https`, trailing slashes, etc.)

### Issue: App ID Not Set

**Symptoms:**
- Error: "Invalid App ID"
- Error: "Facebook App ID not configured"

**Solution:**
1. Set `FACEBOOK_APP_ID` in Vercel environment variables
2. Value should be: `1855278678430851`
3. Redeploy after setting

### Issue: App Secret Not Set

**Symptoms:**
- Error: "Facebook credentials not configured"
- Token exchange fails

**Solution:**
1. Set `FACEBOOK_APP_SECRET` in Vercel environment variables
2. Get it from Facebook App Settings → Basic → App Secret
3. Redeploy after setting

### Issue: App in Wrong Mode

**Symptoms:**
- Error: "App not in development mode"
- Can't add test users

**Solution:**
1. Make sure your app is in **Development** mode
2. Add yourself as a test user in App Settings → Roles → Test Users
3. Or submit your app for App Review

### Issue: Missing Permissions

**Symptoms:**
- Error: "Insufficient permissions"
- Can't access Marketplace

**Solution:**
1. Make sure you're requesting the right scopes:
   - `pages_manage_metadata`
   - `pages_manage_posts`
   - `business_management`
   - `pages_read_engagement`
2. Submit for App Review if needed

## Step 5: Test Again

After fixing the configuration:

1. Clear your browser cache
2. Try connecting again
3. Check the browser console for any errors
4. Check Vercel function logs for server-side errors

## Debug Endpoints

- **Debug Info:** `/api/facebook/debug` - Shows your current configuration
- **Test Auth:** `/api/facebook/auth?debug=true` - Shows auth URL without redirecting

## Still Having Issues?

1. Check Vercel deployment logs:
   - Go to Vercel Dashboard → Your Project → Functions
   - Look for errors in `/api/facebook/callback`

2. Check browser console:
   - Open DevTools → Console
   - Look for JavaScript errors

3. Verify environment variables:
   - Vercel Dashboard → Settings → Environment Variables
   - Make sure `FACEBOOK_APP_ID` and `FACEBOOK_APP_SECRET` are set

4. Test the redirect URI:
   - Visit `/api/facebook/debug`
   - Copy the redirect URI
   - Make sure it's in Facebook App Settings

## Quick Checklist

- [ ] App ID is set: `1855278678430851`
- [ ] App Secret is set in Vercel
- [ ] Redirect URI is in Facebook App Settings
- [ ] Redirect URI matches EXACTLY (check `/api/facebook/debug`)
- [ ] App is in Development mode (or submitted for review)
- [ ] Test user added (if in Development mode)
- [ ] Redeployed after changing environment variables

