# eBay API Setup Guide

## Current Configuration

You're currently using **eBay Sandbox** credentials. This is good for testing but has limited test data.

## Switching to Production

### Step 1: Create Production Credentials

1. Go to [eBay Developer Portal](https://developer.ebay.com/)
2. Navigate to **My Account** → **Keys & Tokens**
3. Create a **Production** keyset (not Sandbox)
4. Copy your **Production Client ID** and **Production Client Secret**
   - Production Client ID will NOT have "SBX" prefix
   - Example: `BertsonB-ProfitPu-PRD-xxxxx-xxxxx`

### Step 2: Update Vercel Environment Variables

In your Vercel dashboard:

1. Go to your project settings
2. Navigate to **Environment Variables**
3. Add/Update these variables:

```
EBAY_ENV=production
EBAY_CLIENT_ID=YourProductionClientID
EBAY_CLIENT_SECRET=YourProductionClientSecret
```

**Important:** Remove the `VITE_` prefix for serverless functions. Vercel API routes use `process.env` directly.

### Step 3: Redeploy

After updating environment variables, Vercel will automatically redeploy. The API will then use production eBay instead of sandbox.

## Environment Variables

### For Local Development (`.env.local`)
```
VITE_EBAY_CLIENT_ID=YourClientID
VITE_EBAY_CLIENT_SECRET=YourClientSecret
EBAY_ENV=sandbox  # or 'production'
```

### For Vercel Production
```
EBAY_CLIENT_ID=YourProductionClientID
EBAY_CLIENT_SECRET=YourProductionClientSecret
EBAY_ENV=production
```

**Note:** 
- Client-side code uses `VITE_EBAY_*` variables
- Server-side (API routes) use `EBAY_*` variables without `VITE_` prefix
- `EBAY_ENV` controls which eBay API (sandbox vs production) to use

## Debugging Search Issues

If you're still getting the "missing q parameter" error:

1. Check Vercel Function Logs to see what parameters are being received
2. The debugging code will log:
   - Received query parameters
   - Whether `q` parameter was found
   - Final search URL being sent to eBay

## Sandbox vs Production

- **Sandbox**: Limited test data, good for development
- **Production**: Real eBay listings, requires production credentials

