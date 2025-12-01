# Facebook Embedded Signup Setup

This guide explains how to set up Facebook's embedded signup flow for the Marketplace Connect page.

## What is Embedded Signup?

Embedded signup allows users to connect their Facebook account without leaving your page. Instead of redirecting to Facebook's OAuth page, a popup/modal appears on your site.

## Prerequisites

1. Facebook App ID: `1855278678430851` (already configured)
2. Facebook App Secret (set in environment variables)
3. Configuration ID (needed for embedded signup)

## Step 1: Get Your Configuration ID

1. Go to https://developers.facebook.com/apps/
2. Select your app (App ID: `1855278678430851`)
3. Go to **WhatsApp** → **Configuration** (or **Settings** → **Basic** → scroll to **WhatsApp Configuration**)
4. If you don't have a configuration, create one:
   - Click **"Create Configuration"**
   - Enter a name (e.g., "ProfitPulse Marketplace")
   - Select your WhatsApp Business Account (if applicable)
   - Click **"Create"**
5. Copy the **Configuration ID** (it looks like: `123456789012345`)

## Step 2: Set Configuration ID

### Option 1: Environment Variable (Recommended)

Add to your `.env.local` file:
```env
VITE_FACEBOOK_CONFIG_ID=your_configuration_id_here
```

Add to Vercel Environment Variables:
- **Name:** `VITE_FACEBOOK_CONFIG_ID`
- **Value:** Your Configuration ID
- **Environment:** Production, Preview, Development

### Option 2: Enter in UI

If no configuration ID is set, the app will fallback to the redirect method (existing behavior).

## Step 3: Test Embedded Signup

1. Go to `/MarketplaceConnect` page
2. Click "Connect Facebook Account"
3. If Configuration ID is set, you'll see a Facebook popup
4. If not set, it will redirect to Facebook (fallback)

## How It Works

1. **SDK Initialization**: Facebook SDK loads automatically (added to `index.html`)
2. **User Clicks Connect**: `launchFacebookSignup()` is called
3. **Facebook Popup**: User authorizes in popup (stays on your page)
4. **Code Received**: Facebook returns an authorization code
5. **Exchange Code**: Your app exchanges code for access token via `/api/facebook/exchange-code`
6. **Store Token**: Token is saved to localStorage
7. **Done**: User is connected without leaving your page

## API Endpoints

### `/api/facebook/exchange-code` (NEW)

Exchanges the authorization code from embedded signup for an access token.

**Request:**
```json
POST /api/facebook/exchange-code
{
  "code": "authorization_code_from_facebook"
}
```

**Response:**
```json
{
  "access_token": "long_lived_token",
  "token_type": "bearer",
  "expires_in": 5184000,
  "expires_at": 1234567890000
}
```

## Fallback Behavior

If no Configuration ID is provided:
- App uses redirect method (`/api/facebook/auth`)
- User is redirected to Facebook, then back to your app
- Works exactly as before

## Troubleshooting

### "Facebook SDK not loaded" Error

- Check that SDK script is in `index.html`
- Check browser console for SDK loading errors
- Ensure no ad blockers are blocking Facebook scripts

### "Configuration ID not found" Error

- Verify Configuration ID is set in environment variables
- Check that Configuration ID exists in Facebook App settings
- Try creating a new configuration in Facebook

### Popup Blocked

- Ensure popup blockers allow Facebook domains
- Check browser console for popup block messages

### Code Exchange Fails

- Verify App ID and App Secret are set correctly
- Check that redirect URI matches in Facebook App settings
- Check API route logs in Vercel

## Code Structure

- **`src/hooks/useFacebookSDK.js`**: React hook for SDK initialization
- **`src/pages/MarketplaceConnect.jsx`**: Updated to use embedded signup
- **`api/facebook/exchange-code.js`**: New endpoint to exchange code for token
- **`index.html`**: Facebook SDK script tag added

## Next Steps

1. Get your Configuration ID from Facebook
2. Add it to `.env.local` and Vercel
3. Test the embedded signup flow
4. If issues, fallback to redirect method works automatically

