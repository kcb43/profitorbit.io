# Facebook Marketplace Integration Setup Guide

This guide explains how to set up Facebook Marketplace integration for ProfitPulse, allowing users to list and delist items on Facebook Marketplace.

## Overview

The Facebook Marketplace integration uses Facebook's Graph API and OAuth 2.0 for authentication. Users can connect their Facebook account and create listings on their Facebook Pages.

## Prerequisites

1. A Facebook Developer account
2. A Facebook App created in the [Facebook Developers Console](https://developers.facebook.com/apps)
3. Business verification (required for Marketplace API access)
4. App review approval (required for production use)

## Step 1: Create a Facebook App

1. Go to [Facebook Developers](https://developers.facebook.com/apps)
2. Click **"Create App"**
3. Select **"Business"** as the app type
4. Fill in your app details:
   - App Name: `ProfitPulse` (or your preferred name)
   - App Contact Email: Your email
   - Business Account: Select or create a business account

## Step 2: Configure App Settings

### Basic Settings

1. In your app dashboard, go to **Settings > Basic**
2. Add your app domains:
   - For production: `profit-pulse-2.vercel.app`
   - For local development: `localhost`
3. Add **App Domains**:
   ```
   profit-pulse-2.vercel.app
   localhost
   ```

### OAuth Redirect URIs

1. In **Settings > Basic**, scroll to **"Valid OAuth Redirect URIs"**
2. Add the following redirect URIs:
   ```
   https://profit-pulse-2.vercel.app/api/facebook/callback
   http://localhost:5173/api/facebook/callback
   ```
   ⚠️ **Important**: The redirect URI must match EXACTLY, including:
   - Protocol (`https://` or `http://`)
   - Domain
   - Path (`/api/facebook/callback`)

## Step 3: Add Required Products

1. In your app dashboard, go to **"Add Products"**
2. Add the following products:
   - **Facebook Login** (required for OAuth)
   - **Marketing API** (if needed for advanced features)

## Step 4: Configure Permissions

1. Go to **App Review > Permissions and Features**
2. Request the following permissions:
   - `pages_manage_metadata` - Manage page metadata
   - `pages_manage_posts` - Create and manage posts (required for listings)
   - `business_management` - Manage business assets
   - `pages_read_engagement` - Read page engagement (optional)

### Permission Details

- **pages_manage_metadata**: Allows the app to manage page metadata
- **pages_manage_posts**: Required to create posts/listings on behalf of pages
- **business_management**: Required for managing business assets and pages
- **pages_read_engagement**: Allows reading page engagement metrics

## Step 5: Environment Variables

Add the following environment variables to your Vercel project:

### Production Environment

```bash
FACEBOOK_APP_ID=your_app_id_here
FACEBOOK_APP_SECRET=your_app_secret_here
```

### Local Development (.env file)

```bash
VITE_FACEBOOK_APP_ID=your_app_id_here
VITE_FACEBOOK_APP_SECRET=your_app_secret_here
```

### Finding Your App ID and Secret

1. Go to **Settings > Basic** in your Facebook App dashboard
2. **App ID**: Found at the top of the page
3. **App Secret**: Click **"Show"** next to App Secret (you may need to enter your password)

## Step 6: Business Verification

Facebook Marketplace API requires business verification:

1. Go to **Settings > Business Verification** in your app dashboard
2. Complete the business verification process:
   - Provide business information
   - Upload required documents
   - Wait for Facebook's review (can take several days)

## Step 7: App Review (Required for Production)

Before going live, you must submit your app for review:

1. Go to **App Review > Permissions and Features**
2. For each permission, click **"Request"** or **"Submit for Review"**
3. Provide detailed use cases and screenshots:
   - Explain how your app uses each permission
   - Show screenshots of the integration
   - Provide a test account if requested

### Review Checklist

- [ ] All required permissions requested
- [ ] Business verification completed
- [ ] Privacy Policy URL added (Settings > Basic)
- [ ] Terms of Service URL added (if applicable)
- [ ] App icon and display name set
- [ ] Test instructions provided

## Step 8: Testing

### Development Mode

1. Add test users in **Roles > Test Users**
2. Test the OAuth flow:
   - Go to Settings in your app
   - Click "Connect Facebook Account"
   - Complete the OAuth flow
   - Verify token storage

### Testing Checklist

- [ ] OAuth flow completes successfully
- [ ] Access token is stored correctly
- [ ] User pages are loaded
- [ ] Listing creation works
- [ ] Listing deletion works
- [ ] Error handling works for expired tokens

## Step 9: Switch to Live Mode

Once app review is approved:

1. Go to **App Review > Permissions and Features**
2. Toggle each approved permission to **"Live"**
3. Your app is now in production mode

## Important Notes

### Marketplace API Limitations

⚠️ **Important**: Facebook's Marketplace API has specific requirements:

1. **App must be in Live mode** - Development mode has limited functionality
2. **Business verification required** - Personal apps cannot access Marketplace API
3. **App review required** - All permissions must be approved
4. **Page management required** - Users must manage at least one Facebook Page

### Current Implementation

The current implementation creates posts on Facebook Pages, which can be manually converted to Marketplace listings. The direct Marketplace API endpoint (`/{page-id}/marketplace_listings`) requires:

- Additional app review
- Special Marketplace permissions
- Business verification
- Compliance with Facebook's Commerce Policies

### Alternative Approach

If direct Marketplace API access is not available, the app:
1. Creates a post on the user's Facebook Page
2. Includes all listing information (title, description, price, images)
3. User can manually convert the post to a Marketplace listing on Facebook

## Troubleshooting

### "Invalid OAuth Redirect URI"

- Ensure the redirect URI in your app settings matches EXACTLY
- Check for trailing slashes
- Verify protocol (https vs http)

### "App Not Setup: This app is still in development mode"

- Add test users in Roles > Test Users
- Or submit your app for review to go live

### "Missing Permissions"

- Ensure all required permissions are requested
- Check that permissions are approved in App Review
- Verify permissions are toggled to "Live" mode

### "Token Expired"

- Tokens are automatically refreshed when possible
- Long-lived tokens last 60 days
- Users may need to reconnect if token refresh fails

### "No Pages Found"

- User must manage at least one Facebook Page
- User must grant `pages_manage_posts` permission
- Check that the user has admin access to a page

## API Endpoints

The integration uses the following API endpoints:

- **OAuth Authorization**: `/api/facebook/auth`
- **OAuth Callback**: `/api/facebook/callback`
- **Token Refresh**: `/api/facebook/refresh-token`

## Security Considerations

1. **Never expose App Secret** - Keep it in environment variables only
2. **Use HTTPS** - Always use HTTPS in production
3. **Token Storage** - Tokens are stored in localStorage (consider server-side storage for production)
4. **CSRF Protection** - OAuth state parameter provides CSRF protection

## Support

For issues or questions:

1. Check [Facebook Developers Documentation](https://developers.facebook.com/docs/marketplace)
2. Review [Facebook Platform Policies](https://developers.facebook.com/policy)
3. Check app status in Facebook App Dashboard

## References

- [Facebook Graph API Documentation](https://developers.facebook.com/docs/graph-api)
- [Facebook Login Documentation](https://developers.facebook.com/docs/facebook-login)
- [Marketplace API Documentation](https://developers.facebook.com/docs/marketplace)
- [OAuth 2.0 Guide](https://developers.facebook.com/docs/facebook-login/guides/access-tokens)

