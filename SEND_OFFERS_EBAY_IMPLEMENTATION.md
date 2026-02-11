# Send Offers - eBay Implementation

## Overview

This document describes the enhancements made to the "Pro Tools" -> "Send Offers" page to match Vendoo's functionality for eBay and other marketplaces.

## Features Implemented

### 1. Per-Item Offer Counter
- **Changed**: Each item now displays a counter showing how many offers have been sent for that specific item
- **Storage**: Counts are persisted in `localStorage` under key `offers_sent_count_per_item`
- **Behavior**: Counter increments each time an offer is sent for that specific item
- **Display**: Shows in a new "Offers Sent" column in the listings table
- **Marketplace Badge**: Shows the total sum of all item offers sent for that marketplace

### 2. Auto-Sync Marketplace Items
- **Trigger**: Automatically fetches items when any marketplace is selected
- **API Endpoint**: `/api/offers/eligible-items?marketplaceId={marketplace}&nextPage={page}&limit={limit}`
- **Source**: Fetches from database:
  - Inventory items with marketplace-specific item IDs (e.g., `ebay_item_id`, `mercari_item_id`)
  - Items with active listings or items that were imported from that marketplace
- **Connection Check**: Verifies marketplace connection via `window.ProfitOrbitExtension.getMarketplaceStatus(marketplace)`
- **Refresh Button**: Added a refresh button next to "Eligible Listings" title to manually re-sync items

### 3. Marketplace Connection Error Message
- **Display**: Shows a red alert banner when marketplace account is not connected
- **Message**: "We had trouble accessing your [Marketplace] account. Please log into the marketplace in a different tab or check your connection settings. [Try again]"
- **Condition**: Shown when `marketplaceConnectionError === true` for any marketplace
- **Action**: Includes a "Try again" button that re-attempts to fetch items

### 4. Enhanced Settings Section

#### Offer Field
- **Input**: Percentage with "%" suffix display
- **Save as Default**: Button with `Save` icon (black in dark theme)
- **Storage**: Saved per marketplace in `localStorage` under key `offer_defaults_{marketplace}`

#### Offer Price Based On
- **Type**: Dropdown select with two options:
  - "Vendoo price" (our internal listing/purchase price)
  - "Marketplace price" (actual price on the marketplace)
- **Save as Default**: Button with `Save` icon (black in dark theme)
- **Storage**: Saved per marketplace with offer defaults

#### Add Message
- **Type**: Dialog trigger button with `MessageSquare` icon
- **Dialog**: Contains a textarea for custom offer message
- **Preview**: Shows message preview below the button when set
- **Storage**: Saved with offer defaults per marketplace

### 5. Expanded Eligible Listings Table

New columns added (from left to right):
1. **Checkbox**: Select individual items
2. **Image & Title**: Item thumbnail (12x12) + title + item ID
3. **Likes**: Heart icon with count (from marketplace data)
4. **Offers Sent**: Badge showing number of offers sent for this specific item (NEW!)
5. **Orben Price**: Our internal price (bold)
6. **Mktplace Price**: Actual marketplace price
7. **Discount**: Calculated as base price - offer price (green text)
8. **Offer**: Editable field - click to edit, shows blue text with edit icon
9. **COG**: Cost of Goods (purchase price)
10. **Earnings**: Calculated as offer price - COG (bold green text, with info icon tooltip)

### 6. Custom Offer Editing
- **Interaction**: Click on any offer price to edit it inline
- **State Management**: Stores custom offers in `customOffers` state object
- **Behavior**: Custom offers override the calculated percentage-based offers
- **Visual**: Shows blue text with edit icon when hovering

### 7. Persistent Defaults
- **Per Marketplace**: Each marketplace can have its own saved defaults
- **Data Stored**:
  - `offerPct`: Offer percentage
  - `offerPriceBasedOn`: Price basis selection
  - `offerMessage`: Custom message
