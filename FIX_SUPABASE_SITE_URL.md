# Fix Supabase "Sign in to continue to hlcwhpajorzbleabavcr.supabase.co" Message

## Problem

When users sign in with Google from the cover page, they see:
> "Sign in to continue to hlcwhpajorzbleabavcr.supabase.co"

This is showing the Supabase project URL instead of your custom domain (`profitorbit.io`).

## Solution: Update Supabase Site URL

The message comes from Supabase's **Site URL** setting. You need to update it in the Supabase Dashboard.

### Step 1: Go to Supabase Dashboard

1. Go to: https://supabase.com/dashboard/project/hlcwhpajorzbleabavcr
2. Navigate to: **Settings** → **Authentication** → **URL Configuration**

### Step 2: Update Site URL

In the **URL Configuration** section, update:

**Site URL:**
```
https://profitorbit.io
```

**Redirect URLs:**
Add your custom domain redirect URLs:
```
https://profitorbit.io/**
https://www.profitorbit.io/**
```

(Keep the existing Supabase redirect URL: `https://hlcwhpajorzbleabavcr.supabase.co/auth/v1/callback`)

### Step 3: Save Changes

Click **Save** at the bottom of the page.

### Step 4: Verify Google OAuth Redirect URI

Make sure your Google Cloud Console OAuth credentials include BOTH:

1. **Supabase callback** (required for OAuth to work):
   ```
   https://hlcwhpajorzbleabavcr.supabase.co/auth/v1/callback
   ```

2. **Your custom domain** (optional, for better UX):
   ```
   https://profitorbit.io/auth/callback
   ```

**Note:** The Supabase callback URL (`hlcwhpajorzbleabavcr.supabase.co/auth/v1/callback`) is REQUIRED and must stay in Google Cloud Console. This is where Google redirects after authentication, and Supabase handles the rest.

### Step 5: Test

1. Clear your browser cache
2. Go to: `https://profitorbit.io` (or your landing page)
3. Click "Sign in with Google"
4. You should now see: **"Sign in to continue to profitorbit.io"** instead of the Supabase URL

## Why This Happens

Supabase uses the **Site URL** setting to:
- Display the domain in OAuth redirect pages
- Validate redirect URLs
- Set cookies with the correct domain

When you set it to your custom domain (`profitorbit.io`), Google's OAuth page will show your domain instead of the Supabase project URL.

## Important Notes

- ✅ The Supabase callback URL (`hlcwhpajorzbleabavcr.supabase.co/auth/v1/callback`) must remain in Google Cloud Console - this is where Google redirects after authentication
- ✅ Your code already uses `getPublicSiteOrigin()` to set the `redirectTo` parameter, which is correct
- ✅ The Site URL in Supabase is just for display/validation purposes - it doesn't change where the OAuth callback goes
- ✅ After updating, it may take a few minutes for changes to propagate

## Why You Still See the Supabase URL

**Important:** Even after updating the Site URL, Google's OAuth consent screen will still show `hlcwhpajorzbleabavcr.supabase.co` because:

- Google's OAuth consent screen **always displays the redirect URI domain**
- Supabase's OAuth callback is at `https://hlcwhpajorzbleabavcr.supabase.co/auth/v1/callback`
- This is the actual URL Google redirects to, so Google shows it in the consent screen

The Supabase Site URL setting doesn't change what Google displays - it only affects Supabase's internal redirect handling.

## Solutions

### Option 1: Customize Google OAuth Consent Screen (Free)

While you can't change the domain Google shows, you can improve the user experience:

1. **Go to Google Cloud Console**: https://console.cloud.google.com/apis/credentials/consent
2. **Edit your OAuth consent screen**:
   - **App name**: Change to "ProfitPulse" or "Orben" (your app name)
   - **App logo**: Upload your app logo
   - **Support email**: Your support email
   - **Authorized domains**: Add `profitorbit.io`
   - **Developer contact**: Your email

This won't change the domain shown, but it will make the consent screen look more professional and branded to your app.

### Option 2: Use Supabase Custom Domain (Paid Feature)

Supabase offers custom domains for auth endpoints (this is a paid feature):

1. **Go to Supabase Dashboard**: https://supabase.com/dashboard/project/hlcwhpajorzbleabavcr/settings/auth
2. **Look for "Custom Domain"** option (if available on your plan)
3. **Set up**: `auth.profitorbit.io` or similar
4. **Update Google Cloud Console** redirect URI to use the custom domain
5. **Update Supabase redirect URLs** to use the custom domain

This would make Google show `auth.profitorbit.io` instead of `hlcwhpajorzbleabavcr.supabase.co`.

**Note:** This requires a Supabase plan that supports custom domains (typically Pro plan or higher).

### Option 3: Accept the Current Behavior

Many apps using Supabase show the Supabase domain in Google's consent screen. Users understand this is part of the authentication flow. As long as:
- ✅ Your app name is clear in the consent screen
- ✅ Your branding is professional
- ✅ The flow works correctly

Most users won't be concerned about seeing the Supabase domain.

## Recommendation

**Start with Option 1** (customize the Google OAuth consent screen) - it's free and improves the user experience. If you need to completely hide the Supabase domain, consider Option 2 (custom domain) if it fits your budget.
