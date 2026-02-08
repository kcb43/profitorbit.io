# Sold Items to Sales History Import

## Overview
Sold items from Facebook Marketplace and Mercari now import directly to the **Sales History** page, matching the behavior of eBay sold items.

## How It Works

### Detection
When importing items, the backend checks the `status` field:
- `status === 'sold'` → Item is treated as a sold item
- Any other status → Item is treated as an active listing

### Import Flow for Sold Items

1. **Inventory Item Creation/Update**
   - Creates a new inventory item OR finds existing one by title + price match
   - Sets `status: 'sold'` on the inventory item
   - If item already exists and wasn't marked as sold, updates it to `status: 'sold'`

2. **Sale Record Creation**
   - Creates a new record in the `sales` table
   - Links to the inventory item via `inventory_id`
   - Sets `platform` to 'facebook' or 'mercari' (lowercase)
   - Uses available data from the marketplace

3. **Return Value**
   - Returns both `inventoryId` and `saleId` to the frontend
   - Frontend marks the item as imported in the cache

### Sale Record Fields

#### Facebook Sold Items
```javascript
{
  user_id: userId,
  inventory_id: inventoryId,
  item_name: item.title,
  sale_price: item.price,
  sale_date: item.listingDate || item.startTime || new Date().toISOString(),
  platform: 'facebook',
  shipping_cost: 0, // Not provided by Facebook
  platform_fees: 0, // Not provided by Facebook
  vat_fees: 0, // Not provided by Facebook
  profit: item.price, // Since costs unknown, profit = sale price
  image_url: item.imageUrl || null,
  item_condition: item.condition || null,
}
```

#### Mercari Sold Items
```javascript
{
  user_id: userId,
  inventory_id: inventoryId,
  item_name: item.title,
  sale_price: item.price,
  sale_date: item.listingDate || item.startTime || new Date().toISOString(),
  platform: 'mercari',
  shipping_cost: 0, // Not provided by Mercari in import
  platform_fees: 0, // Not provided by Mercari in import
  vat_fees: 0, // Not provided by Mercari in import
  profit: item.price, // Since costs unknown, profit = sale price
  image_url: proxiedImageUrl, // Proxied to avoid CORS
  item_condition: item.condition || null,
}
```

#### eBay Sold Items (for comparison)
eBay sold items have much more detailed information from the API:
- Tracking number, shipping carrier, delivery date
- Buyer address, payment method, payment status
- Order ID, transaction ID, funds status
- Accurate fees (finalValueFee, shippingCost, salesTax)
- Accurate profit calculation

## Sales History Page

### Features
All sold items (eBay, Facebook, Mercari) appear in Sales History with:
- ✅ Sales History button (navigates from Import page)
- ✅ Sale date, price, platform
- ✅ Item image and name
- ✅ Profit calculation (simplified for FB/Mercari)
- ✅ Delete sale functionality
- ✅ Filter by platform
- ✅ Sort by date, price, profit

### User Workflow

1. **Sync sold items** on Import page:
   - Facebook: Select "Sold" status filter and sync
   - Mercari: Select "Sold" status filter and sync
   - eBay: Select "Sold" status filter and sync

2. **Import sold items**:
   - Select sold items
   - Click "Import Selected Items"
   - Backend creates inventory item + sale record

3. **View in Sales History**:
   - Click "Sales History" button (appears after importing)
   - See all sales across all platforms
   - Edit/delete as needed

## Implementation Files

### Backend APIs
- `api/facebook/import-items.js` - Detects `status === 'sold'` and creates sale records
- `api/mercari/import-items.js` - Detects `status === 'sold'` and creates sale records
- `api/ebay/import-items.js` - Already had this functionality

### Frontend
- `src/pages/Import.jsx` - Import page with status filters
- `src/pages/SalesHistory.jsx` - Displays all sales from all platforms

### Database
- `sales` table stores all sales
- `inventory_items` table stores all items (linked via `inventory_id`)

## Known Limitations

### Facebook Sold Items
- ❌ No shipping cost data
- ❌ No platform fees data
- ❌ No VAT/tax data
- ❌ No buyer information
- ❌ No tracking information
- ⚠️ Sale date is estimated from listing creation date
- ⚠️ Profit = sale price (no cost deduction)

### Mercari Sold Items
- ❌ No shipping cost data (in import)
- ❌ No platform fees data (in import)
- ❌ No VAT/tax data
- ❌ No buyer information
- ❌ No tracking information
- ⚠️ Sale date is estimated from listing creation date
- ⚠️ Profit = sale price (no cost deduction)

### eBay Sold Items
- ✅ Full transaction details available
- ✅ Accurate fees and costs
- ✅ Tracking and shipping info
- ✅ Buyer address and payment info
- ✅ Accurate profit calculation

## User Recommendations

### For Facebook/Mercari Sales
Users should manually edit sales to add:
1. **Purchase Price**: Edit the linked inventory item to add actual cost
2. **Shipping Cost**: Edit sale record if known
3. **Platform Fees**: Edit sale record (typically 5-13% for Facebook, 10-12.9% for Mercari)
4. **Notes**: Add any relevant details

This will give accurate profit calculations.

### For eBay Sales
No manual editing needed - eBay API provides all transaction details automatically.

## Future Improvements
- [ ] Add Facebook/Mercari scraping for shipping costs
- [ ] Calculate platform fees based on sale price (Facebook ~5%, Mercari ~10%)
- [ ] Add shipping cost estimation
- [ ] Allow bulk editing of fees for multiple sales
- [ ] Add profit margin warnings for inaccurate calculations

## Testing
To test this feature:

1. **Facebook Sold Items**:
   ```
   1. Go to Import page
   2. Select Facebook source
   3. Select "Sold" listing status
   4. Click "Get Latest Facebook Items"
   5. Select some sold items
   6. Click "Import Selected Items"
   7. Click "Sales History" button
   8. Verify sales appear with platform='facebook'
   ```

2. **Mercari Sold Items**:
   ```
   1. Go to Import page
   2. Select Mercari source
   3. Select "Sold" listing status
   4. Click "Get Latest Mercari Items"
   5. Select some sold items
   6. Click "Import Selected Items"
   7. Click "Sales History" button
   8. Verify sales appear with platform='mercari'
   ```

3. **Mixed Sales**:
   ```
   1. Import sold items from all 3 platforms
   2. Go to Sales History
   3. Verify all sales appear together
   4. Filter by platform
   5. Sort by various fields
   6. Delete a sale and verify it's removed
   ```

## Related Documentation
- `PERSISTENT_LISTING_CACHE.md` - How listing cache merge works
- `FACEBOOK_GRAPHQL_MIGRATION.md` - Facebook API integration
- `MERCADI_INTEGRATION_GUIDE.md` - Mercari integration details