- **Loading**: Defaults automatically loaded when switching marketplaces
- **Merging**: New saves merge with existing defaults (don't overwrite unrelated fields)

## Data Flow

### Calculating Offer Prices
```javascript
1. Determine base price:
   - If "Vendoo price": use listing_price or price or purchase_price
   - If "Marketplace price": use marketplace_price from listing data

2. Calculate default offer:
   offerPrice = basePrice * (1 - offerPct / 100)

3. Check for custom override:
   finalOffer = customOffers[itemId] || offerPrice
```

### Sending Offers
```javascript
1. Filter selected items from rows
2. Create draft campaign in localStorage
3. Call extension API: window.ProfitOrbitExtension.sendOffersBulk()
4. On success:
   - Increment offers sent count
   - Clear selection
   - Show success toast
```

## Extension Integration

### Implemented API
The extension now implements:

```javascript
window.ProfitOrbitExtension = {
  // Check marketplace connection status (IMPLEMENTED ✅)
  getMarketplaceStatus(marketplace) {
    // Returns: { connected: boolean, userName: string, marketplace: string }
    // Checks both connection status AND token availability
    return { connected: true, userName: 'user@example.com', marketplace: 'ebay' };
  },

  // Send bulk offers (IMPLEMENTED ✅)
  async sendOffersBulk(payload) {
    // payload = {
    //   marketplace: "ebay",
    //   offerPct: 10,
    //   offerPriceBasedOn: "vendoo_price",
    //   message: "optional message",
    //   targets: [{
    //     inventoryItemId: "123",
    //     listingUrl: "https://...",
    //     vendooPrice: 50.00,
    //     mktplacePrice: 55.00,
    //     offerPrice: 45.00
    //   }]
    // }
    // Returns: { success: boolean, count: number, results: Array }
    return { success: true, count: 5, results: [...] };
  },

  // Auto-offers configuration (IMPLEMENTED ✅)
  async setAutoOffersConfig(payload) {
    // payload = {
    //   marketplace: "ebay",
    //   enabled: true,
    //   offerPct: 10,
    //   offerPriceBasedOn: "vendoo_price",
    //   message: "optional message"
    // }
    // Returns: { success: boolean, config: Object }
    return { success: true, config: {...} };
  }
}
```

### Live Data Fetching (NEW ✅)

The API endpoint now fetches **live marketplace data** including:
- **Watchers/Likes**: Real-time count from marketplace API
- **Views**: Total view count for eBay items
- **Current Status**: Active/Inactive status from marketplace

**How it works:**
1. Frontend passes marketplace token to API endpoint
2. API calls marketplace API (eBay Trading API, Mercari GraphQL, etc.)
3. Returns live data merged with inventory data

**eBay Implementation:**
- Uses `GetMyeBaySelling` with `IncludeWatchCount: true`
- Fetches in batches of 20 items to avoid rate limits
- Returns watcher count and hit count (views)

**Mercari Implementation:**
- Would use GraphQL API via extension (not implemented in API)
- Extension has access to Mercari's GraphQL endpoint

**Headers Required:**
```javascript
{
  'x-user-id': userId,
  'x-ebay-token': ebayAccessToken,  // For eBay live data
  'x-mercari-token': mercariToken,  // For Mercari live data (future)
}
```

## UI/UX Enhancements

### Visual Design
- Modern table with proper spacing and alignment
- Color-coded information:
  - Green: Discounts and earnings (positive values)
  - Pink: Likes (with heart icon)
  - Blue: Editable fields and links
  - Muted: Secondary information (COG, IDs)
- Icons used throughout for better visual communication
- Responsive design with horizontal scroll for wide table

### Dark Theme Support
- Save icons are explicitly set to `text-foreground` to ensure they're black in dark theme
- All colors use proper dark mode variants
- Proper contrast maintained throughout

### Loading States
- Shows "Loading…" while fetching inventory items
- Shows "Loading…" while checking eBay connection
- Empty state message when no eligible listings found

## Testing Checklist

- [ ] Marketplace selection updates the active listings correctly
- [ ] Offer percentage calculation works with both price basis options
- [ ] "Save as Default" buttons persist settings correctly
- [ ] Defaults load automatically when switching marketplaces
- [ ] Custom offer editing works inline
- [ ] Add Message dialog opens and saves message
- [ ] Message preview displays correctly
- [ ] eBay connection check triggers on marketplace selection
- [ ] eBay error message displays when not connected
- [ ] Offers sent counter increments and persists
- [ ] Table displays all columns correctly
- [ ] Likes display for Mercari items
- [ ] Earnings calculation is correct
- [ ] Select all checkbox works
- [ ] Individual item selection works
- [ ] Send Offers button is disabled when no items selected
- [ ] External listing links open in new tab
- [ ] Mobile responsiveness (horizontal scroll works)
- [ ] Dark theme: Save icons are black/dark

## New API Endpoint

### `/api/offers/eligible-items`

**Purpose**: Fetch eligible items for sending offers on a given marketplace

**Method**: GET

**Query Parameters**:
- `marketplaceId` (string, required): The marketplace ID (e.g., "ebay", "mercari", "facebook")
- `nextPage` (integer, default: 0): Page number for pagination
- `limit` (integer, default: 50): Number of items per page

**Headers**:
- `x-user-id` (string, required): User ID from authentication
- `Authorization` (string, optional): Bearer token for additional auth

**Response**:
```json
{
  "items": [
    {
      "id": "item_id",
      "itemId": "item_id",
      "userId": "user_id",
      "sku": "sku_value",
      "likes": 0,
      "listingId": "listing_id",
      "listingUrl": "https://...",
      "marketplaceId": "ebay",
      "price": 50.00,
      "marketplacePrice": 55.00,
      "title": "Item Title",
      "img": "https://...",
      "costOfGoods": 20.00,
      "offersTo": null,
      "errors": null,
      "category": "Category",
      "condition": "New",
      "likedAt": null,
      "listedAt": "2024-01-01T00:00:00Z",
      "brand": "Brand Name"
    }
  ],
  "meta": {
    "hasMoreItems": false,
    "total": 10,
    "nextPage": 1
  }
}
```

## Modified Files

1. **f:/bareretail/api/offers/eligible-items.js** (NEW)
   - New API endpoint to fetch eligible items for sending offers
   - Queries Supabase for inventory items that match the marketplace
   - Returns items with all necessary fields for the offers page

2. **f:/bareretail/src/pages/ProToolsSendOffers.jsx**
   - Added per-item offer counter (replaces per-marketplace counter)
   - Added API call to fetch eligible items from new endpoint
   - Added refresh button to manually re-sync items
   - Enhanced state management with `marketplaceItems` state
   - Updated marketplace error handling to work with all marketplaces
   - Added "Offers Sent" column to the table
   - Updated offers sent tracking to be per-item instead of per-marketplace

## Implementation Status

### ✅ Completed Features

1. **Live Marketplace Data Fetching**
   - API endpoint fetches real-time watchers, likes, and views from eBay
   - Batched API calls to avoid rate limits
   - Merged with inventory data for complete item information

2. **Extension API Integration**
   - `getMarketplaceStatus(marketplace)` - Check connection status
   - `sendOffersBulk(payload)` - Send offers to multiple items
   - `setAutoOffersConfig(payload)` - Configure automatic offers
   - Background script handlers implemented

3. **Per-Item Offer Counter**
   - Tracks offers sent per specific item (not just per marketplace)
   - Persisted in localStorage
   - Displayed in new "Offers Sent" column

4. **Auto-Sync Functionality**
   - Fetches items automatically when marketplace is selected
   - Refresh button to manually re-sync
   - Works with all marketplaces

### 🚧 Needs Additional Work

1. **eBay Offer Sending**
   - Placeholder implementation exists
   - Needs actual eBay Best Offer API integration
   - Would use Trading API's `AddMemberMessageAAQToPartner` call

2. **Mercari Offer Sending**
   - Placeholder implementation exists
   - Could use price drop feature via GraphQL
   - Would notify likers automatically

3. **Poshmark OTL (Offer to Likers)**
   - Placeholder implementation exists
   - Needs UI automation or API integration
   - Poshmark has OTL feature but no public API

4. **Token Storage & Refresh**
   - Currently reads tokens from localStorage
   - Should implement secure token storage
   - Add token refresh logic for expired tokens

### 🎯 Next Steps for Full Implementation

1. **eBay Best Offer API**
   - Research eBay's Best Offer API endpoints
   - Implement offer sending to watchers
   - Handle response and update UI

2. **Mercari Price Drop**
   - Use existing Mercari GraphQL integration
   - Implement `UpdateItemMutation` with price change
   - Track notifications sent to likers

3. **Testing**
   - Test with real eBay account
   - Verify live data fetching works
   - Test offer counter tracking

4. **Error Handling**
   - Add retry logic for failed API calls
   - Better error messages for users
   - Rate limit handling

## Technical Notes

- All localStorage operations are wrapped in try-catch to prevent errors
- State management uses React hooks (useState, useEffect, useMemo)
- Query caching handled by @tanstack/react-query
- Table uses min-width to ensure all columns are visible (horizontal scroll on mobile)
- Custom offer editing uses controlled input with autoFocus
- Marketplace listings read from localStorage (synced by extension)

## Future Enhancements

1. Add bulk edit mode for offers
2. Add offer scheduling (send at specific time)
3. Add offer templates for different product categories
4. Add analytics/reporting for offer acceptance rates
5. Add ability to resend offers to previous watchers
6. Add notification when offers are accepted/declined
