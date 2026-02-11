# Send Offers - eBay Implementation

## Overview

This document describes the enhancements made to the "Pro Tools" -> "Send Offers" page to match Vendoo's functionality for eBay and other marketplaces.

## Features Implemented

### 1. Marketplace Badge Counter
- **Changed**: The "Off" badge now displays a number counter showing how many offers have been sent for each marketplace
- **Storage**: Counts are persisted in `localStorage` under key `offers_sent_count`
- **Behavior**: Counter increments each time offers are successfully sent through the extension

### 2. Auto-Load eBay Items
- **Trigger**: Automatically fetches eBay items when the eBay marketplace is selected
- **Source**: Loads from:
  - Last imported items from eBay
  - Inventory items with connected eBay item links
  - Actively synced items from eBay (via `marketplace_listings` localStorage)
- **Connection Check**: Verifies eBay account connection via `window.ProfitOrbitExtension.getMarketplaceStatus("ebay")`

### 3. eBay Connection Error Message
- **Display**: Shows a red alert banner when eBay account is not connected
- **Message**: "We had trouble accessing your eBay account. Please log into https://ebay.com in a different tab or your settings. Then, click on "Connect" button, so we can try again."
- **Condition**: Only shown when `marketplace === "ebay"` and `ebayConnectionError === true`

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
3. **Likes**: Heart icon with count (from Mercari metrics or listing data)
4. **Vendoo Price**: Our internal price (bold)
5. **Mktplace Price**: Actual marketplace price
6. **Discount**: Calculated as base price - offer price (green text)
7. **Offer**: Editable field - click to edit, shows blue text with edit icon
8. **COG**: Cost of Goods (purchase price)
9. **Earnings**: Calculated as offer price - COG (bold green text, with info icon tooltip)
10. **View**: External link icon to open listing in marketplace

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

### Expected API
The extension should implement:

```javascript
window.ProfitOrbitExtension = {
  // Check marketplace connection status
  async getMarketplaceStatus(marketplace) {
    return { connected: boolean }
  },

  // Send bulk offers
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
    return { success: boolean, count: number }
  }
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

## Modified Files

1. **f:/bareretail/src/pages/ProToolsSendOffers.jsx**
   - Complete rewrite with all new features
   - Added imports for Dialog, Textarea, Alert components
   - Enhanced state management
   - Expanded table columns
   - New helper functions for defaults and counts

## Next Steps

1. **Extension Development**: Implement the actual eBay Send Offers functionality in the extension's background script
2. **HAR File Analysis**: Review the provided HAR file to understand Vendoo's API calls for sending offers
3. **API Endpoint**: Create backend endpoint if needed to proxy eBay API calls
4. **Testing**: Test with real eBay account connection
5. **Other Marketplaces**: Extend similar functionality to Mercari, Facebook, Poshmark, etc.

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
