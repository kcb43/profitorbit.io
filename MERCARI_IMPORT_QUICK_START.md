# Mercari Import - Quick Start Guide

## Setup (One-Time)

1. **Install Extension**
   - Make sure Profit Orbit extension is installed and enabled
   - Extension version should be 3.0.3 or higher

2. **Connect Mercari**
   - Open [mercari.com](https://www.mercari.com) in a new tab
   - Log in to your Mercari account
   - Navigate to your seller dashboard: `/sell/` or `/mypage/`
   - Extension will automatically capture auth tokens (check console for "✅ Captured Mercari tokens")

## Using Mercari Import

### Step 1: Open Import Page
1. Go to Profit Orbit web app
2. Navigate to **Import** page from sidebar
3. Select **Mercari** from the marketplace dropdown

### Step 2: Verify Connection
- Connection status should show **"Connected"** with green indicator
- If not connected:
  - Open mercari.com in new tab
  - Make sure you're logged in
  - Visit your seller dashboard
  - Return to Import page

### Step 3: Sync Listings
1. Click **"Sync Mercari"** button
2. Extension will:
   - Use your stored auth tokens
   - Call Mercari's GraphQL API
   - Fetch all your active listings
   - Display them in the import grid
3. Wait for sync to complete (usually 2-5 seconds)

### Step 4: Import Items
1. Review your Mercari listings
2. Select items you want to import (checkboxes)
3. Click **"Import Selected"** button
4. Items will be added to your inventory with:
   - Title from Mercari
   - Price from Mercari
   - All images
   - Source marked as "Mercari"
   - Metadata (item ID, likes, views)

## Features

### Connection Status
- ✅ **Connected**: Extension has valid Mercari tokens
- ❌ **Not Connected**: Need to log in to Mercari

### Listing Information
Each listing shows:
- **Image**: Main product photo
- **Title**: Item name
- **Price**: Current listing price
- **Stats**: Likes and page views (if available)
- **Status**: "on_sale" for active listings
- **Import Status**: "Not Imported" or "Imported"

### Filters
- **Import Status**: Filter by "Not Imported" or "Imported"
- **Sort Options**:
  - Newest First
  - Oldest First
  - Price: High to Low
  - Price: Low to High

### Actions
- **Import Selected**: Add items to inventory
- **Delete**: Remove from inventory (if already imported)
- **Sync**: Refresh listings from Mercari

## What Gets Imported

When you import a Mercari item:

| Data | What's Stored |
|------|---------------|
| **Item Name** | Mercari listing title |
| **Description** | Same as title (Mercari API doesn't provide full description) |
| **Purchase Price** | Mercari listing price |
| **Listing Price** | Mercari listing price |
| **Images** | All photos from listing |
| **Source** | "Mercari" |
| **Status** | "listed" |
| **Notes** | Mercari item ID, likes, views |

## Troubleshooting

### Problem: "Extension API not available"
**Solution:**
- Reload the Profit Orbit web app page
- Make sure extension is enabled
- Check for extension errors in console

### Problem: "Mercari authentication tokens are missing"
**Solution:**
1. Open [mercari.com](https://www.mercari.com) in new tab
2. Log in if not already
3. Visit `/sell/` page
4. Wait 5 seconds
5. Try sync again

### Problem: No listings appear after sync
**Possible causes:**
- You don't have any active listings on Mercari
- Tokens expired → re-visit mercari.com
- API error → check browser console

### Problem: Import fails with error
**Check:**
- Internet connection
- Supabase connection (backend)
- Browser console for detailed error
- Server logs if you have access

## Tips

1. **Keep Mercari tab open**: While not required, having a Mercari tab open ensures tokens stay fresh

2. **Sync regularly**: Listings on Mercari change often (sold, price updates), sync to stay current

3. **Check imported status**: Imported items are marked to prevent duplicates

4. **Review before import**: Verify price and details are correct before importing

## Technical Details

### How It Works
1. Extension captures auth tokens from Mercari website
2. Tokens stored securely in chrome.storage
3. When you sync, extension calls Mercari GraphQL API
4. API returns your active listings with full data
5. Web app displays listings for selection
6. Import saves to Supabase inventory table

### What's Captured
- **Bearer Token**: JWT for API authentication
- **CSRF Token**: Cross-site request protection
- **Seller ID**: Your Mercari seller account ID

### API Endpoint
```
POST https://www.mercari.com/v1/api
Query: userItemsQuery (GraphQL)
```

## Limitations

Current implementation:
- Only syncs active listings (status: "on_sale")
- Maximum 20 items per sync (API pagination not yet implemented)
- Manual sync required (no automatic background sync)
- Description not available from API (title is used)

## Support

If you encounter issues:
1. Check browser console for errors
2. Check extension service worker console
3. Verify tokens are being captured
4. Try re-logging into Mercari
5. Contact support with console logs

## Related Documentation

- `MERCARI_IMPORT_IMPLEMENTATION.md` - Full technical implementation details
- `extension/mercari-api.js` - API integration code
- `api/mercari/import-items.js` - Backend import handler
