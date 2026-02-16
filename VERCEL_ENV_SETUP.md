# Vercel Environment Variables Setup

## URGENT: Add These to Vercel Dashboard

The Smart Listing feature requires environment variables to be enabled in production.

### Step 1: Go to Vercel Dashboard

1. Go to https://vercel.com/dashboard
2. Select your `profitorbit.io` project
3. Go to **Settings** → **Environment Variables**

### Step 2: Add These Variables

Add these 3 environment variables:

| Name | Value | Environment |
|------|-------|-------------|
| `VITE_SMART_LISTING_ENABLED` | `true` | Production, Preview, Development |
| `VITE_AI_SUGGESTIONS_ENABLED` | `true` | Production, Preview, Development |
| `VITE_DEBUG_SMART_LISTING` | `false` | Production (or `true` if you want debug logs) |

**Also add (if not already there):**

| Name | Value | Environment |
|------|-------|-------------|
| `OPENAI_API_KEY` | `your-openai-key-here` | Production, Preview, Development |

### Step 3: Redeploy

After adding the variables:
1. Vercel will show a notice: "Changes will take effect on the next deployment"
2. Either:
   - **Wait** for the current deployment to finish (already triggered by the git push)
   - **Or manually redeploy** from the Deployments tab

### Step 4: Verify

After deployment completes (usually 2-3 minutes):

1. Go to `https://profitorbit.io/CrosslistComposer`
2. Open browser console (F12)
3. Look for these logs:
   ```
   🎯 Smart Listing Feature Flag: true
   🎯 Environment: { VITE_SMART_LISTING_ENABLED: 'true', ... }
   ```
4. Look for the new UI section with marketplace checkboxes

## If You Don't Add Environment Variables

Without the environment variables in Vercel:
- The feature will be **disabled** (safe default)
- No UI changes will appear
- Everything will work exactly as before

## Current Deployment Status

- ✅ Code pushed to GitHub: `c294e2e`
- ⏳ Vercel deployment: In progress
- ❌ Environment variables: **NOT SET YET** (you need to add them)

## Quick Link

Go here to add variables:
https://vercel.com/[your-username]/profitorbit-io/settings/environment-variables

(Replace `[your-username]` with your actual Vercel username)
