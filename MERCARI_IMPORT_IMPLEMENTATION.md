# Mercari Import - Implementation Complete

## Overview

The Mercari import functionality has been implemented to allow users to sync their Mercari listings directly into Profit Orbit, similar to the Facebook Marketplace integration.

## How It Works

### 1. Token Capture
The extension automatically captures Mercari authentication tokens through multiple methods:

**Method 1: Page Storage**
- Searches `localStorage` and `sessionStorage` for auth data
- Extracts bearer token, CSRF token, and seller ID

**Method 2: API Interception**
- Intercepts `fetch()` requests to Mercari's GraphQL API (`/v1/api`)
- Captures Authorization header (Bearer token)
- Captures `x-csrf-token` header
- Extracts seller ID from request payload

**Method 3: Page Elements**
- Extracts CSRF token from meta tags
- Parses seller ID from URL patterns (`/mypage/{sellerId}`)
- Finds seller ID in profile links

### 2. API Integration
**GraphQL Query Used:**
```
POST https://www.mercari.com/v1/api?timestamp={timestamp}

Query: userItemsQuery
Variables:
- sellerId: User's Mercari seller ID
- status: "on_sale" (active listings)
- page: 1
- sortBy: "updated"
- sortType: "desc"
```

**Required Headers:**
- `Authorization: Bearer {token}`
- `x-csrf-token: {csrf}`
- `content-type: application/json`
- `apollo-require-preflight: true`
- `x-app-version: 1`
- `x-double-web: 1`
- `x-gql-migration: 1`
- `x-platform: web`

### 3. Data Mapping
Mercari listings are mapped to inventory items:

| Mercari Field | Inventory Field | Notes |
|--------------|----------------|-------|
| `id` | itemId | e.g. "m85747468355" |
| `name` | title | Item name |
| `price` | price | Converted from cents to dollars |
| `status` | status | "on_sale" → "listed" |
| `photos[0].imageUrl` | imageUrl | Main image |
| `photos[].imageUrl` | pictureURLs | All images |
| `engagement.numLikes` | numLikes | Like count |
| `engagement.itemPv` | numViews | View count |
| `updated` | updated | Unix timestamp → ISO date |

## Files Modified/Created

### Extension Files
1. **`extension/mercari-api.js`** (NEW)
   - GraphQL API integration
   - Token management
   - Listing fetcher

2. **`extension/content.js`**
   - Added Mercari token capture (3 methods)
   - Fetch interception for API calls
   - Token extraction from page elements

3. **`extension/background.js`**
   - Added `MERCARI_AUTH_CAPTURED` handler
   - Added `SCRAPE_MERCARI_LISTINGS` handler
   - Token storage in chrome.storage
   - Auto-capture on extension load

4. **`extension/profit-orbit-page-api.js`**
   - Added `scrapeMercariListings()` function
   - Message passing to bridge

5. **`extension/profit-orbit-bridge.js`**
   - Added `PO_SCRAPE_MERCARI_LISTINGS` handler
   - Bridges web app to extension

6. **`extension/manifest.json`**
   - Added `mercari-api.js` to web_accessible_resources

### Backend Files
7. **`api/mercari/import-items.js`** (NEW)
   - Handles item import to Supabase
   - Creates inventory records
   - Stores Mercari metadata

### Frontend Files
8. **`src/pages/Import.jsx`**
   - Enabled Mercari in SOURCES list
   - Added Mercari connection check
   - Added `handleMercariSync()` function
   - Updated filteredListings to include Mercari
   - Updated import mutation for Mercari
   - Updated delete mutation for Mercari
   - Set default listing status to "on_sale"

## User Flow

### Setup
1. User installs Profit Orbit extension
2. User logs into Mercari.com in any tab
3. Extension automatically captures tokens

### Importing Items
1. User navigates to Import page in Profit Orbit
2. Selects "Mercari" from source dropdown
3. Connection status shows "Connected" (green)
4. Clicks "Sync Mercari" button
5. Extension:
   - Checks stored tokens
   - Calls Mercari GraphQL API
   - Fetches all active listings
   - Returns to web app
6. Web app displays listings
7. User selects items to import
8. Items are saved to inventory database

## Token Persistence

Tokens are stored in `chrome.storage.local`:
- `mercari_bearer_token`: Authorization Bearer token
- `mercari_csrf_token`: CSRF protection token
- `mercari_seller_id`: User's Mercari seller ID
- `mercari_tokens_timestamp`: When tokens were captured

Tokens are automatically refreshed when:
- User visits Mercari.com
- User triggers a sync
- Extension detects API calls

## Testing Steps

1. **Verify Extension Loads:**
   ```
   - Open Chrome Extensions page
   - Check Profit Orbit extension is enabled
   - Check for errors in service worker console
   ```

2. **Capture Tokens:**
   ```
   - Open mercari.com and log in
   - Navigate to your seller dashboard (/mypage/)
   - Open extension console
   - Look for "✅ Captured Mercari tokens" messages
   ```

3. **Test Import:**
   ```
   - Open Profit Orbit → Import page
   - Select "Mercari" source
   - Verify "Connected" status
   - Click "Sync Mercari"
   - Should see listings appear
   - Select items and click "Import"
   - Check inventory for imported items
   ```

## Troubleshooting

### "Mercari authentication tokens are missing"
- Open mercari.com in a new tab
- Navigate to /sell/ or /mypage/
- Wait 5 seconds for tokens to capture
- Try sync again

### No listings showing
- Check browser console for API errors
- Verify tokens in chrome.storage.local
- Check if seller has any active listings on Mercari

### Import fails
- Check network tab for API errors
- Verify Supabase connection
- Check server logs for import errors

## API Rate Limits

Mercari's API may have rate limits. Current implementation:
- Only fetches page 1 (20 items)
- No automatic pagination
- Manual sync required (no background refresh)

Future enhancement: Add pagination to fetch all listings.

## Security Notes

- Bearer tokens are stored securely in chrome.storage
- Tokens are never exposed to web pages (only extension)
- CSRF tokens prevent cross-site attacks
- API calls use HTTPS only

## Next Steps

Potential enhancements:
1. Add pagination support for >20 listings
2. Add status filters (sold, on_sale, etc.)
3. Add bulk import all listings
4. Add listing analytics (likes, views)
5. Add cross-listing from Mercari to other platforms
