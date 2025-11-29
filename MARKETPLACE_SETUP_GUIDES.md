# Marketplace Setup Guides

This document provides step-by-step setup instructions for each marketplace integration.

## Table of Contents

1. [Facebook Marketplace](#facebook-marketplace)
2. [eBay](#ebay)
3. [Mercari](#mercari) (Coming Soon)
4. [Poshmark](#poshmark) (Coming Soon)

---

## Facebook Marketplace

### Prerequisites

- Facebook Developer account
- Facebook App created in [Facebook Developers Console](https://developers.facebook.com/apps)
- Business verification (required for Marketplace API)
- App review approval (required for production)

### Step 1: Create Facebook App

1. Go to [Facebook Developers](https://developers.facebook.com/apps)
2. Click **"Create App"**
3. Select **"Business"** as app type
4. Fill in app details

### Step 2: Configure OAuth

1. Go to **Settings > Basic**
2. Add **App Domains**: `profit-pulse-2.vercel.app`
3. Add **Valid OAuth Redirect URIs**:
   ```
   https://profit-pulse-2.vercel.app/api/facebook/callback
   http://localhost:5173/api/facebook/callback
   ```

### Step 3: Request Permissions

1. Go to **App Review > Permissions and Features**
2. Request:
   - `pages_manage_metadata`
   - `pages_manage_posts`
   - `business_management`
   - `pages_read_engagement`

### Step 4: Environment Variables

Add to Vercel:
```bash
FACEBOOK_APP_ID=your_app_id
FACEBOOK_APP_SECRET=your_app_secret
```

### Step 5: Business Verification

1. Go to **Settings > Business Verification**
2. Complete verification process
3. Wait for approval (can take several days)

### Step 6: App Review

1. Submit app for review with:
   - Use case explanation
   - Screenshots
   - Test account (if requested)
2. Wait for approval
3. Toggle permissions to "Live" mode

### Important Notes

- Marketplace API requires app to be in "Live" mode
- Business verification is mandatory
- Current implementation creates posts that can be converted to Marketplace listings
- Direct Marketplace API endpoint requires additional review

**See [FACEBOOK_MARKETPLACE_SETUP.md](./FACEBOOK_MARKETPLACE_SETUP.md) for detailed guide.**

---

## eBay

### Prerequisites

- eBay Developer account
- eBay application created in [eBay Developer Console](https://developer.ebay.com/my/keys)

### Step 1: Create eBay Application

1. Go to [eBay Developer Portal](https://developer.ebay.com/)
2. Navigate to **My Account > Keys & Tokens**
3. Create new application
4. Select **"Auth(new security)"** (OAuth 2.0)

### Step 2: Configure OAuth

1. In **"Auth(new security)"** section
2. Add **OAuth Redirect URIs**:
   ```
   https://profit-pulse-2.vercel.app/api/ebay/callback
   http://localhost:5173/api/ebay/callback
   ```

### Step 3: Environment Variables

Add to Vercel:
```bash
EBAY_CLIENT_ID=your_client_id
EBAY_CLIENT_SECRET=your_client_secret
EBAY_DEV_ID=your_dev_id
EBAY_ENV=production
```

### Step 4: Test Connection

1. Go to **Marketplace Connect** page
2. Click "Connect eBay Account"
3. Complete OAuth flow
4. Verify connection status

**See [EBAY_OAUTH_SETUP.md](./EBAY_OAUTH_SETUP.md) for detailed guide.**

---

## Mercari

### Status: Coming Soon

Mercari integration requires:
- Business API access (contact Mercari)
- Special permissions
- API documentation review

### Implementation Notes

- Stub integration exists in `src/integrations/mercari/MercariIntegration.js`
- Ready for implementation once API access is granted
- Follow same pattern as Facebook/eBay integrations

### Getting API Access

1. Contact Mercari business support
2. Request API access for crosslisting platform
3. Provide business information and use case
4. Wait for approval

---

## Poshmark

### Status: Coming Soon

Poshmark integration requires:
- Business API access (contact Poshmark)
- Special permissions
- API documentation review

### Implementation Notes

- Stub integration exists in `src/integrations/poshmark/PoshmarkIntegration.js`
- Ready for implementation once API access is granted
- Follow same pattern as Facebook/eBay integrations

### Getting API Access

1. Contact Poshmark business support
2. Request API access for crosslisting platform
3. Provide business information and use case
4. Wait for approval

---

## General Setup Checklist

For any new marketplace:

- [ ] Create developer account
- [ ] Create application/API keys
- [ ] Configure OAuth redirect URIs
- [ ] Request required permissions
- [ ] Add environment variables
- [ ] Test OAuth flow
- [ ] Implement integration class
- [ ] Add to CrosslistingEngine
- [ ] Update UI components
- [ ] Test listing/delisting
- [ ] Document marketplace-specific requirements

---

## Common Issues

### OAuth Redirect URI Mismatch

**Error**: "Redirect URI mismatch"

**Solution**:
- Ensure redirect URI in app settings matches exactly
- Check protocol (https vs http)
- Verify no trailing slashes
- Check domain matches production URL

### Token Expiration

**Error**: "Token expired"

**Solution**:
- Tokens auto-refresh when possible
- If refresh fails, reconnect account
- Use long-lived tokens when available

### Rate Limiting

**Error**: "Rate limit exceeded"

**Solution**:
- Wait for rate limit window to reset
- Reduce request frequency
- Implement exponential backoff
- Use bulk operations with delays

### Missing Permissions

**Error**: "Insufficient permissions"

**Solution**:
- Verify all required permissions are requested
- Check permissions are approved in app review
- Ensure permissions are toggled to "Live" mode
- Re-authenticate to grant new permissions

---

## Support Resources

- **Facebook**: [Facebook Developers Documentation](https://developers.facebook.com/docs/marketplace)
- **eBay**: [eBay Developer Documentation](https://developer.ebay.com/)
- **Mercari**: Contact business support
- **Poshmark**: Contact business support

